"""Shared helpers for the matching service split (auth/scoping/audit utilities used by every sub-module)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, NotFoundException
from app.models.applications import Application
from app.models.user import (
    AuditLog,
    EmployerProfile,
    JobPosting,
    User,
    UserCareerSelection,
)
from app.modules.matching.schemas import (
    JobListItem,
)
from app.modules.recommendations.ranker import RankedJob

logger = logging.getLogger(__name__)
_APPLICATION_LIMIT = 10

# Shared by pipeline.update_application_status and interviews._advance_status_if_earlier.
PIPELINE_FORWARD_ORDER = (
    "applied", "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "hired",
)


def _audit_matching(db: Session, action: str, user_id, resource: str, resource_id, extra: dict | None = None) -> None:
    import uuid as _uuid
    db.add(AuditLog(
        user_id=_uuid.UUID(str(user_id)) if user_id else None,
        action=action,
        resource=resource,
        resource_id=_uuid.UUID(str(resource_id)) if resource_id else None,
        new_value=extra,
    ))   # Default; overridable via platform_settings


def _get_platform_setting(key: str, default, db: Session):
    """Fetch a platform setting value. Never raises — returns default on any failure."""
    try:
        from app.models.platform import PlatformSetting
        row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
        if row and row.value is not None:
            return row.value
    except Exception:
        pass
    return default


def _ranked_to_list_item(r: RankedJob) -> JobListItem:
    return JobListItem(
        id=str(r.job.id),
        title=r.job.title,
        sector=r.job.sector,
        company_name=r.employer.company_name,
        location=r.job.location,
        job_type=r.job.job_type,
        employment_type=r.job.employment_type,
        salary_min=r.job.salary_min,
        salary_max=r.job.salary_max,
        required_skills=r.job.required_skills or [],
        min_k_score=r.job.min_k_score,
        match_score=r.match_score,
        skill_overlap_pct=r.skill_overlap,
        semantic_score=r.semantic_score,
        expires_at=r.job.expires_at,
        created_at=r.job.created_at,
        is_stretch_goal=r.is_stretch_goal,
        stretch_goal_message=r.stretch_goal_message,
        match_quality=r.match_quality,
        match_reasons=r.match_reasons,
    )


def _user_selected_sectors(user: User, db: Session) -> frozenset[str]:
    sels = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user.id).all()
    return frozenset(
        sel.track.sector.lower()
        for sel in sels
        if sel.track and sel.track.sector
    )


def _get_employer_profile_approved(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        raise AuthException("Your employer account is pending admin approval.")
    return profile


def _get_employer_profile_or_pending(user: User, db: Session) -> EmployerProfile | None:
    """Like _get_employer_profile_approved, but returns None instead of raising
    when the profile exists but is still awaiting admin approval — for read
    endpoints (analytics, upcoming interviews) that should degrade to an empty
    result while pending, the same way get_dashboard_kpis already does, rather
    than 404ing and blanking the whole dashboard. Still raises if the profile
    is missing entirely — that's a real auth problem, not a pending-approval one."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        return None
    return profile


def _get_company_employer_ids(profile: EmployerProfile, db: Session) -> list:
    """All EmployerProfile.id values sharing this profile's company."""
    if not profile.company_id:
        return [profile.id]
    rows = db.query(EmployerProfile.id).filter(EmployerProfile.company_id == profile.company_id).all()
    return [r[0] for r in rows]


def _is_company_wide(profile: EmployerProfile, role_name: str | None) -> bool:
    """Company-wide access: owner, hr_manager, or no department assigned."""
    if profile.is_owner:
        return True
    if role_name in ("hr_manager", "admin", "super_admin"):
        return True
    if profile.department_id is None:
        return True
    return False


def _scope_jobs_query(query, profile: EmployerProfile, role_name: str | None):
    """Restrict a JobPosting query to the user's department if they are dept-scoped."""
    if _is_company_wide(profile, role_name):
        return query
    return query.filter(JobPosting.department_id == profile.department_id)


def _get_scoped_job_ids(profile: EmployerProfile, company_employer_ids: list, role_name: str | None, db: Session) -> list:
    """Return job IDs the current user is allowed to see, respecting dept scoping."""
    q = db.query(JobPosting.id).filter(JobPosting.employer_id.in_(company_employer_ids))
    q = _scope_jobs_query(q, profile, role_name)
    return [r[0] for r in q.all()]


def _get_employer_application(application_id: str, user: User, db: Session) -> Application:
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.job_id.in_(job_ids))
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    return app


def _employer_display_name(user: User | None, db: Session) -> str | None:
    if not user:
        return None
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if profile and profile.contact_person:
        return profile.contact_person
    return user.full_name or user.email or user.phone

