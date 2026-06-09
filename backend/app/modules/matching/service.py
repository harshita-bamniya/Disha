"""Phase 3 — Module 09: Employer Matching service.

Responsibilities:
- Aspirant job search + ranked recommendations (KRS + skill-overlap scoring)
- Application submission + status tracking
- Employer candidate pipeline management
- Match score computation (no embeddings required — rule-based fallback works well at this scale)
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import AuthException, BadRequestException, NotFoundException
from app.models.mvp3 import Application, ApplicationStatusHistory
from app.models.user import (
    AspirantProfile, EmployerProfile, JobPosting, KrsScore, User,
    UserCareerSelection,
)
from app.modules.matching.schemas import (
    ApplicationDetailOut, ApplicationOut, ApplicationStatusHistoryItem,
    ApplyRequest, CandidateOut, JobCandidatePipeline, JobDetail,
    JobListItem, JobRecommendationsResponse, UpdateApplicationStatusRequest,
)
from app.modules.recommendations.ranker import RankedJob, rank_jobs_for_user

logger = logging.getLogger(__name__)

_APPLICATION_LIMIT = 10   # Default; overridable via platform_settings


def _get_platform_setting(key: str, default, db: Session):
    """Fetch a platform setting value. Never raises — returns default on any failure."""
    try:
        from app.models.mvp3 import PlatformSetting
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
    )


def _user_selected_sectors(user: User, db: Session) -> frozenset[str]:
    sels = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user.id).all()
    return frozenset(
        sel.track.sector.lower()
        for sel in sels
        if sel.track and sel.track.sector
    )


# ── Aspirant: browse + search jobs ───────────────────────────────────────────

def get_job_recommendations(
    user: User,
    db: Session,
    sector: Optional[str] = None,
    job_type: Optional[str] = None,
    min_salary: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
) -> JobRecommendationsResponse:
    """Return active jobs ranked by match score for the current aspirant.

    Uses the production two-stage ranker:
      - With profile embedding:   pgvector ANN (HNSW) → re-rank top 200
      - Without profile embedding: rule-based skill_overlap + k_fit fallback
    """
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    # Build caller-specified SQL filters
    sql_filters = []
    if sector:
        sql_filters.append(JobPosting.sector.ilike(f"%{sector}%"))
    if job_type:
        sql_filters.append(JobPosting.job_type == job_type)
    if min_salary is not None:
        sql_filters.append(JobPosting.salary_min >= min_salary)

    page, total = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=sql_filters,
        selected_sectors=_user_selected_sectors(user, db),
        limit=limit,
        offset=offset,
    )

    return JobRecommendationsResponse(
        total=total,
        jobs=[_ranked_to_list_item(r) for r in page],
    )


def get_job_detail(job_id: str, user: User, db: Session) -> JobDetail:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()

    # Rank this single job using the same ranker — produces correct blended score
    page, _ = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=[JobPosting.id == job_id],
        selected_sectors=_user_selected_sectors(user, db),
        limit=1,
        offset=0,
    )
    if not page:
        raise NotFoundException("Job not found or no longer active.")

    r = page[0]
    return JobDetail(
        **_ranked_to_list_item(r).model_dump(),
        description=r.job.description,
        growth_outlook=r.job.growth_outlook,
        match_summary=None,
    )


# ── Aspirant: applications ────────────────────────────────────────────────────

def apply_to_job(
    job_id: str,
    body: ApplyRequest,
    user: User,
    db: Session,
) -> ApplicationOut:
    """Submit an application. Enforces per-user application limit."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if not job:
        raise NotFoundException("Job not found or no longer active.")

    # Duplicate check
    existing = (
        db.query(Application)
        .filter(Application.aspirant_id == user.id, Application.job_id == job_id)
        .first()
    )
    if existing:
        raise BadRequestException("You have already applied to this job.")

    # Active application limit (withdrawn/rejected don't count)
    active_limit = _get_platform_setting("max_applications_per_user", _APPLICATION_LIMIT, db)
    active_count = (
        db.query(Application)
        .filter(
            Application.aspirant_id == user.id,
            Application.status.notin_(["withdrawn", "rejected"]),
        )
        .count()
    )
    if active_count >= int(active_limit):
        raise BadRequestException(
            f"You have reached the maximum of {active_limit} active applications. "
            "Withdraw an existing application before applying to a new one."
        )

    # Compute match score at time of application using the shared ranker
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    snap, _ = rank_jobs_for_user(profile, krs, db, extra_sql_filters=[JobPosting.id == job.id], limit=1)
    ms = snap[0].match_score if snap else 0

    application = Application(
        aspirant_id=user.id,
        job_id=job.id,
        match_score=ms,
        cover_note=body.cover_note,
        status="applied",
    )
    db.add(application)
    db.flush()

    # Record initial status transition
    db.add(ApplicationStatusHistory(
        application_id=application.id,
        from_status=None,
        to_status="applied",
        changed_by=user.id,
        note="Application submitted",
    ))
    db.commit()
    db.refresh(application)

    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()

    return ApplicationOut(
        id=str(application.id),
        job_id=str(job.id),
        job_title=job.title,
        company_name=employer.company_name if employer else "Unknown",
        status=application.status,
        match_score=application.match_score,
        cover_note=application.cover_note,
        employer_note=None,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def list_my_applications(user: User, db: Session) -> list[ApplicationOut]:
    apps = (
        db.query(Application)
        .options(joinedload(Application.job))
        .filter(Application.aspirant_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    result = []
    for app in apps:
        job = app.job
        employer = (
            db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
            if job else None
        )
        result.append(ApplicationOut(
            id=str(app.id),
            job_id=str(app.job_id),
            job_title=job.title if job else "Unknown",
            company_name=employer.company_name if employer else "Unknown",
            status=app.status,
            match_score=app.match_score,
            cover_note=app.cover_note,
            employer_note=app.employer_note,
            created_at=app.created_at,
            updated_at=app.updated_at,
        ))
    return result


def get_application_detail(application_id: str, user: User, db: Session) -> ApplicationDetailOut:
    app = (
        db.query(Application)
        .options(
            joinedload(Application.job),
            joinedload(Application.status_history),
        )
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")

    job = app.job
    employer = (
        db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        if job else None
    )
    return ApplicationDetailOut(
        id=str(app.id),
        job_id=str(app.job_id),
        job_title=job.title if job else "Unknown",
        company_name=employer.company_name if employer else "Unknown",
        status=app.status,
        match_score=app.match_score,
        cover_note=app.cover_note,
        employer_note=app.employer_note,
        created_at=app.created_at,
        updated_at=app.updated_at,
        status_history=[
            ApplicationStatusHistoryItem(
                from_status=h.from_status,
                to_status=h.to_status,
                note=h.note,
                created_at=h.created_at,
            )
            for h in app.status_history
        ],
    )


def withdraw_application(application_id: str, user: User, db: Session) -> dict:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired", "rejected"):
        raise BadRequestException(f"Cannot withdraw an application with status '{app.status}'.")

    prev = app.status
    app.status = "withdrawn"
    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status="withdrawn",
        changed_by=user.id,
        note="Withdrawn by applicant",
    ))
    db.commit()
    return {"status": "withdrawn"}


# ── Employer: candidate pipeline ──────────────────────────────────────────────

def _get_employer_profile_approved(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        raise AuthException("Your employer account is pending admin approval.")
    return profile


def get_job_pipeline(job_id: str, user: User, db: Session) -> JobCandidatePipeline:
    """Return all applications for a job, enriched with aspirant profiles."""
    employer = _get_employer_profile_approved(user, db)
    job = (
        db.query(JobPosting)
        .filter(JobPosting.id == job_id, JobPosting.employer_id == employer.id)
        .first()
    )
    if not job:
        raise NotFoundException("Job not found.")

    apps = (
        db.query(Application)
        .options(joinedload(Application.status_history))
        .filter(Application.job_id == job_id)
        .order_by(Application.match_score.desc())
        .all()
    )

    by_status: dict[str, int] = {}
    candidates: list[CandidateOut] = []

    for app in apps:
        by_status[app.status] = by_status.get(app.status, 0) + 1

        profile = (
            db.query(AspirantProfile)
            .filter(AspirantProfile.user_id == app.aspirant_id)
            .first()
        )
        krs = db.query(KrsScore).filter(KrsScore.user_id == app.aspirant_id).first()

        candidates.append(CandidateOut(
            application_id=str(app.id),
            aspirant_id=str(app.aspirant_id),
            full_name=profile.full_name if profile else None,
            city=profile.city if profile else None,
            state=profile.state if profile else None,
            upsc_attempts=profile.upsc_attempts if profile else None,
            highest_stage_cleared=profile.highest_stage_cleared if profile else None,
            skills=profile.skills or [] if profile else [],
            k_score=krs.k_score if krs else None,
            r_score=krs.r_score if krs else None,
            s_score=krs.s_score if krs else None,
            composite=krs.composite if krs else None,
            match_score=app.match_score,
            status=app.status,
            cover_note=app.cover_note,
            applied_at=app.created_at,
        ))

    return JobCandidatePipeline(
        job_id=str(job.id),
        job_title=job.title,
        total_applications=len(apps),
        by_status=by_status,
        candidates=candidates,
    )


def update_application_status(
    application_id: str,
    body: UpdateApplicationStatusRequest,
    user: User,
    db: Session,
) -> dict:
    """Employer updates the status of an application (shortlist, reject, hire)."""
    employer = _get_employer_profile_approved(user, db)

    # Verify the application belongs to one of this employer's jobs
    app = (
        db.query(Application)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .filter(
            Application.id == application_id,
            JobPosting.employer_id == employer.id,
        )
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired"):
        raise BadRequestException(f"Cannot change status from '{app.status}'.")

    prev = app.status
    app.status = body.status
    if body.note:
        app.employer_note = body.note

    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status=body.status,
        changed_by=user.id,
        note=body.note,
    ))
    db.commit()

    logger.info(
        "[MATCHING] Application %s: %s → %s by employer %s",
        application_id, prev, body.status, user.id
    )
    return {"application_id": application_id, "status": body.status}
