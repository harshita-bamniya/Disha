"""Consent, retention and deletion for resume-vs-job scans.

A scan stores the parsed resume profile (contact details are redacted before parsing) and the full report so an
unchanged resume is never paid for twice. That is personal data, so:
  * a candidate must agree before the first scan (consent_at on their profile),
  * scans older than `resume_match_retention_days` are purged on a schedule,
  * a candidate can delete every stored scan and withdraw consent at any time.
Scoring an application's resume for the employer is a separate flow the candidate starts by applying.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException
from app.models.resume_match import ResumeMatchScan
from app.models.user import AspirantProfile, User

CONSENT_TEXT = (
    "To check your resume against a job, we read its text with an AI service and keep the analysis (your skills and "
    "experience as parsed, with contact details removed) so repeat checks are instant. Nothing is shared with employers. "
    "We delete these checks after {days} days, and you can delete them yourself at any time."
)


def _profile(user: User, db: Session) -> AspirantProfile | None:
    return db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()


def consent_status(user: User, db: Session, retention_days: int) -> dict:
    p = _profile(user, db)
    at = p.resume_scan_consent_at if p else None
    return {"consented": at is not None, "consented_at": at.isoformat() if at else None,
            "retention_days": retention_days, "text": CONSENT_TEXT.format(days=retention_days)}


def give_consent(user: User, db: Session) -> None:
    p = _profile(user, db)
    if p is None:
        raise BadRequestException("Finish setting up your profile first.")
    if p.resume_scan_consent_at is None:
        p.resume_scan_consent_at = datetime.now(timezone.utc)
        db.commit()


def require_consent(user: User, db: Session) -> None:
    p = _profile(user, db)
    if p is None or p.resume_scan_consent_at is None:
        raise HTTPException(status_code=403, detail={"code": "consent_required",
                                                     "message": "Please agree to how your resume is analysed before checking it."})


def delete_my_data(user: User, db: Session) -> int:
    """Delete every stored scan of this user and withdraw consent. Returns how many scans were deleted."""
    n = db.query(ResumeMatchScan).filter(ResumeMatchScan.user_id == user.id).delete(synchronize_session=False)
    p = _profile(user, db)
    if p is not None:
        p.resume_scan_consent_at = None
    db.commit()
    return n


def purge_expired(db: Session, retention_days: int, now: datetime | None = None) -> int:
    """Delete scans older than the retention window. A non-positive window disables purging (never deletes all)."""
    if retention_days <= 0:
        return 0
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=retention_days)
    n = db.query(ResumeMatchScan).filter(ResumeMatchScan.created_at < cutoff).delete(synchronize_session=False)
    db.commit()
    return n


# ── "Did you hear back?" ─────────────────────────────────────────────────────

OUTCOMES = ("interview", "offer", "rejected", "no_response")


def set_outcome(application, outcome: str) -> None:
    if outcome not in OUTCOMES:
        raise BadRequestException(f"Outcome must be one of: {', '.join(OUTCOMES)}.")
    application.candidate_outcome = outcome
    application.candidate_outcome_at = datetime.now(timezone.utc)
