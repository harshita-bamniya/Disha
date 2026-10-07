"""Who can start which kind of interview, and how many drills are left today."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.interview import InterviewSafetyEvent, InterviewSession

STRESS_REQUIRED_COMPLETED = 3
FREE_DRILLS_PER_DAY = 10
PREMIUM_DRILLS_PER_DAY = 30

_FULL_TYPES = ("practice", "timed", "full_mock")


def stress_eligibility(user_id, db: Session, now: datetime | None = None) -> dict:
    """Stress mode is for candidates who have already done the ordinary
    interview a few times, and never right after a safety signal or while the
    counsellor side says to go gently. The message never says why."""
    from app.modules.counsellor.interview_tone import GENTLE, interview_tone

    now = now or datetime.now(timezone.utc)
    completed = (
        db.query(func.count(InterviewSession.id))
        .filter(
            InterviewSession.user_id == user_id,
            InterviewSession.status == "completed",
            InterviewSession.session_type.in_(_FULL_TYPES),
        )
        .scalar()
        or 0
    )
    if completed < STRESS_REQUIRED_COMPLETED:
        return {
            "unlocked": False, "completed": completed, "required": STRESS_REQUIRED_COMPLETED,
            "message": f"Complete {STRESS_REQUIRED_COMPLETED - completed} more regular interview"
                       f"{'' if STRESS_REQUIRED_COMPLETED - completed == 1 else 's'} to unlock stress mode.",
        }

    recent_safety = (
        db.query(InterviewSafetyEvent.id)
        .filter(InterviewSafetyEvent.user_id == user_id, InterviewSafetyEvent.created_at >= now - timedelta(hours=24))
        .first()
    )
    if recent_safety is not None or interview_tone(user_id, db) == GENTLE:
        return {
            "unlocked": False, "completed": completed, "required": STRESS_REQUIRED_COMPLETED,
            "message": "Stress mode isn't available right now.",
        }
    return {"unlocked": True, "completed": completed, "required": STRESS_REQUIRED_COMPLETED, "message": ""}


def drill_quota(user, db: Session, now: datetime | None = None) -> dict:
    """Drills are cheap, so they don't use up the free interviews, but they are
    capped per day to bound cost."""
    from app.modules.payments.service import _aspirant_is_premium

    now = now or datetime.now(timezone.utc)
    used = (
        db.query(func.count(InterviewSession.id))
        .filter(
            InterviewSession.user_id == user.id,
            InterviewSession.session_type == "drill",
            InterviewSession.created_at >= now - timedelta(hours=24),
        )
        .scalar()
        or 0
    )
    limit = PREMIUM_DRILLS_PER_DAY if _aspirant_is_premium(user.id, db) else FREE_DRILLS_PER_DAY
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}
