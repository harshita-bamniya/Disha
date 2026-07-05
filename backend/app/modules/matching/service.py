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

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.email import send_email
from app.core.exceptions import AuthException, BadRequestException, NotFoundException
from app.models.mvp3 import (
    Application, ApplicationStatusHistory, CandidateEmailLog, CandidateNote, CandidateRating,
    CandidateInterviewFeedback, OfferLetter,
)
from app.models.user import (
    AspirantProfile, EmployerProfile, JobPosting, KrsScore, PsychologicalAssessment, User,
    UserCareerSelection,
)
from app.modules.matching.schemas import (
    ApplicationDetailOut, ApplicationOut, ApplicationStatusHistoryItem,
    ApplicationTrendPoint, ApplicationTrendResponse,
    ApplyRequest, CandidateEmailLogOut, CandidateNoteOut, CandidateOut, CandidatePsychProfile,
    DashboardKpis, EmployerFunnelResponse, EmployerFunnelStage, InterviewFeedbackOut,
    JobCandidatePipeline, JobDetail, JobListItem, JobPerformanceEntry,
    JobPerformanceResponse, JobRecommendationsResponse, OfferLetterOut,
    RecruiterPerformanceEntry, RecruiterPerformanceResponse, UpcomingInterviewEntry,
    UpdateApplicationStatusRequest,
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


# ── Aspirant: browse + search jobs ───────────────────────────────────────────

def get_job_recommendations(
    user: User,
    db: Session,
    sector: Optional[str] = None,
    job_type: Optional[str] = None,
    min_salary: Optional[int] = None,
    q: Optional[str] = None,
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
    if q:
        keyword = f"%{q}%"
        from sqlalchemy import or_
        sql_filters.append(
            or_(
                JobPosting.title.ilike(keyword),
                JobPosting.description.ilike(keyword),
            )
        )

    # Load application history for collaborative filtering.
    # Cap at 2000 most-recent rows so we never pull the full table into memory.
    from app.models.mvp3 import Application as AppModel
    recent_apps = (
        db.query(AppModel.aspirant_id, AppModel.job_id)
        .order_by(AppModel.applied_at.desc())
        .limit(2000)
        .all()
    )
    application_history = [
        {"user_id": str(a.aspirant_id), "job_id": str(a.job_id)}
        for a in recent_apps
    ]
    # Fetch only this user's applied job IDs — no need to scan the full table.
    user_applied_ids = [
        str(a.job_id)
        for a in db.query(AppModel.job_id).filter(AppModel.aspirant_id == user.id).all()
    ]

    page, total = rank_jobs_for_user(
        profile, krs, db,
        extra_sql_filters=sql_filters,
        selected_sectors=_user_selected_sectors(user, db),
        application_history=application_history,
        applied_job_ids=user_applied_ids,
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

    if employer:
        from app.core.notifications import new_application_email, notify
        from app.modules.inbox.service import notify_company_team
        recipient = db.query(User).filter(User.id == employer.user_id).first()
        subject, html = new_application_email(job.title, profile.full_name if profile else None)
        notify(recipient.email if recipient else None, subject, html)
        notify_company_team(
            db, employer, "new_application",
            f"New application: {job.title}",
            f"{(profile.full_name if profile else None) or 'A candidate'} applied to {job.title}.",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

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
        dept = job.department if job else None
        result.append(ApplicationOut(
            id=str(app.id),
            job_id=str(app.job_id),
            job_title=job.title if job else "Unknown",
            company_name=employer.company_name if employer else "Unknown",
            department_id=str(job.department_id) if job and job.department_id else None,
            department_name=dept.name if dept else None,
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
    dept = job.department if job else None
    return ApplicationDetailOut(
        id=str(app.id),
        job_id=str(app.job_id),
        job_title=job.title if job else "Unknown",
        company_name=employer.company_name if employer else "Unknown",
        department_id=str(job.department_id) if job and job.department_id else None,
        department_name=dept.name if dept else None,
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


def withdraw_application(
    application_id: str, user: User, db: Session,
    reason: str | None = None, note: str | None = None,
) -> dict:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
        raise BadRequestException(f"Cannot withdraw an application with status '{app.status}'.")

    prev = app.status
    app.status = "withdrawn"
    history_note = f"Withdrawn by applicant — {reason}" if reason else "Withdrawn by applicant"
    if note:
        history_note += f": {note}"
    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status="withdrawn",
        changed_by=user.id,
        note=history_note,
    ))
    db.commit()
    return {"status": "withdrawn"}


def list_my_interviews(application_id: str, user: User, db: Session) -> list[InterviewFeedbackOut]:
    """Aspirant-facing interview visibility — previously a candidate could only
    learn their interview time from an email; there was no in-product view at all."""
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    rows = (
        db.query(CandidateInterviewFeedback)
        .filter(CandidateInterviewFeedback.application_id == app.id)
        .order_by(CandidateInterviewFeedback.scheduled_at.desc())
        .all()
    )
    out = []
    for row in rows:
        interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
        out.append(_interview_to_out(row, interviewer, db))
    return out


def request_interview_reschedule(application_id: str, interview_id: str, note: str, user: User, db: Session) -> InterviewFeedbackOut:
    """Self-serve reschedule request — the candidate flags a conflict with a
    note; the employer team sees it on the interview card and can reschedule.
    The candidate cannot directly change the time themselves, only ask."""
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    row = (
        db.query(CandidateInterviewFeedback)
        .filter(CandidateInterviewFeedback.id == interview_id, CandidateInterviewFeedback.application_id == app.id)
        .first()
    )
    if not row:
        raise NotFoundException("Interview not found.")
    if row.status != "scheduled":
        raise BadRequestException("Can only request a reschedule for a scheduled interview.")

    row.reschedule_requested_at = datetime.now(timezone.utc)
    row.reschedule_note = note
    db.commit()
    db.refresh(row)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "interview_reschedule_requested",
            f"Reschedule requested — {job.title}",
            f"Candidate requested a new time: \"{note}\"",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
    return _interview_to_out(row, interviewer, db)


def reschedule_interview(application_id: str, interview_id: str, scheduled_at, meeting_link: str | None, user: User, db: Session) -> InterviewFeedbackOut:
    """Employer updates the time on an existing interview (rather than
    creating a duplicate row via schedule_interview) — clears any pending
    reschedule request and re-notifies the candidate with a fresh ICS."""
    row = _get_employer_interview(application_id, interview_id, user, db)
    if row.status != "scheduled":
        raise BadRequestException(f"Cannot reschedule an interview with status '{row.status}'.")

    row.scheduled_at = scheduled_at
    if meeting_link is not None:
        row.meeting_link = meeting_link
    row.reschedule_requested_at = None
    row.reschedule_note = None
    db.commit()
    db.refresh(row)

    app = db.query(Application).filter(Application.id == row.application_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first() if app else None
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    candidate = db.query(User).filter(User.id == app.aspirant_id).first() if app else None

    if candidate and job and employer:
        from app.core.calendar import build_interview_ics
        from app.core.notifications import interview_scheduled_email, notify
        from app.modules.inbox.service import create_notification

        subject, html = interview_scheduled_email(
            job.title, employer.company_name, scheduled_at.strftime("%d %b %Y, %I:%M %p UTC"), row.meeting_link,
        )
        ics_content = None
        if candidate.email:
            ics_content = build_interview_ics(
                uid=f"interview-{row.id}@beginablai.in",
                summary=f"Interview: {job.title} at {employer.company_name}",
                description=f"Interview for {job.title} at {employer.company_name} (rescheduled).",
                scheduled_at=scheduled_at, location=row.meeting_link,
                organizer_email=user.email, attendee_email=candidate.email,
            )
        notify(candidate.email, subject, html, ics_content, "interview.ics")
        create_notification(
            db, candidate.id, "interview_scheduled",
            f"Interview rescheduled — {job.title}",
            f"Your interview for {job.title} at {employer.company_name} is now on {scheduled_at.strftime('%d %b, %I:%M %p')}.",
            "/app/jobs/applications",
        )
        db.commit()

    interviewer = db.query(User).filter(User.id == row.interviewer_id).first() if row.interviewer_id else None
    return _interview_to_out(row, interviewer, db)


# ── Employer: candidate pipeline ──────────────────────────────────────────────

def _get_employer_profile_approved(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        raise AuthException("Your employer account is pending admin approval.")
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


def get_job_pipeline(job_id: str, user: User, db: Session, limit: int = 100, offset: int = 0) -> JobCandidatePipeline:
    """Return applications for a job (paginated), enriched with aspirant profiles."""
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    q = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id.in_(company_employer_ids)
    )
    q = _scope_jobs_query(q, employer, user.role_name)
    job = q.first()
    if not job:
        raise NotFoundException("Job not found.")

    apps_q = (
        db.query(Application)
        .options(joinedload(Application.status_history))
        .filter(Application.job_id == job_id)
        .order_by(Application.match_score.desc())
    )
    total_applications = apps_q.count()
    apps = apps_q.offset(offset).limit(limit).all()

    by_status: dict[str, int] = {}
    candidates: list[CandidateOut] = []

    from datetime import timezone as _tz
    now = __import__("datetime").datetime.now(_tz.utc)

    app_ids = [a.id for a in apps]
    notes_by_app: dict = {}
    if app_ids:
        note_rows = (
            db.query(CandidateNote, User)
            .outerjoin(User, CandidateNote.author_id == User.id)
            .filter(CandidateNote.application_id.in_(app_ids))
            .order_by(CandidateNote.created_at.desc())
            .all()
        )
        for n, author in note_rows:
            notes_by_app.setdefault(n.application_id, []).append(
                CandidateNoteOut(
                    id=str(n.id), author_name=_employer_display_name(author, db) if author else None,
                    note=n.note, is_internal=n.is_internal, created_at=n.created_at,
                )
            )

    ratings_by_app: dict = {}
    if app_ids:
        from sqlalchemy import func as _func
        rating_rows = (
            db.query(CandidateRating.application_id, _func.avg(CandidateRating.rating))
            .filter(CandidateRating.application_id.in_(app_ids))
            .group_by(CandidateRating.application_id)
            .all()
        )
        ratings_by_app = {aid: round(float(avg), 1) for aid, avg in rating_rows}

    feedback_by_app: dict = {}
    if app_ids:
        fb_rows = (
            db.query(CandidateInterviewFeedback, User)
            .outerjoin(User, CandidateInterviewFeedback.interviewer_id == User.id)
            .filter(CandidateInterviewFeedback.application_id.in_(app_ids))
            .order_by(CandidateInterviewFeedback.created_at.desc())
            .all()
        )
        for f, interviewer in fb_rows:
            feedback_by_app.setdefault(f.application_id, []).append(
                InterviewFeedbackOut(
                    id=str(f.id), application_id=str(f.application_id),
                    interviewer_name=_employer_display_name(interviewer, db) if interviewer else None,
                    scheduled_at=f.scheduled_at, meeting_link=f.meeting_link, status=f.status,
                    recommendation=f.recommendation, feedback=f.feedback, created_at=f.created_at,
                )
            )

    # Batch-load to avoid N+1 queries (3 per candidate without this)
    aspirant_ids = [a.aspirant_id for a in apps]
    profiles_by_user: dict = {}
    krs_by_user: dict = {}
    psych_by_user: dict = {}
    if aspirant_ids:
        for p in db.query(AspirantProfile).filter(AspirantProfile.user_id.in_(aspirant_ids)).all():
            profiles_by_user[p.user_id] = p
        for k in db.query(KrsScore).filter(KrsScore.user_id.in_(aspirant_ids)).all():
            krs_by_user[k.user_id] = k
        for pa in db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id.in_(aspirant_ids)).all():
            psych_by_user[pa.user_id] = pa

    for app in apps:
        by_status[app.status] = by_status.get(app.status, 0) + 1

        profile = profiles_by_user.get(app.aspirant_id)
        krs = krs_by_user.get(app.aspirant_id)
        psych = psych_by_user.get(app.aspirant_id)

        applied_at = app.created_at
        if applied_at.tzinfo is None:
            applied_at = applied_at.replace(tzinfo=_tz.utc)
        days_ago = max(0, (now - applied_at).days)

        psych_out = None
        if psych:
            psych_out = CandidatePsychProfile(
                burnout_score=psych.burnout_score,
                confidence_index=psych.confidence_index,
                financial_pressure_score=psych.financial_pressure_score,
                risk_tolerance=psych.risk_tolerance,
                motivation_type=psych.motivation_type,
            )

        history = [
            ApplicationStatusHistoryItem(
                from_status=h.from_status,
                to_status=h.to_status,
                note=h.note,
                created_at=h.created_at,
            )
            for h in (app.status_history or [])
        ]

        candidates.append(CandidateOut(
            application_id=str(app.id),
            aspirant_id=str(app.aspirant_id),
            full_name=profile.full_name if profile else None,
            city=profile.city if profile else None,
            state=profile.state if profile else None,
            gender=profile.gender if profile else None,
            highest_qualification=profile.highest_qualification if profile else None,
            degree=profile.degree if profile else None,
            field_of_study=profile.field_of_study if profile else None,
            institution=profile.institution if profile else None,
            graduation_year=profile.graduation_year if profile else None,
            upsc_attempts=profile.upsc_attempts if profile else None,
            highest_stage_cleared=profile.highest_stage_cleared if profile else None,
            years_preparing=profile.years_preparing if profile else None,
            optional_subject=profile.optional_subject if profile else None,
            has_work_experience=profile.has_work_experience if profile else None,
            work_experience_years=profile.work_experience_years if profile else None,
            work_experience_domain=profile.work_experience_domain if profile else None,
            last_designation=profile.last_designation if profile else None,
            skills=profile.skills or [] if profile else [],
            k_score=krs.k_score if krs else None,
            r_score=krs.r_score if krs else None,
            s_score=krs.s_score if krs else None,
            composite=krs.composite if krs else None,
            psych=psych_out,
            expected_salary_min=profile.expected_salary_min if profile else None,
            expected_salary_max=profile.expected_salary_max if profile else None,
            open_to_relocation=profile.open_to_relocation if profile else None,
            preferred_locations=profile.preferred_locations if profile else None,
            match_score=app.match_score,
            status=app.status,
            cover_note=app.cover_note,
            employer_note=app.employer_note,
            applied_at=app.created_at,
            days_ago=days_ago,
            status_history=history,
            notes=notes_by_app.get(app.id, []),
            avg_rating=ratings_by_app.get(app.id),
            interview_feedback=feedback_by_app.get(app.id, []),
        ))

    return JobCandidatePipeline(
        job_id=str(job.id),
        job_title=job.title,
        total_applications=total_applications,
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
    company_employer_ids = _get_company_employer_ids(employer, db)

    # Verify the application belongs to one of this company's (dept-scoped) jobs
    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    app = (
        db.query(Application)
        .filter(
            Application.id == application_id,
            Application.job_id.in_(job_ids),
        )
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
        raise BadRequestException(f"Cannot change status from '{app.status}'.")

    prev = app.status
    new_status = body.status

    # Guard backwards transitions — only explicitly allowed reversals are permitted
    if (
        prev in PIPELINE_FORWARD_ORDER
        and new_status in PIPELINE_FORWARD_ORDER
        and PIPELINE_FORWARD_ORDER.index(new_status) < PIPELINE_FORWARD_ORDER.index(prev)
        and new_status not in _ALLOWED_BACKWARDS.get(prev, set())
    ):
        raise BadRequestException(
            f"Cannot move an application backwards from '{prev}' to '{new_status}'. "
            "Only forward transitions are allowed."
        )

    app.status = new_status
    if body.note:
        app.employer_note = body.note

    db.add(ApplicationStatusHistory(
        application_id=app.id,
        from_status=prev,
        to_status=new_status,
        changed_by=user.id,
        note=body.note,
    ))
    db.commit()

    from app.core.notifications import application_status_email, notify
    from app.modules.inbox.service import create_notification
    candidate = db.query(User).filter(User.id == app.aspirant_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    if candidate and job:
        subject, html = application_status_email(job.title, employer.company_name, new_status)
        notify(candidate.email, subject, html)
        create_notification(
            db, candidate.id, "application_status_changed",
            f"Update on your application — {job.title}",
            f"Your application to {job.title} at {employer.company_name} is now: {new_status.replace('_', ' ').title()}.",
            f"/app/jobs/applications",
        )
        db.commit()

    logger.info(
        "[MATCHING] Application %s: %s → %s by employer %s",
        application_id, prev, new_status, user.id
    )
    return {"application_id": application_id, "status": new_status}


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


def bulk_update_status(application_ids: list[str], status: str, note: str | None, user: User, db: Session) -> dict:
    """Move multiple applications to the same stage in one transaction."""
    from app.modules.inbox.service import create_notification

    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application)
        .filter(Application.id.in_(application_ids), Application.job_id.in_(job_ids))
        .all()
    )
    updated = 0
    for app in apps:
        if app.status in ("withdrawn", "hired", "rejected", "offer_declined"):
            continue
        prev = app.status
        app.status = status
        if note:
            app.employer_note = note
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status=status, changed_by=user.id, note=note,
        ))
        job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
        if job:
            create_notification(
                db, app.aspirant_id, "application_status_changed",
                f"Update on your application — {job.title}",
                f"Your application to {job.title} at {employer.company_name} is now: {status.replace('_', ' ').title()}.",
                "/app/jobs/applications",
            )
        updated += 1
    db.commit()
    return {"updated": updated, "status": status}


def add_candidate_note(application_id: str, note: str, is_internal: bool, user: User, db: Session) -> CandidateNoteOut:
    app = _get_employer_application(application_id, user, db)
    row = CandidateNote(application_id=app.id, author_id=user.id, note=note, is_internal=is_internal)
    db.add(row)
    db.commit()
    db.refresh(row)
    return CandidateNoteOut(
        id=str(row.id), author_name=_employer_display_name(user, db), note=row.note,
        is_internal=row.is_internal, created_at=row.created_at,
    )


async def send_candidate_email(application_id: str, subject: str, body: str, user: User, db: Session) -> CandidateEmailLogOut:
    """Recruiter emails a candidate directly from the pipeline.

    This was the single biggest gap in the product — recruiters could track a
    candidate through pipeline stages but had no way to actually contact them
    without leaving the app. Persists a log row (compliance/team visibility)
    in addition to actually sending the email.
    """
    app = _get_employer_application(application_id, user, db)
    if not app.aspirant or not app.aspirant.email:
        raise BadRequestException("This candidate has no email address on file.")

    employer = _get_employer_profile_approved(user, db)
    sender_name = employer.company_name or user.email or "Recruiting team"

    html = "".join(f"<p>{line}</p>" for line in body.split("\n") if line.strip())
    await send_email(app.aspirant.email, subject, html or f"<p>{body}</p>")

    row = CandidateEmailLog(
        application_id=app.id, sender_id=user.id,
        recipient_email=app.aspirant.email, subject=subject, body=body,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CandidateEmailLogOut(
        id=str(row.id), sender_name=sender_name, recipient_email=row.recipient_email,
        subject=row.subject, body=row.body, created_at=row.created_at,
    )


def _aspirant_full_name(aspirant_id, db: Session) -> Optional[str]:
    """Candidate display names live on AspirantProfile, not User.full_name
    (which is only populated for admin/employer accounts)."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == aspirant_id).first()
    return profile.full_name if profile else None


def _offer_to_out(offer: OfferLetter) -> OfferLetterOut:
    return OfferLetterOut(
        id=str(offer.id), application_id=str(offer.application_id), status=offer.status,
        role_title=offer.role_title, salary_ctc=offer.salary_ctc, start_date=offer.start_date,
        work_location=offer.work_location, employment_type=offer.employment_type,
        company_address=offer.company_address, hiring_manager_name=offer.hiring_manager_name,
        hiring_manager_designation=offer.hiring_manager_designation, extra_clauses=offer.extra_clauses,
        sent_at=offer.sent_at, responded_at=offer.responded_at,
        signature_name=offer.signature_name, decline_reason=offer.decline_reason,
        created_at=offer.created_at,
    )


def _render_offer_pdf(offer: OfferLetter, candidate_name: str, candidate_email: str, company_name: str) -> bytes:
    from app.modules.matching.offer_pdf import generate_offer_letter_pdf
    return generate_offer_letter_pdf(
        candidate_name=candidate_name or "Candidate",
        candidate_email=candidate_email or "",
        role_title=offer.role_title,
        company_name=company_name or "Company",
        company_address=offer.company_address or "",
        hiring_manager_name=offer.hiring_manager_name,
        hiring_manager_designation=offer.hiring_manager_designation,
        salary_ctc=offer.salary_ctc,
        start_date=offer.start_date,
        work_location=offer.work_location,
        employment_type=offer.employment_type,
        extra_clauses=offer.extra_clauses,
        offer_date=offer.sent_at.strftime("%d %B %Y") if offer.sent_at else None,
        signed=(offer.status == "accepted"),
        signature_name=offer.signature_name,
        signed_at=offer.responded_at.strftime("%d %B %Y, %I:%M %p UTC") if offer.responded_at else None,
        signature_ip=offer.signature_ip,
    )


async def send_offer_letter(application_id: str, body, user: User, db: Session) -> OfferLetterOut:
    """Create/update the persisted offer letter for this application, email the
    candidate the PDF, and notify them in-app. Replaces the previous stateless
    "generate a PDF and forget it" flow — persisting the offer is what makes
    accept/decline possible at all."""
    app = _get_employer_application(application_id, user, db)
    if not app.aspirant or not app.aspirant.email:
        raise BadRequestException("This candidate has no email address on file.")

    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if offer and offer.status != "sent":
        raise BadRequestException(f"Cannot modify an offer that has already been {offer.status}.")

    employer = _get_employer_profile_approved(user, db)

    from datetime import datetime, timezone
    if offer is None:
        offer = OfferLetter(application_id=app.id, created_by=user.id)
        db.add(offer)

    offer.role_title = body.role_title
    offer.company_address = body.company_address
    offer.hiring_manager_name = body.hiring_manager_name
    offer.hiring_manager_designation = body.hiring_manager_designation
    offer.salary_ctc = body.salary_ctc
    offer.start_date = body.start_date
    offer.work_location = body.work_location
    offer.employment_type = body.employment_type
    offer.extra_clauses = body.extra_clauses
    offer.status = "sent"
    offer.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)

    if app.status not in ("withdrawn", "hired", "rejected"):
        prev = app.status
        app.status = "offer_sent"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="offer_sent",
            changed_by=user.id, note="Offer letter sent",
        ))
        db.commit()

    pdf_bytes = _render_offer_pdf(offer, _aspirant_full_name(app.aspirant_id, db), app.aspirant.email, employer.company_name)

    from app.modules.inbox.service import create_notification
    html = (
        f"<p>Congratulations — you've received an offer letter for the "
        f"<b>{body.role_title}</b> position at <b>{employer.company_name or 'the company'}</b>. "
        f"It's attached as a PDF. Sign in to your applications dashboard to review and respond.</p>"
    )
    await send_email(
        app.aspirant.email, f"Your offer letter — {body.role_title}", html,
        attachment=(f"offer_letter_{application_id[:8]}.pdf", pdf_bytes, "pdf"),
    )
    create_notification(
        db, app.aspirant_id, "application_status_changed",
        f"You've received an offer — {body.role_title}",
        f"{employer.company_name or 'The employer'} sent you an offer letter for {body.role_title}. Review and respond in your applications.",
        "/app/jobs/applications",
    )
    db.commit()

    return _offer_to_out(offer)


def get_offer_letter_for_employer(application_id: str, user: User, db: Session) -> Optional[OfferLetterOut]:
    app = _get_employer_application(application_id, user, db)
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    return _offer_to_out(offer) if offer else None


def download_offer_letter_pdf_employer(application_id: str, user: User, db: Session) -> bytes:
    app = _get_employer_application(application_id, user, db)
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if not offer:
        raise NotFoundException("No offer letter has been sent for this application.")
    employer = _get_employer_profile_approved(user, db)
    return _render_offer_pdf(
        offer, _aspirant_full_name(app.aspirant_id, db),
        app.aspirant.email if app.aspirant else None, employer.company_name,
    )


def _get_own_offer_letter(application_id: str, user: User, db: Session) -> tuple[Application, OfferLetter]:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if not offer:
        raise NotFoundException("No offer letter for this application.")
    return app, offer


def get_my_offer_letter(application_id: str, user: User, db: Session) -> OfferLetterOut:
    _, offer = _get_own_offer_letter(application_id, user, db)
    return _offer_to_out(offer)


def download_my_offer_letter_pdf(application_id: str, user: User, db: Session) -> bytes:
    app, offer = _get_own_offer_letter(application_id, user, db)
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    return _render_offer_pdf(offer, _aspirant_full_name(user.id, db), user.email, employer.company_name if employer else None)


def accept_offer_letter(
    application_id: str, signature_name: str, ip: str | None, user_agent: str | None, user: User, db: Session,
) -> OfferLetterOut:
    """Self-serve e-signature acceptance — typed full legal name + IP/timestamp
    audit trail. Not a legally-binding e-signature (that needs a third-party
    provider contract — see docs/ENTERPRISE_AUDIT_ROADMAP.md M2), but a real,
    persisted candidate response instead of a status flag alone."""
    app, offer = _get_own_offer_letter(application_id, user, db)
    if offer.status != "sent":
        raise BadRequestException(f"This offer has already been {offer.status}.")

    from datetime import datetime, timezone
    offer.status = "accepted"
    offer.responded_at = datetime.now(timezone.utc)
    offer.signature_name = signature_name
    offer.signature_ip = ip
    offer.signature_user_agent = user_agent

    prev = app.status
    if prev not in ("withdrawn", "rejected"):
        app.status = "hired"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="hired",
            changed_by=user.id, note=f"Offer accepted & digitally signed by {signature_name}",
        ))
    db.commit()
    db.refresh(offer)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer and job:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "offer_accepted",
            f"Offer accepted — {job.title}",
            f"{signature_name} has accepted and signed the offer letter for {job.title}.",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    return _offer_to_out(offer)


def decline_offer_letter(application_id: str, reason: str | None, user: User, db: Session) -> OfferLetterOut:
    app, offer = _get_own_offer_letter(application_id, user, db)
    if offer.status != "sent":
        raise BadRequestException(f"This offer has already been {offer.status}.")

    from datetime import datetime, timezone
    offer.status = "declined"
    offer.responded_at = datetime.now(timezone.utc)
    offer.decline_reason = reason

    prev = app.status
    if prev not in ("withdrawn", "hired"):
        app.status = "offer_declined"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="offer_declined",
            changed_by=user.id, note="Candidate declined the offer letter" + (f": {reason}" if reason else ""),
        ))
    db.commit()
    db.refresh(offer)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer and job:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "offer_declined",
            f"Offer declined — {job.title}",
            f"The candidate has declined the offer letter for {job.title}." + (f' Reason: "{reason}"' if reason else ""),
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    return _offer_to_out(offer)


async def bulk_email_candidates(
    application_ids: list[str], subject: str, body: str, user: User, db: Session
) -> dict:
    """Send the same email to multiple candidates in one action.

    Skips any application where the candidate has no email address on file.
    Persists a log row per send for compliance/team visibility.
    """
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    sender_name = employer.company_name or user.email or "Recruiting team"

    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application)
        .filter(Application.id.in_(application_ids), Application.job_id.in_(job_ids))
        .all()
    )

    html = "".join(f"<p>{line}</p>" for line in body.split("\n") if line.strip()) or f"<p>{body}</p>"
    sent = 0
    skipped = 0
    for app in apps:
        if not app.aspirant or not app.aspirant.email:
            skipped += 1
            continue
        await send_email(app.aspirant.email, subject, html)
        db.add(CandidateEmailLog(
            application_id=app.id, sender_id=user.id,
            recipient_email=app.aspirant.email, subject=subject, body=body,
        ))
        sent += 1

    if sent:
        db.commit()

    return {"sent": sent, "skipped": skipped}


def list_candidate_emails(application_id: str, user: User, db: Session) -> list[CandidateEmailLogOut]:
    app = _get_employer_application(application_id, user, db)
    rows = (
        db.query(CandidateEmailLog)
        .filter(CandidateEmailLog.application_id == app.id)
        .order_by(CandidateEmailLog.created_at.desc())
        .all()
    )
    return [
        CandidateEmailLogOut(
            id=str(r.id),
            sender_name=(r.sender.full_name or r.sender.email if r.sender else None) or "Recruiting team",
            recipient_email=r.recipient_email, subject=r.subject, body=r.body,
            created_at=r.created_at,
        )
        for r in rows
    ]


def set_candidate_rating(application_id: str, rating: int, user: User, db: Session) -> dict:
    app = _get_employer_application(application_id, user, db)
    existing = (
        db.query(CandidateRating)
        .filter(CandidateRating.application_id == app.id, CandidateRating.rater_id == user.id)
        .first()
    )
    if existing:
        existing.rating = rating
    else:
        db.add(CandidateRating(application_id=app.id, rater_id=user.id, rating=rating))
    db.commit()

    from sqlalchemy import func as _func
    avg = db.query(_func.avg(CandidateRating.rating)).filter(CandidateRating.application_id == app.id).scalar()
    return {"application_id": application_id, "avg_rating": round(float(avg), 1) if avg else None}


# ── Interview scheduling (Module 05 Phase 9) ──────────────────────────────────

PIPELINE_FORWARD_ORDER = (
    "applied", "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "hired",
)

# Allowed backwards transitions (stage → earlier stage for genuine corrections)
_ALLOWED_BACKWARDS = {
    "shortlisted": {"screening", "applied"},
    "assessment": {"shortlisted", "screening", "applied"},
    "hr_interview": {"assessment", "shortlisted", "screening", "applied"},
    "technical_interview": {"hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "manager_interview": {"technical_interview", "hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "interview_scheduled": {"manager_interview", "technical_interview", "hr_interview", "assessment", "shortlisted", "screening", "applied"},
    "interview_completed": {"interview_scheduled"},
}


def _advance_status_if_earlier(app: Application, to_status: str, user: User, db: Session) -> None:
    """Moves the application forward in the pipeline to to_status, but never
    backward and never out of a terminal state (rejected/withdrawn/hired)."""
    if app.status not in PIPELINE_FORWARD_ORDER:
        return   # terminal state (rejected/withdrawn) — leave it alone
    if PIPELINE_FORWARD_ORDER.index(to_status) <= PIPELINE_FORWARD_ORDER.index(app.status):
        return   # already at or past this stage
    prev = app.status
    app.status = to_status
    db.add(ApplicationStatusHistory(
        application_id=app.id, from_status=prev, to_status=to_status, changed_by=user.id,
        note=f"Auto-advanced by interview {to_status.replace('_', ' ')}.",
    ))


def _employer_display_name(user: User | None, db: Session) -> str | None:
    if not user:
        return None
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if profile and profile.contact_person:
        return profile.contact_person
    return user.full_name or user.email or user.phone


def _interview_to_out(row: CandidateInterviewFeedback, interviewer: User | None, db: Session | None = None) -> InterviewFeedbackOut:
    if db is not None:
        interviewer_name = _employer_display_name(interviewer, db)
    else:
        interviewer_name = (interviewer.email or interviewer.phone) if interviewer else None
    return InterviewFeedbackOut(
        id=str(row.id), application_id=str(row.application_id),
        interviewer_name=interviewer_name,
        scheduled_at=row.scheduled_at, meeting_link=row.meeting_link, status=row.status,
        recommendation=row.recommendation, feedback=row.feedback, created_at=row.created_at,
        reschedule_requested_at=row.reschedule_requested_at, reschedule_note=row.reschedule_note,
    )


def schedule_interview(application_id: str, scheduled_at, meeting_link: str | None, user: User, db: Session) -> InterviewFeedbackOut:
    app = _get_employer_application(application_id, user, db)
    row = CandidateInterviewFeedback(
        application_id=app.id, interviewer_id=user.id, scheduled_at=scheduled_at,
        meeting_link=meeting_link, status="scheduled",
    )
    db.add(row)
    _advance_status_if_earlier(app, "interview_scheduled", user, db)
    db.commit()
    db.refresh(row)

    from app.core.calendar import build_interview_ics
    from app.core.notifications import interview_scheduled_email, notify
    candidate = db.query(User).filter(User.id == app.aspirant_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if candidate and job and employer:
        subject, html = interview_scheduled_email(
            job.title, employer.company_name, scheduled_at.strftime("%d %b %Y, %I:%M %p UTC"), meeting_link,
        )
        ics_content = None
        if candidate.email:
            ics_content = build_interview_ics(
                uid=f"interview-{row.id}@beginablai.in",
                summary=f"Interview: {job.title} at {employer.company_name}",
                description=f"Interview for {job.title} at {employer.company_name}." + (f"\nJoin: {meeting_link}" if meeting_link else ""),
                scheduled_at=scheduled_at,
                location=meeting_link,
                organizer_email=user.email,
                attendee_email=candidate.email,
            )
        notify(candidate.email, subject, html, ics_content, "interview.ics")

        from app.modules.inbox.service import create_notification, notify_company_team
        notify_company_team(
            db, employer, "interview_scheduled",
            f"Interview scheduled: {job.title}",
            f"Interview with {candidate.email or 'a candidate'} on {scheduled_at.strftime('%d %b, %I:%M %p')}.",
            f"/app/employer/pipeline/{job.id}",
        )
        create_notification(
            db, candidate.id, "interview_scheduled",
            f"Interview scheduled — {job.title}",
            f"Your interview for {job.title} at {employer.company_name} is on {scheduled_at.strftime('%d %b, %I:%M %p')}." + (f" Meeting link: {meeting_link}" if meeting_link else ""),
            "/app/jobs/applications",
        )
        db.commit()

    # Push to recruiter's Google Calendar if they've connected
    _push_interview_to_google_calendar(row, user, db)

    return _interview_to_out(row, user, db)


def _push_interview_to_google_calendar(interview_row, user: User, db: Session) -> None:
    """Best-effort push to Google Calendar — never raises, never blocks the request."""
    import json as _json
    try:
        from app.models.mvp3 import GoogleCalendarToken
        token_row = db.query(GoogleCalendarToken).filter(GoogleCalendarToken.user_id == user.id).first()
        if not token_row:
            return

        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build as gcal_build
        from app.config import get_settings as _gs

        s = _gs()
        creds_data = _json.loads(token_row.token)
        creds = Credentials(
            token=creds_data.get("token"),
            refresh_token=creds_data.get("_refresh_token") or creds_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=s.google_calendar_client_id,
            client_secret=s.google_calendar_client_secret,
            scopes=creds_data.get("scopes", []),
        )

        service = gcal_build("calendar", "v3", credentials=creds, cache_discovery=False)

        app_row = db.query(Application).filter(Application.id == interview_row.application_id).first()
        job = db.query(JobPosting).filter(JobPosting.id == app_row.job_id).first() if app_row else None
        candidate = db.query(User).filter(User.id == app_row.aspirant_id).first() if app_row else None

        start = interview_row.scheduled_at
        from datetime import timedelta
        end = start + timedelta(minutes=45)

        event = {
            "summary": f"Interview: {job.title if job else 'Candidate'}" + (f" — {candidate.full_name}" if candidate and candidate.full_name else ""),
            "description": f"Interview scheduled via Disha AI Platform." + (f"\nMeeting link: {interview_row.meeting_link}" if interview_row.meeting_link else ""),
            "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Kolkata"},
            "end":   {"dateTime": end.isoformat(),   "timeZone": "Asia/Kolkata"},
        }
        if interview_row.meeting_link:
            event["location"] = interview_row.meeting_link
        if candidate and candidate.email:
            event["attendees"] = [{"email": candidate.email}]

        created = service.events().insert(calendarId="primary", body=event, sendUpdates="all").execute()
        logger.info("[GCAL] Event created: %s", created.get("id"))

        # Persist refreshed token if it was auto-refreshed
        if creds.token != creds_data.get("token"):
            token_row.token = creds.to_json()
            db.commit()

    except Exception as exc:
        logger.warning("[GCAL] Could not push interview to Google Calendar (non-fatal): %s", exc)


def _get_employer_interview(application_id: str, interview_id: str, user: User, db: Session) -> CandidateInterviewFeedback:
    app = _get_employer_application(application_id, user, db)
    row = db.query(CandidateInterviewFeedback).filter(
        CandidateInterviewFeedback.id == interview_id, CandidateInterviewFeedback.application_id == app.id,
    ).first()
    if not row:
        raise NotFoundException("Interview not found.")
    return row


def get_interview_ics(application_id: str, interview_id: str, user: User, db: Session) -> str:
    """Lets the recruiter download the same calendar invite that was emailed
    to the candidate — useful for adding it to their own calendar, or
    resending if the original email landed in spam."""
    row = _get_employer_interview(application_id, interview_id, user, db)
    if not row.scheduled_at:
        raise BadRequestException("This interview has no scheduled time.")

    app = db.query(Application).filter(Application.id == row.application_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first() if app else None
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    candidate = db.query(User).filter(User.id == app.aspirant_id).first() if app else None

    from app.core.calendar import build_interview_ics
    return build_interview_ics(
        uid=f"interview-{row.id}@beginablai.in",
        summary=f"Interview: {job.title if job else 'Candidate'} at {employer.company_name if employer else ''}",
        description=f"Interview for {job.title if job else 'a role'}." + (f"\nJoin: {row.meeting_link}" if row.meeting_link else ""),
        scheduled_at=row.scheduled_at,
        location=row.meeting_link,
        organizer_email=user.email,
        attendee_email=candidate.email if candidate else None,
    )


def submit_interview_feedback(
    application_id: str, interview_id: str, recommendation: str | None, feedback: str | None,
    user: User, db: Session,
) -> InterviewFeedbackOut:
    row = _get_employer_interview(application_id, interview_id, user, db)
    row.recommendation = recommendation
    row.feedback = feedback
    row.status = "completed"

    app = db.query(Application).filter(Application.id == row.application_id).first()
    if app:
        _advance_status_if_earlier(app, "interview_completed", user, db)
    db.commit()
    db.refresh(row)
    return _interview_to_out(row, user, db)


def cancel_interview(application_id: str, interview_id: str, user: User, db: Session) -> InterviewFeedbackOut:
    row = _get_employer_interview(application_id, interview_id, user, db)
    row.status = "canceled"
    db.commit()
    db.refresh(row)
    return _interview_to_out(row, user, db)


def list_upcoming_interviews(user: User, db: Session, limit: int = 20) -> list["UpcomingInterviewEntry"]:
    from datetime import datetime, timezone
    from app.models.user import AspirantProfile as _AspirantProfile

    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)

    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    rows = (
        db.query(CandidateInterviewFeedback, Application, JobPosting, User)
        .join(Application, CandidateInterviewFeedback.application_id == Application.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .outerjoin(User, CandidateInterviewFeedback.interviewer_id == User.id)
        .filter(
            Application.job_id.in_(job_ids),
            CandidateInterviewFeedback.status == "scheduled",
            CandidateInterviewFeedback.scheduled_at >= datetime.now(timezone.utc),
        )
        .order_by(CandidateInterviewFeedback.scheduled_at)
        .limit(limit)
        .all()
    )

    aspirant_ids = [a.aspirant_id for _, a, _, _ in rows]
    names: dict = {}
    if aspirant_ids:
        for profile in db.query(_AspirantProfile).filter(_AspirantProfile.user_id.in_(aspirant_ids)).all():
            names[profile.user_id] = profile.full_name

    return [
        UpcomingInterviewEntry(
            id=str(interview.id), application_id=str(app.id),
            candidate_name=names.get(app.aspirant_id), job_id=str(job.id), job_title=job.title,
            scheduled_at=interview.scheduled_at, meeting_link=interview.meeting_link,
            interviewer_name=(interviewer.email or interviewer.phone) if interviewer else None,
        )
        for interview, app, job, interviewer in rows
    ]


# ── Employer analytics (Module 05 Phase 5) ────────────────────────────────────

FUNNEL_STAGE_ORDER = (
    "applied", "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "hired",
)


def get_employer_funnel(user: User, db: Session) -> EmployerFunnelResponse:
    """Company-wide application funnel — counts at each stage are cumulative
    'reached this stage or beyond', not just currently-sitting-there counts,
    so the funnel reads as a conversion drop-off rather than a live snapshot."""
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)

    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application.status)
        .filter(Application.job_id.in_(job_ids))
        .all()
    )
    total = len(apps)
    status_counts: dict[str, int] = {}
    for (status,) in apps:
        status_counts[status] = status_counts.get(status, 0) + 1

    # "Reached stage N" = sum of counts for stage N and every stage after it in the pipeline.
    reached: dict[str, int] = {}
    for i, stage in enumerate(FUNNEL_STAGE_ORDER):
        reached[stage] = sum(status_counts.get(s, 0) for s in FUNNEL_STAGE_ORDER[i:])

    stages = [
        EmployerFunnelStage(
            stage=stage, count=reached[stage],
            pct_of_total=round(reached[stage] / total * 100, 1) if total else 0.0,
        )
        for stage in FUNNEL_STAGE_ORDER
    ]
    return EmployerFunnelResponse(total_applications=total, stages=stages)


def get_job_performance(user: User, db: Session) -> JobPerformanceResponse:
    """Per-job application breakdown — views aren't tracked yet, so this
    covers applications/shortlist/interview/hire/conversion only."""
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)

    scoped_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.id.in_(scoped_ids))
        .order_by(JobPosting.created_at.desc())
        .all()
    )
    job_ids = [j.id for j in jobs]
    apps_by_job: dict = {}
    if job_ids:
        rows = db.query(Application.job_id, Application.status).filter(Application.job_id.in_(job_ids)).all()
        for job_id, status in rows:
            apps_by_job.setdefault(job_id, []).append(status)

    entries = []
    for job in jobs:
        statuses = apps_by_job.get(job.id, [])
        total = len(statuses)
        shortlisted = sum(1 for s in statuses if s in ("shortlisted", "interview_scheduled", "interview_completed", "offer_sent", "hired"))
        interviewed = sum(1 for s in statuses if s in ("interview_completed", "offer_sent", "hired"))
        hired = sum(1 for s in statuses if s == "hired")
        rejected = sum(1 for s in statuses if s == "rejected")
        entries.append(JobPerformanceEntry(
            job_id=str(job.id), title=job.title, is_active=job.is_active,
            total_applications=total, shortlisted=shortlisted, interviewed=interviewed,
            hired=hired, rejected=rejected,
            conversion_rate_pct=round(hired / total * 100, 1) if total else 0.0,
            created_at=job.created_at,
        ))
    return JobPerformanceResponse(jobs=entries)


def get_recruiter_performance(user: User, db: Session) -> RecruiterPerformanceResponse:
    """Per-teammate activity across the company's jobs — there was previously
    no way to see whether a recruiter seat was actually being used. Built
    entirely from existing audit tables (status_history, notes, interview
    feedback); no new model needed.
    """
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)

    team = (
        db.query(EmployerProfile.user_id)
        .filter(EmployerProfile.id.in_(company_employer_ids))
        .all()
    )
    team_user_ids = [t[0] for t in team]
    if not team_user_ids:
        return RecruiterPerformanceResponse(recruiters=[])

    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    entries: list[RecruiterPerformanceEntry] = []
    for uid in team_user_ids:
        member = db.query(User).filter(User.id == uid).first()
        if not member:
            continue

        moved = (
            db.query(ApplicationStatusHistory)
            .join(Application, ApplicationStatusHistory.application_id == Application.id)
            .filter(ApplicationStatusHistory.changed_by == uid, Application.job_id.in_(job_ids))
            .count() if job_ids else 0
        )
        interviews = (
            db.query(CandidateInterviewFeedback)
            .join(Application, CandidateInterviewFeedback.application_id == Application.id)
            .filter(CandidateInterviewFeedback.interviewer_id == uid, Application.job_id.in_(job_ids))
            .count() if job_ids else 0
        )
        notes = (
            db.query(CandidateNote)
            .join(Application, CandidateNote.application_id == Application.id)
            .filter(CandidateNote.author_id == uid, Application.job_id.in_(job_ids))
            .count() if job_ids else 0
        )

        hire_events = []
        if job_ids:
            hire_events = (
                db.query(ApplicationStatusHistory.created_at, Application.created_at)
                .join(Application, ApplicationStatusHistory.application_id == Application.id)
                .filter(
                    ApplicationStatusHistory.changed_by == uid,
                    ApplicationStatusHistory.to_status == "hired",
                    Application.job_id.in_(job_ids),
                )
                .all()
            )
        hires_closed = len(hire_events)
        avg_days_to_hire = None
        if hire_events:
            total_days = sum((hired_at - applied_at).total_seconds() / 86400 for hired_at, applied_at in hire_events)
            avg_days_to_hire = round(total_days / len(hire_events), 1)

        entries.append(RecruiterPerformanceEntry(
            user_id=str(uid),
            name=member.full_name or member.email or member.phone,
            applications_moved=moved, interviews_conducted=interviews,
            notes_added=notes, hires_closed=hires_closed, avg_days_to_hire=avg_days_to_hire,
        ))

    entries.sort(key=lambda e: e.hires_closed, reverse=True)
    return RecruiterPerformanceResponse(recruiters=entries)


# ── Dashboard KPIs (Module 05 Phase 8) ─────────────────────────────────────────

RESPONDED_STATUSES = (
    "screening", "shortlisted",
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "interview_scheduled", "interview_completed",
    "offer_sent", "offer_declined", "hired", "rejected",
)


def get_dashboard_kpis(user: User, db: Session) -> DashboardKpis:
    from datetime import datetime, timezone, timedelta

    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)

    jobs_q = db.query(JobPosting.status, JobPosting.id).filter(
        JobPosting.employer_id.in_(company_employer_ids)
    )
    jobs_q = _scope_jobs_query(jobs_q, employer, user.role_name)
    jobs_rows = jobs_q.all()

    job_status_counts: dict[str, int] = {}
    job_ids = []
    for status, jid in jobs_rows:
        job_status_counts[status] = job_status_counts.get(status, 0) + 1
        job_ids.append(jid)

    if not job_ids:
        return DashboardKpis(
            active_jobs=0, draft_jobs=0, paused_jobs=0, closed_jobs=0, archived_jobs=0,
            applications_today=0, total_applications=0, interviews_scheduled=0,
            offers_sent=0, hires=0, response_rate_pct=0.0, avg_time_to_hire_days=None,
        )

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    apps = db.query(Application.status, Application.created_at).filter(Application.job_id.in_(job_ids)).all()
    total_applications = len(apps)
    applications_today = sum(1 for _, created_at in apps if created_at and created_at >= today_start)
    interviews_scheduled = sum(1 for status, _ in apps if status == "interview_scheduled")
    offers_sent = sum(1 for status, _ in apps if status in ("offer_sent", "hired"))
    hires = sum(1 for status, _ in apps if status == "hired")
    rejected_count = sum(1 for status, _ in apps if status == "rejected")
    responded = sum(1 for status, _ in apps if status in RESPONDED_STATUSES)
    response_rate_pct = round(responded / total_applications * 100, 1) if total_applications else 0.0

    # Average time-to-hire: created_at -> the timestamp of the 'hired' transition,
    # computed from ApplicationStatusHistory (the source of truth for transition times).
    hired_durations = (
        db.query(Application.created_at, ApplicationStatusHistory.created_at)
        .join(ApplicationStatusHistory, ApplicationStatusHistory.application_id == Application.id)
        .filter(Application.job_id.in_(job_ids), ApplicationStatusHistory.to_status == "hired")
        .all()
    )
    avg_time_to_hire_days = None
    if hired_durations:
        days = [(hired_at - applied_at).total_seconds() / 86400 for applied_at, hired_at in hired_durations]
        avg_time_to_hire_days = round(sum(days) / len(days), 1)

    return DashboardKpis(
        active_jobs=job_status_counts.get("published", 0),
        draft_jobs=job_status_counts.get("draft", 0),
        paused_jobs=job_status_counts.get("paused", 0),
        closed_jobs=job_status_counts.get("closed", 0),
        archived_jobs=job_status_counts.get("archived", 0),
        applications_today=applications_today,
        total_applications=total_applications,
        interviews_scheduled=interviews_scheduled,
        offers_sent=offers_sent,
        hires=hires,
        rejected_count=rejected_count,
        response_rate_pct=response_rate_pct,
        avg_time_to_hire_days=avg_time_to_hire_days,
    )


def get_application_trend(user: User, db: Session, days: int = 30) -> ApplicationTrendResponse:
    from datetime import datetime, timezone, timedelta

    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    job_ids = _get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    counts_by_day: dict[str, int] = {}
    if job_ids:
        rows = (
            db.query(func.date_trunc("day", Application.created_at), func.count())
            .filter(Application.job_id.in_(job_ids), Application.created_at >= start)
            .group_by(func.date_trunc("day", Application.created_at))
            .all()
        )
        counts_by_day = {day.date().isoformat(): count for day, count in rows}

    series = [
        ApplicationTrendPoint(date=(start + timedelta(days=i)).date().isoformat(),
                               count=counts_by_day.get((start + timedelta(days=i)).date().isoformat(), 0))
        for i in range(days)
    ]
    return ApplicationTrendResponse(days=days, series=series)
