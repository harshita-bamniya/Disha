"""Analytics business logic — Module 11.

Pulled out of router.py so route handlers stay thin (auth + delegate +
serialize) instead of holding the DB queries directly.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.analytics import UserEvent
from app.models.applications import Application
from app.models.counsellor import Conversation, SafetyFlag
from app.models.interview import InterviewSession
from app.models.learning import UserLearningEnrollment
from app.models.resume import Resume
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    KrsScore,
    User,
    UserCareerSelection,
)
from app.modules.analytics.schemas import EventPayload

logger = logging.getLogger(__name__)


def _safe_count(query) -> int:
    try:
        return query.scalar() or 0
    except Exception:
        return 0


# ── Event ingestion ───────────────────────────────────────────────────────────

def ingest_events(events: list[EventPayload], user_id: Optional[uuid.UUID], db: Session) -> int:
    """Batch event ingestion (fire-and-forget — analytics failures must never
    break user experience, so errors are logged and swallowed, not raised)."""
    events = events[:50]

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
        try:
            db.rollback()
        except Exception:
            pass

    return len(events)


# ── Admin: platform overview ──────────────────────────────────────────────────

def get_admin_overview(db: Session) -> dict:
    """Platform KPIs for admin dashboard."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = _safe_count(db.query(func.count(User.id)).filter(User.deleted_at == None))
    new_users_7d = _safe_count(
        db.query(func.count(User.id))
        .filter(User.created_at >= week_ago, User.deleted_at == None)
    )
    onboarding_complete = _safe_count(
        db.query(func.count(AspirantProfile.id))
        .filter(AspirantProfile.is_completed == True)
    )
    krs_computed = _safe_count(db.query(func.count(KrsScore.id)))
    resumes_created = _safe_count(db.query(func.count(Resume.id)).filter(Resume.deleted_at == None))
    interviews_completed = _safe_count(
        db.query(func.count(InterviewSession.id))
        .filter(InterviewSession.status == "completed")
    )
    conversations_active = _safe_count(
        db.query(func.count(Conversation.id))
        .filter(Conversation.status == "active")
    )
    enrollments = _safe_count(db.query(func.count(UserLearningEnrollment.id)))
    total_applications = _safe_count(db.query(func.count(Application.id)))
    active_jobs = _safe_count(db.query(func.count(JobPosting.id)).filter(JobPosting.is_active == True))
    pending_employers = _safe_count(
        db.query(func.count(EmployerProfile.id))
        .filter(EmployerProfile.is_approved == False)
    )
    open_safety_flags = _safe_count(
        db.query(func.count(SafetyFlag.id)).filter(SafetyFlag.reviewed_by == None)
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


def get_admin_funnel(db: Session) -> dict:
    """Onboarding + engagement funnel for cohort analysis."""
    registered = _safe_count(
        db.query(func.count(User.id))
        .filter(User.deleted_at == None, User.role_id != None)
    )
    onboarding_started = _safe_count(db.query(func.count(AspirantProfile.id)))
    onboarding_done = _safe_count(
        db.query(func.count(AspirantProfile.id)).filter(AspirantProfile.is_completed == True)
    )
    krs_done = _safe_count(db.query(func.count(KrsScore.id)))
    career_selected = _safe_count(db.query(func.count(UserCareerSelection.id.distinct())))
    enrolled = _safe_count(db.query(func.count(UserLearningEnrollment.id)))
    resume_done = _safe_count(
        db.query(func.count(Resume.id)).filter(Resume.deleted_at == None)
    )
    interviewed = _safe_count(
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


def list_safety_flags(
    severity: Optional[str],
    reviewed: Optional[bool],
    limit: int,
    offset: int,
    db: Session,
) -> dict:
    """List safety flags for admin review."""
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


def get_admin_trends(metric: str, days: int, db: Session) -> dict:
    """Daily time series for growth charts — Module 05 admin analytics dashboard."""
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


def get_admin_job_engagement(days: int, db: Session) -> dict:
    """Aggregate job-level engagement events for the admin dashboard.

    Returns counts of job_card_click, application_started, application_submitted
    grouped by job_id for the specified window.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    EVENT_TYPES = ("job_card_click", "application_started", "application_submitted")
    rows = (
        db.query(
            UserEvent.event_name,
            UserEvent.event_data["job_id"].astext.label("job_id"),
            func.count().label("cnt"),
        )
        .filter(
            UserEvent.event_name.in_(EVENT_TYPES),
            UserEvent.created_at >= start,
        )
        .group_by(UserEvent.event_name, UserEvent.event_data["job_id"].astext)
        .all()
    )

    aggregated: dict[str, dict[str, int]] = {}
    for event_name, job_id, cnt in rows:
        if not job_id:
            continue
        agg = aggregated.setdefault(job_id, {e: 0 for e in EVENT_TYPES})
        agg[event_name] = cnt

    return {
        "days": days,
        "jobs": [
            {"job_id": job_id, **counts}
            for job_id, counts in sorted(
                aggregated.items(),
                key=lambda kv: kv[1].get("job_card_click", 0),
                reverse=True,
            )
        ],
    }


def review_safety_flag(flag_id: str, admin_user_id: uuid.UUID, db: Session) -> dict:
    """Mark a safety flag as reviewed by the given admin."""
    flag = db.query(SafetyFlag).filter(SafetyFlag.id == flag_id).first()
    if not flag:
        raise ValueError("Safety flag not found.")
    if flag.reviewed_by:
        raise LookupError("Flag already reviewed.")

    flag.reviewed_by = admin_user_id
    db.commit()
    return {"flag_id": flag_id, "reviewed_by": str(admin_user_id)}
