"""Router for the Application Submission flow (Phase 4).

Routes:
  GET  /jobs/{job_id}/apply/eligibility   — eligibility check (candidate)
  POST /jobs/{job_id}/apply/draft         — start / resume draft
  GET  /jobs/{job_id}/apply/draft         — get current draft
  PUT  /jobs/{job_id}/apply/draft         — auto-save draft
  DELETE /jobs/{job_id}/apply/draft       — discard draft
  POST /jobs/{job_id}/apply/submit        — submit application
  GET  /applications/{app_id}             — get own application detail
  POST /applications/{app_id}/withdraw    — withdraw application
  GET  /candidates/me/applications        — list candidate's applications
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.rbac import get_current_aspirant
from app.models.user import User
from app.modules.applications import service
from app.modules.applications.schemas import (
    ApplicationDetailOut,
    ApplicationOut,
    DraftOut,
    DraftSaveRequest,
    DraftStartRequest,
    EligibilityOut,
    SubmitApplicationRequest,
    WithdrawRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Applications"])


# ── Eligibility ────────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/apply/eligibility", response_model=EligibilityOut)
def check_eligibility(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.check_eligibility(job_id, user, db)


# ── Draft ──────────────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/apply/draft", response_model=DraftOut, status_code=201)
def start_draft(
    job_id: str,
    body: DraftStartRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.start_or_get_draft(job_id, body, user, db)


@router.get("/jobs/{job_id}/apply/draft", response_model=DraftOut)
def get_draft(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_draft(job_id, user, db)


@router.put("/jobs/{job_id}/apply/draft", response_model=DraftOut)
def save_draft(
    job_id: str,
    body: DraftSaveRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.save_draft(job_id, body, user, db)


@router.delete("/jobs/{job_id}/apply/draft", status_code=204)
def discard_draft(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    service.discard_draft(job_id, user, db)


# ── Submission ─────────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/apply/submit", response_model=ApplicationOut, status_code=201)
def submit_application(
    job_id: str,
    body: SubmitApplicationRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.submit_application(job_id, body, user, db)


# ── Candidate-side application views ──────────────────────────────────────────

# Static path must be registered before /{app_id} to avoid ambiguity
@router.get("/candidates/me/applications", response_model=list[ApplicationOut])
def list_my_applications(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_my_applications(user, db)


@router.get("/applications/{app_id}", response_model=ApplicationDetailOut)
def get_application(
    app_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_application_detail(app_id, user, db)


@router.post("/applications/{app_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    app_id: str,
    body: WithdrawRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.withdraw_application(app_id, body, user, db)
