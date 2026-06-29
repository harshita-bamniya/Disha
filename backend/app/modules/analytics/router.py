"""Analytics module — Module 11.

Routes:
  POST /api/analytics/events             → batch event ingestion (all authenticated users)
  GET  /api/analytics/admin/overview     → platform KPIs (admin only)
  GET  /api/analytics/admin/funnel       → onboarding + KRS funnel (admin only)
  GET  /api/analytics/admin/safety-flags → safety flag review queue (admin only)
  PATCH /api/analytics/admin/safety-flags/{id}/review → mark flag reviewed (admin only)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_role
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_admin = require_role("admin")


# ── Schemas ───────────────────────────────────────────────────────────────────

class EventPayload(BaseModel):
    event_name: str
    event_data: dict[str, Any] = {}
    page_url: Optional[str] = None
    session_id: Optional[str] = None


class BatchEventRequest(BaseModel):
    events: list[EventPayload]


# ── Event ingestion ───────────────────────────────────────────────────────────

@router.post("/events", status_code=202)
async def ingest_events(
    body: BatchEventRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Batch event ingestion (fire-and-forget, always returns 202)."""
    from app.models.mvp3 import UserEvent
    import uuid

    events = body.events[:50]
    user_id = user.id if user else None

    try:
        for ev in events:
            db.add(UserEvent(
                id=uuid.uuid4(),
                user_id=user_id,
                session_id=ev.session_id,
                event_name=ev.event_name[:100],
                event_data=ev.event_data or {},
                page_url=ev.page_url,
            ))
        db.commit()
    except Exception as exc:
        logger.warning("[ANALYTICS] Event ingestion failed: %s", exc)
        # Analytics failures must never break user experience
        try:
            db.rollback()
        except Exception:
            pass

    return {"accepted": len(events)}


# ── Admin: platform overview ──────────────────────────────────────────────────

