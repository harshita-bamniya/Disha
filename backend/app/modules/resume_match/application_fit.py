"""Resume fit for job applications: what employers see instead of a profile-based number.

An application's score is how well the resume the candidate attached fits the job. It reuses
the same engine as the candidate's own check. Employers get a snapshot without the candidate-
coaching parts (no fixes, no rewrite prompts) and it is stored on the application, so it stays
even if the candidate later deletes their own scan.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy.orm import Session

from app.models.applications import Application
from app.models.resume_match import ResumeMatchScan
from app.models.user import JobPosting, User

from . import service
from .schemas import MatchReport

logger = logging.getLogger(__name__)

STATUS_NO_RESUME = "no_resume"
STATUS_PENDING = "pending"
STATUS_READY = "ready"
STATUS_FAILED = "failed"


def _verdict_label(credit: float, requirement_type: str) -> str:
    if requirement_type == "eligibility":
        return "Confirm with candidate"
    if credit >= 0.99:
        return "Met"
    if credit >= 0.7:
        return "Equivalent skill"
    if credit > 0:
        return "Weak evidence"
    return "Not found"


def employer_view(report: MatchReport) -> dict:
    """The employer-safe summary of a report. Deliberately leaves out fixes and coaching text."""
    return {
        "score": report.score,
        "band": report.band,
        "must_haves_met": report.must_haves_met,
        "must_haves_partial": report.must_haves_partial,
        "must_haves_total": report.must_haves_total,
        "cap_reasons": report.cap_reasons,
        "to_confirm": report.to_confirm,
        "low_signal": report.low_signal,
        "requirements": [
            {
                "name": r.requirement.name,
                "importance": r.requirement.importance,
                "type": r.requirement.type,
                "credit": r.credit,
                "label": _verdict_label(r.credit, r.requirement.type),
                "evidence": r.evidence,
            }
            for r in report.requirements
        ],
        "quality": ({"score": report.quality.score, "label": report.quality.label} if report.quality else None),
        "sub_scores": [
            {"label": s.label, "score": s.score, "weight": s.effective_weight}
            for s in report.sub_scores if s.score is not None
        ],
    }


def record_result(application: Application, scan: ResumeMatchScan) -> None:
    """Put a finished scan onto the application (score, status, employer snapshot)."""
    application.match_score = scan.score
    application.resume_fit = employer_view(MatchReport.model_validate(scan.report))
    application.resume_fit_status = STATUS_READY
    application.resume_match_scan_id = scan.id


def try_cached(application: Application, job: JobPosting, user: User, db: Session) -> bool:
    """Use the candidate's existing scan if it already covers this exact resume and job. Cheap, no AI."""
    record = application.resume
    if record is None:
        return False
    try:
        text, _signals, _label = service.text_from_file_record(record)
    except Exception:
        return False
    scan = service.find_current_scan(user, job, text, db)
    if scan is None:
        return False
    record_result(application, scan)
    return True


async def _score(application_id: str) -> tuple[bool, str]:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if application is None or application.resume is None:
            return False, "application or resume missing"
        user = db.query(User).filter(User.id == application.aspirant_id).first()
        job = db.query(JobPosting).filter(JobPosting.id == application.job_id).first()
        text, signals, label = service.text_from_file_record(application.resume)
        scan, _cached = await service.run_scan(
            user, str(job.id), text, signals, source="file", ref_id=str(application.resume.id),
            label=label, db=db, enforce_quota=False)
        record_result(application, scan)
        db.commit()
        return True, ""
    finally:
        db.close()


def score_application_sync(application_id: str) -> tuple[bool, str]:
    """Score an application's resume (used by the background task). Returns (ok, reason)."""
    return asyncio.run(_score(application_id))
