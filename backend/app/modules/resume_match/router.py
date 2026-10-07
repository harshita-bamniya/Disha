"""Resume-vs-job match scoring API (aspirants)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.applications import Application
from app.models.resume_match import ResumeMatchScan
from app.models.user import JobPosting, User

from . import privacy, service
from .schemas import AnswerRequest, QuotaOut, RewriteOut, RewriteRequest, ScanOut, ScanRequest, ScanSummary

router = APIRouter(prefix="/resume-match", tags=["Resume Match"])


def _out(scan: ResumeMatchScan, user: User, db: Session, cached: bool = False) -> ScanOut:
    job = db.query(JobPosting.title).filter(JobPosting.id == scan.job_id).first()
    prev_score = (scan.score - scan.score_delta) if scan.score_delta is not None else None
    return ScanOut(
        id=str(scan.id), job_id=str(scan.job_id), job_title=job[0] if job else "",
        resume_source=scan.resume_source, resume_label=scan.resume_label,
        created_at=scan.created_at.isoformat(), cached=cached,
        previous_score=prev_score, score_delta=scan.score_delta,
        changes=service.changes_since_previous(scan, db), roadmap=service.roadmap_link(scan, user, db),
        report=service.to_report(scan),
    )


@router.get("/quota", response_model=QuotaOut)
def get_quota(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return service.quota(user, db)


@router.get("/consent")
def get_consent(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return privacy.consent_status(user, db, get_settings().resume_match_retention_days)


@router.post("/consent")
def give_consent(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    privacy.give_consent(user, db)
    return privacy.consent_status(user, db, get_settings().resume_match_retention_days)


@router.delete("/data")
def delete_my_data(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """Delete every stored resume check and withdraw consent."""
    return {"deleted_scans": privacy.delete_my_data(user, db)}


class OutcomeBody(BaseModel):
    outcome: str


@router.get("/applications/outcomes")
def my_outcomes(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """{application_id: outcome} for the candidate's own applications that have one."""
    rows = db.query(Application.id, Application.candidate_outcome).filter(
        Application.aspirant_id == user.id, Application.candidate_outcome.isnot(None)).all()
    return {str(i): o for i, o in rows}


@router.put("/applications/{application_id}/outcome")
def set_outcome(application_id: str, body: OutcomeBody, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """The candidate's own answer to "Did you hear back?". Only the applicant can set it on their application."""
    try:
        key = uuid.UUID(application_id)
    except ValueError:
        raise NotFoundException("Application not found.")
    app_row = db.query(Application).filter(Application.id == key, Application.aspirant_id == user.id).first()
    if not app_row:
        raise NotFoundException("Application not found.")
    privacy.set_outcome(app_row, body.outcome)
    db.commit()
    return {"application_id": str(app_row.id), "outcome": app_row.candidate_outcome}


@router.post("/scan", response_model=ScanOut)
async def scan_saved_resume(
    body: ScanRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Score one of the candidate's saved resumes (builder or library file) against a job."""
    privacy.require_consent(user, db)
    if bool(body.resume_id) == bool(body.resume_file_id):
        raise BadRequestException("Provide exactly one of resume_id or resume_file_id.")
    if body.resume_id:
        text, signals, label = service.text_from_builder(body.resume_id, user, db)
        source, ref = "builder", body.resume_id
    else:
        text, signals, label = await run_in_threadpool(service.text_from_library_file, body.resume_file_id, user, db)
        source, ref = "file", body.resume_file_id
    scan, cached = await service.run_scan(user, body.job_id, text, signals, source=source, ref_id=ref, label=label, db=db)
    return _out(scan, user, db, cached)


@router.post("/scan-upload", response_model=ScanOut)
async def scan_uploaded_resume(
    job_id: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Score a PDF/DOCX uploaded for this check. The file is analyzed in memory and not stored."""
    privacy.require_consent(user, db)
    data = await file.read()
    text, signals, label = await run_in_threadpool(service.text_from_upload, data, file.filename or "resume")
    scan, cached = await service.run_scan(user, job_id, text, signals, source="upload", ref_id=None, label=label, db=db)
    return _out(scan, user, db, cached)


@router.get("/jobs/{job_id}/scans", response_model=list[ScanSummary])
def list_job_scans(job_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return [
        ScanSummary(
            id=str(s.id), resume_source=s.resume_source, resume_label=s.resume_label, score=s.score, band=s.band,
            must_haves_met=s.must_haves_met, must_haves_total=s.must_haves_total, score_delta=s.score_delta,
            created_at=s.created_at.isoformat())
        for s in service.list_scans(job_id, user, db)
    ]


@router.get("/scans/{scan_id}", response_model=ScanOut)
def get_scan(scan_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return _out(service.get_scan(scan_id, user, db), user, db)


@router.delete("/scans/{scan_id}", status_code=204)
def delete_scan(scan_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    service.delete_scan(scan_id, user, db)


@router.post("/scans/{scan_id}/rewrite", response_model=RewriteOut)
async def suggest_line(
    scan_id: str, body: RewriteRequest,
    user: User = Depends(get_current_aspirant), db: Session = Depends(get_db),
):
    """Fact-checked rewrite for a weak requirement, or the question to ask when there is nothing to reword."""
    return await service.suggest_rewrite(scan_id, body.requirement, None, user, db)


@router.post("/scans/{scan_id}/answer", response_model=RewriteOut)
async def write_line_from_answer(
    scan_id: str, body: AnswerRequest,
    user: User = Depends(get_current_aspirant), db: Session = Depends(get_db),
):
    """'Have you used X?' - write a resume line from the candidate's own description, never beyond it."""
    return await service.suggest_rewrite(scan_id, body.requirement, body.answer, user, db)