@router.get("/admin/overview")
def admin_overview(
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Platform KPIs for admin dashboard."""
    from app.models.user import (
        AspirantProfile, EmployerProfile, JobPosting, KrsScore,
    )
    from app.models.mvp2 import (
        Resume, InterviewSession, Conversation, UserLearningEnrollment,
    )
    from app.models.mvp3 import Application

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    def safe_count(query):
        try:
            return query.scalar() or 0
        except Exception:
            return 0

    total_users = safe_count(db.query(func.count(User.id)).filter(User.deleted_at == None))
    new_users_7d = safe_count(
        db.query(func.count(User.id))
        .filter(User.created_at >= week_ago, User.deleted_at == None)
    )
    onboarding_complete = safe_count(
        db.query(func.count(AspirantProfile.id))
        .filter(AspirantProfile.is_completed == True)
    )
    krs_computed = safe_count(db.query(func.count(KrsScore.id)))
    resumes_created = safe_count(db.query(func.count(Resume.id)).filter(Resume.deleted_at == None))
    interviews_completed = safe_count(
        db.query(func.count(InterviewSession.id))
        .filter(InterviewSession.status == "completed")
    )
    conversations_active = safe_count(
        db.query(func.count(Conversation.id))
        .filter(Conversation.status == "active")
    )
    enrollments = safe_count(db.query(func.count(UserLearningEnrollment.id)))
    total_applications = safe_count(db.query(func.count(Application.id)))
    active_jobs = safe_count(db.query(func.count(JobPosting.id)).filter(JobPosting.is_active == True))
    pending_employers = safe_count(
        db.query(func.count(EmployerProfile.id))
        .filter(EmployerProfile.is_approved == False)
    )
    from app.models.mvp2 import SafetyFlag as SF
    open_safety_flags = safe_count(
        db.query(func.count(SF.id)).filter(SF.reviewed_by == None)
    )

    return {
        "users": {
            "total": total_users,
            "new_last_7d": new_users_7d,
            "onboarding_complete": onboarding_complete,
            "onboarding_rate_pct": round((onboarding_complete / total_users) * 100) if total_users else 0,
        },
        "intelligence": {
            "krs_scores_computed": krs_computed,
        },
        "content": {
            "resumes_created": resumes_created,
            "interviews_completed": interviews_completed,
            "learning_enrollments": enrollments,
            "counsellor_conversations": conversations_active,
        },
        "employer_matching": {
            "active_job_postings": active_jobs,
            "total_applications": total_applications,
            "pending_employer_approvals": pending_employers,
        },
        "safety": {
            "open_flags": open_safety_flags,
        },
    }


@router.get("/admin/funnel")
def admin_funnel(
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Onboarding + engagement funnel for cohort analysis."""
    from app.models.user import AspirantProfile, KrsScore, UserCareerSelection
    from app.models.mvp2 import Resume, InterviewSession, UserLearningEnrollment

    def safe_count(query):
        try:
            return query.scalar() or 0
        except Exception:
            return 0

    registered = safe_count(
        db.query(func.count(User.id))
        .filter(User.deleted_at == None, User.role_id != None)
    )
    onboarding_started = safe_count(db.query(func.count(AspirantProfile.id)))
    onboarding_done = safe_count(
        db.query(func.count(AspirantProfile.id)).filter(AspirantProfile.is_completed == True)
    )
    krs_done = safe_count(db.query(func.count(KrsScore.id)))
    career_selected = safe_count(db.query(func.count(UserCareerSelection.id.distinct())))
    enrolled = safe_count(db.query(func.count(UserLearningEnrollment.id)))
    resume_done = safe_count(
        db.query(func.count(Resume.id)).filter(Resume.deleted_at == None)
    )
    interviewed = safe_count(
        db.query(func.count(InterviewSession.id)).filter(InterviewSession.status == "completed")
    )

    def pct(num, den):
        return round((num / den) * 100, 1) if den else 0.0

    return {
        "funnel": [
            {"stage": "Registered", "count": registered, "pct_of_prev": 100.0},
            {"stage": "Onboarding Started", "count": onboarding_started, "pct_of_prev": pct(onboarding_started, registered)},
            {"stage": "Onboarding Complete", "count": onboarding_done, "pct_of_prev": pct(onboarding_done, onboarding_started)},
            {"stage": "KRS Computed", "count": krs_done, "pct_of_prev": pct(krs_done, onboarding_done)},
            {"stage": "Career Track Selected", "count": career_selected, "pct_of_prev": pct(career_selected, krs_done)},
            {"stage": "Learning Enrolled", "count": enrolled, "pct_of_prev": pct(enrolled, career_selected)},
            {"stage": "Resume Created", "count": resume_done, "pct_of_prev": pct(resume_done, career_selected)},
            {"stage": "Interview Completed", "count": interviewed, "pct_of_prev": pct(interviewed, career_selected)},
        ]
    }


@router.get("/admin/safety-flags")
def list_safety_flags(
    severity: Optional[str] = Query(None),
    reviewed: Optional[bool] = Query(None, description="Filter by review status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """List safety flags for admin review."""
    from app.models.mvp2 import SafetyFlag, Message

    q = db.query(SafetyFlag)
    if severity:
        q = q.filter(SafetyFlag.severity == severity)
    if reviewed is not None:
        if reviewed:
            q = q.filter(SafetyFlag.reviewed_by != None)
        else:
            q = q.filter(SafetyFlag.reviewed_by == None)

    total = q.count()
    flags = q.order_by(desc(SafetyFlag.created_at)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "flags": [
            {
                "id": str(f.id),
                "user_id": str(f.user_id),
                "flag_type": f.flag_type,
                "severity": f.severity,
                "triggered_by": f.triggered_by,
                "action_taken": f.action_taken,
                "reviewed": f.reviewed_by is not None,
                "created_at": f.created_at,
            }
            for f in flags
        ],
    }


@router.get("/admin/trends")
def admin_trends(
    metric: str = Query("users", pattern="^(users|employers|jobs|applications)$"),
    days: int = Query(30, ge=7, le=180),
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Daily time series for growth charts — Module 05 admin analytics dashboard."""
    from app.models.user import EmployerProfile, JobPosting
    from app.models.mvp3 import Application

    model_for_metric = {
        "users": (User, User.created_at, User.deleted_at == None),
        "employers": (EmployerProfile, EmployerProfile.created_at, None),
        "jobs": (JobPosting, JobPosting.created_at, None),
        "applications": (Application, Application.created_at, None),
    }
    model, date_col, extra_filter = model_for_metric[metric]

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    query = (
        db.query(func.date_trunc("day", date_col).label("day"), func.count())
        .filter(date_col >= start)
        .group_by("day")
        .order_by("day")
    )
    if extra_filter is not None:
        query = query.filter(extra_filter)

    rows = query.all()
    counts_by_day = {row.day.date().isoformat(): row[1] for row in rows}

    series = []
    for i in range(days):
        day = (start + timedelta(days=i)).date().isoformat()
        series.append({"date": day, "count": counts_by_day.get(day, 0)})

    return {"metric": metric, "days": days, "series": series}


@router.patch("/admin/safety-flags/{flag_id}/review", status_code=200)
def review_safety_flag(
    flag_id: str,
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Mark a safety flag as reviewed by the current admin."""
    from app.models.mvp2 import SafetyFlag

    flag = db.query(SafetyFlag).filter(SafetyFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Safety flag not found.")
    if flag.reviewed_by:
        raise HTTPException(status_code=400, detail="Flag already reviewed.")

    flag.reviewed_by = current_user.id
    db.commit()
    return {"flag_id": flag_id, "reviewed_by": str(current_user.id)}
