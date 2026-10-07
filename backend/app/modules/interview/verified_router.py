"""HTTP endpoints for Verified Interviews (candidate side and employer side).
Admin endpoints for appeals live in the admin router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant, require_employer
from app.database import get_db
from app.models.user import User
from app.modules.interview.schemas import SessionDetail
from app.modules.interview.service import verified
from app.modules.interview.verified_schemas import (
    AppealIn,
    DecisionIn,
    DraftRequest,
    IntegrityEventsIn,
    InviteIn,
    StartInvitationIn,
    TemplateIn,
)

candidate_router = APIRouter()
employer_router = APIRouter(prefix="/employer", tags=["Verified Interview (employer)"])


def _http(exc: verified.VerifiedError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=str(exc))


# ── candidate ─────────────────────────────────────────────────────────────────

@candidate_router.get("/invitations", tags=["Verified Interview (candidate)"])
def list_my_invitations(user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return verified.list_my_invitations(user, db)


@candidate_router.get("/invitations/{invitation_id}", tags=["Verified Interview (candidate)"])
def get_my_invitation(invitation_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    try:
        return verified.get_my_invitation(user, invitation_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.post("/invitations/{invitation_id}/start", response_model=SessionDetail, tags=["Verified Interview (candidate)"])
async def start_invitation(
    invitation_id: str,
    body: StartInvitationIn,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Start (or resume) the one attempt this invitation allows."""
    try:
        return await verified.start_invitation(user, invitation_id, body.consents, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.post("/invitations/{invitation_id}/decline", status_code=204, tags=["Verified Interview (candidate)"])
def decline_invitation(invitation_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    try:
        verified.decline_invitation(user, invitation_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.post("/sessions/{session_id}/integrity-events", tags=["Verified Interview (candidate)"])
def post_integrity_events(
    session_id: str, body: IntegrityEventsIn,
    user: User = Depends(get_current_aspirant), db: Session = Depends(get_db),
):
    """Soft observations (e.g. the tab lost focus). Timestamps only."""
    try:
        return {"accepted": verified.record_integrity_events(user, session_id, body.events, db)}
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.get("/sessions/{session_id}/integrity-events", tags=["Verified Interview (candidate)"])
def get_integrity_events(session_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """The candidate sees exactly what the employer sees."""
    try:
        return verified.my_integrity_events(user, session_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.post("/sessions/{session_id}/appeal", status_code=201, tags=["Verified Interview (candidate)"])
def file_appeal(session_id: str, body: AppealIn, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """Ask for a human to review a verified score."""
    try:
        return verified.file_appeal(user, session_id, body, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.get("/sessions/{session_id}/appeals", tags=["Verified Interview (candidate)"])
def get_my_appeals(session_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    try:
        return verified.my_appeals(user, session_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@candidate_router.post("/sessions/{session_id}/revoke-share", tags=["Verified Interview (candidate)"])
def revoke_share(session_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """Withdraw consent: the employer can no longer open this result."""
    try:
        return {"revoked": verified.revoke_share(user, session_id, db)}
    except verified.VerifiedError as exc:
        raise _http(exc)


# ── employer ──────────────────────────────────────────────────────────────────

@employer_router.get("/templates")
def list_templates(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return verified.list_templates(user, db)


@employer_router.post("/templates/draft")
async def draft_template(body: DraftRequest, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    """Suggest competencies for a role, for the employer to edit."""
    return {"competencies": await verified.draft_competencies(body.role)}


@employer_router.post("/templates", status_code=201)
def create_template(body: TemplateIn, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        return verified.create_template(user, body, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.put("/templates/{template_id}")
def update_template(template_id: str, body: TemplateIn, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        return verified.update_template(user, template_id, body, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.delete("/templates/{template_id}", status_code=204)
def archive_template(template_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        verified.archive_template(user, template_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.get("/invitations")
def list_invitations(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return verified.list_invitations_for_employer(user, db)


@employer_router.post("/invitations", status_code=201)
def invite(body: InviteIn, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    """Invite a candidate who applied to one of your jobs."""
    try:
        return verified.invite(user, body, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.get("/results/{invitation_id}")
def get_result(invitation_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    """The scorecard. Only while the candidate's share grant is live."""
    try:
        return verified.get_result(user, invitation_id, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.post("/results/{invitation_id}/decision")
def decide(invitation_id: str, body: DecisionIn, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        return verified.decide(user, invitation_id, body, db)
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.get("/results/{invitation_id}/audio")
def list_result_audio(invitation_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        return {"files": verified.employer_audio(user, invitation_id, None, db)}
    except verified.VerifiedError as exc:
        raise _http(exc)


@employer_router.get("/results/{invitation_id}/audio/{name}")
def get_result_audio(invitation_id: str, name: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    try:
        path, media_type = verified.employer_audio(user, invitation_id, name, db)
    except verified.VerifiedError as exc:
        raise _http(exc)
    return FileResponse(path, media_type=media_type)
