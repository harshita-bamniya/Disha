import ipaddress
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import Request
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.employer_verification import (
    EmployerVerification, EmployerVerificationDocument, EmployerVerificationEvent,
)
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import (
    AspirantProfile, AuditLog, CareerTrack, DeviceSession, EmployerProfile, JobPosting,
    KrsScore, LoginHistory, Permission, PsychologicalAssessment, Role,
    RolePermission, User, UserCareerSelection,
)
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
    AnnouncementCreateRequest,
    AnnouncementEntry,
    AnnouncementUpdateRequest,
    AuditLogEntry,
    AuditLogPage,
    AdminJobEntry,
    AdminStatsResponse,
    AspirantCareerPreferences,
    AspirantDetailResponse,
    AspirantEducation,
    AspirantKrsDetail,
    AspirantPsychProfile,
    AspirantSelectedTrack,
    AspirantUpscJourney,
    AspirantUserEntry,
    AspirantWorkExperience,
    BillingOverviewResponse,
    CareerTrackAdminEntry,
    GlobalSearchResponse,
    GlobalSearchResult,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    DeviceSessionEntry,
    EmployerDetailResponse,
    EmployerJobEntry,
    EmployerTeamMemberEntry,
    EmployerVerificationDetail,
    EmployerVerificationEntry,
    LoginHistoryEntry,
    MessageResponse,
    PendingEmployerResponse,
    PermissionEntry,
    PlanRevenueEntry,
    PLATFORM_ROLE_NAMES,
    RevenueTrendPoint,
    RoleEntry,
    SubAdminCreateRequest,
    SubAdminEntry,
    SubscriptionPlanAdminEntry,
    SubscriptionPlanUpdateRequest,
    UserManagementEntry,
    VerificationDocumentEntry,
    VerificationEventEntry,
    AdminJobDetailResponse,
    EmployerJobsResponse,
)


def _safe_ip(host: str | None) -> str | None:
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return None


def _write_audit(
    db: Session, actor_id: str | None, action: str, resource: str | None = None,
    resource_id: str | None = None, previous_value: dict | None = None, new_value: dict | None = None,
    request: Request | None = None,
) -> None:
    """Records a moderation action for the audit log viewer. Caller still owns db.commit()."""
    ip: str | None = None
    if request:
        forwarded = request.headers.get("X-Forwarded-For")
        raw = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
        ip = _safe_ip(raw)
    db.add(AuditLog(
        user_id=uuid.UUID(actor_id) if actor_id else None,
        action=action, resource=resource,
        resource_id=uuid.UUID(resource_id) if resource_id else None,
        previous_value=previous_value, new_value=new_value,
        ip_address=ip,
    ))


def _employer_to_response(profile: EmployerProfile, user: User, job_count: int = 0, app_count: int = 0) -> PendingEmployerResponse:
    return PendingEmployerResponse(
        id=str(profile.id),
        user_id=str(user.id),
        company_name=profile.company_name,
        industry=profile.industry,
        company_size=profile.company_size,
        website=profile.website,
        gst_number=profile.gst_number,
        contact_person=profile.contact_person,
        designation=profile.designation,
        city=profile.city,
        description=profile.description,
        phone=user.phone,
        phone_verified=user.phone_verified,
        is_approved=profile.is_approved,
        rejection_reason=profile.rejection_reason,
        registered_at=profile.created_at,
        job_count=job_count,
        application_count=app_count,
    )


def list_employers(db: Session, status: str = "pending", limit: int = 100, offset: int = 0) -> list[PendingEmployerResponse]:
    """Return employers filtered by status: pending | approved | all."""
    from app.models.mvp3 import Application

    query = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(User.deleted_at == None)
    )

    if status == "pending":
        query = query.filter(
            EmployerProfile.is_approved == False,
            User.phone_verified == True,
        )
    elif status == "approved":
        query = query.filter(EmployerProfile.is_approved == True)

    query = query.order_by(EmployerProfile.created_at.desc())
    rows = query.offset(offset).limit(limit).all()

    # Batch-fetch job counts + application counts
    emp_ids = [str(p.id) for p, _ in rows]
    job_counts: dict[str, int] = {}
    app_counts: dict[str, int] = {}
    if emp_ids:
        jc_rows = (
            db.query(JobPosting.employer_id, func.count(JobPosting.id))
            .filter(JobPosting.employer_id.in_(emp_ids))
            .group_by(JobPosting.employer_id)
            .all()
        )
        job_counts = {str(r[0]): r[1] for r in jc_rows}

        # Application counts via job_id → employer
        job_ids_per_emp: dict[str, list] = {}
        for jid, eid in db.query(JobPosting.id, JobPosting.employer_id).filter(JobPosting.employer_id.in_(emp_ids)).all():
            job_ids_per_emp.setdefault(str(eid), []).append(jid)

        all_job_ids = [jid for jlist in job_ids_per_emp.values() for jid in jlist]
        if all_job_ids:
            ac_rows = (
                db.query(Application.job_id, func.count(Application.id))
                .filter(Application.job_id.in_(all_job_ids))
                .group_by(Application.job_id)
                .all()
            )
            for jid, cnt in ac_rows:
                for eid, jlist in job_ids_per_emp.items():
                    if jid in jlist:
                        app_counts[eid] = app_counts.get(eid, 0) + cnt

    return [
        _employer_to_response(
            profile, user,
            job_count=job_counts.get(str(profile.id), 0),
            app_count=app_counts.get(str(profile.id), 0),
        )
        for profile, user in rows
    ]


    # approve_employer / reject_employer were removed — they used to flip
    # profile.is_approved directly, completely bypassing the KYC document
    # review, which let an admin grant job-posting access with zero documents
    # checked. The KYC verification queue (review_employer_verification,
    # further down) is now the only path that sets is_approved=True.


def revoke_employer(profile_id: str, admin_user_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    """Revoke a previously approved employer — disables their login."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")
    user = db.query(User).filter(User.id == profile.user_id).first()

    profile.is_approved = False
    profile.rejection_reason = "Approval revoked by admin."
    if user:
        user.is_active = False

    _write_audit(db, admin_user_id, "employer.revoked", resource="employer_profile",
                 resource_id=str(profile.id), previous_value={"is_approved": True}, new_value={"is_approved": False},
                 request=request)
    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' approval revoked.")


def get_stats(db: Session) -> AdminStatsResponse:
    from app.models.mvp3 import Application
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    total_aspirants = db.query(AspirantProfile).count()
    completed_onboarding = db.query(AspirantProfile).filter(AspirantProfile.is_completed == True).count()
    total_employers = db.query(EmployerProfile).count()
    pending_employers = (
        db.query(EmployerProfile)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(EmployerProfile.is_approved == False, User.phone_verified == True)
        .count()
    )
    approved_employers = db.query(EmployerProfile).filter(EmployerProfile.is_approved == True).count()
    total_job_postings = db.query(JobPosting).count()
    active_job_postings = db.query(JobPosting).filter(JobPosting.is_active == True).count()
    total_applications = db.query(Application).count()
    hired_count = db.query(Application).filter(Application.status == "hired").count()
    new_users_last_7d = (
        db.query(User)
        .filter(User.created_at >= seven_days_ago, User.deleted_at == None)
        .count()
    )
    new_jobs_last_7d = (
        db.query(JobPosting)
        .filter(JobPosting.created_at >= seven_days_ago)
        .count()
    )

    avg_row = db.query(func.avg(KrsScore.composite)).scalar()
    avg_krs = round(float(avg_row), 1) if avg_row else None

    return AdminStatsResponse(
        total_aspirants=total_aspirants,
        completed_onboarding=completed_onboarding,
        total_employers=total_employers,
        pending_employers=pending_employers,
        approved_employers=approved_employers,
        total_job_postings=total_job_postings,
        active_job_postings=active_job_postings,
        total_applications=total_applications,
        new_users_last_7d=new_users_last_7d,
        new_jobs_last_7d=new_jobs_last_7d,
        avg_krs_composite=avg_krs,
        hired_count=hired_count,
    )


# ── Aspirant user management ──────────────────────────────────────────────────

def list_aspirants(db: Session, search: str | None = None, limit: int = 100, offset: int = 0) -> list[AspirantUserEntry]:
    from app.models.mvp3 import Application

    query = (
        db.query(User, AspirantProfile, KrsScore)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .outerjoin(KrsScore, KrsScore.user_id == User.id)
        .filter(User.deleted_at == None)
    )

    if search:
        query = query.filter(
            or_(
                User.phone.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                AspirantProfile.full_name.ilike(f"%{search}%"),
                AspirantProfile.city.ilike(f"%{search}%"),
            )
        )

    query = query.filter(
        ~User.id.in_(
            db.query(User.id).join(User.employer_profile)
        )
    )

    rows = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    # Batch application counts
    user_ids = [str(user.id) for user, _, _ in rows]
    app_counts: dict[str, int] = {}
    if user_ids:
        ac_rows = (
            db.query(Application.aspirant_id, func.count(Application.id))
            .filter(Application.aspirant_id.in_(user_ids))
            .group_by(Application.aspirant_id)
            .all()
        )
        app_counts = {str(r[0]): r[1] for r in ac_rows}

    result = []
    for user, profile, krs in rows:
        result.append(AspirantUserEntry(
            user_id=str(user.id),
            phone=user.phone,
            email=user.email,
            full_name=profile.full_name if profile else None,
            city=profile.city if profile else None,
            state=profile.state if profile else None,
            is_completed=profile.is_completed if profile else False,
            current_step=profile.current_step if profile else 1,
            is_active=user.is_active,
            krs_composite=krs.composite if krs else None,
            k_score=krs.k_score if krs else None,
            r_score=krs.r_score if krs else None,
            s_score=krs.s_score if krs else None,
            registered_at=user.created_at,
            application_count=app_counts.get(str(user.id), 0),
        ))
    return result


def deactivate_user(user_id: str, db: Session) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    user.is_active = False
    db.commit()
    return MessageResponse(message="User deactivated.")


def reactivate_user(user_id: str, db: Session) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    user.is_active = True
    db.commit()
    return MessageResponse(message="User reactivated.")


# ── Career track management ───────────────────────────────────────────────────

def list_career_tracks_admin(db: Session) -> list[CareerTrackAdminEntry]:
    tracks = db.query(CareerTrack).order_by(CareerTrack.title).all()

    # Batch aspirant counts
    counts_rows = (
        db.query(UserCareerSelection.track_id, func.count(UserCareerSelection.user_id))
        .group_by(UserCareerSelection.track_id)
        .all()
    )
    counts = {str(r[0]): r[1] for r in counts_rows}

    return [
        CareerTrackAdminEntry(
            id=str(t.id),
            slug=t.slug,
            title=t.title,
            description=t.description,
            sector=t.sector,
            required_skills=t.required_skills or [],
            min_k_score=t.min_k_score,
            salary_range=t.salary_range,
            growth_outlook=t.growth_outlook,
            example_roles=t.example_roles or [],
            created_at=t.created_at,
            aspirant_count=counts.get(str(t.id), 0),
        )
        for t in tracks
    ]


def create_career_track(data: CareerTrackCreateRequest, db: Session) -> CareerTrackAdminEntry:
    existing = db.query(CareerTrack).filter(CareerTrack.slug == data.slug).first()
    if existing:
        raise ValueError(f"A track with slug '{data.slug}' already exists.")

    track = CareerTrack(
        slug=data.slug,
        title=data.title,
        description=data.description,
        sector=data.sector,
        required_skills=data.required_skills,
        min_k_score=data.min_k_score,
        salary_range=data.salary_range,
        growth_outlook=data.growth_outlook,
        example_roles=data.example_roles,
    )
    db.add(track)
    db.commit()
    db.refresh(track)

    return CareerTrackAdminEntry(
        id=str(track.id), slug=track.slug, title=track.title, description=track.description,
        sector=track.sector, required_skills=track.required_skills or [], min_k_score=track.min_k_score,
        salary_range=track.salary_range, growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [], created_at=track.created_at,
    )


def update_career_track(track_id: str, data: CareerTrackUpdateRequest, db: Session) -> CareerTrackAdminEntry:
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise NotFoundException("Career track not found.")

    for field in ("title", "description", "sector", "required_skills", "min_k_score",
                  "salary_range", "growth_outlook", "example_roles"):
        val = getattr(data, field)
        if val is not None:
            setattr(track, field, val)

    db.commit()
    db.refresh(track)

    return CareerTrackAdminEntry(
        id=str(track.id), slug=track.slug, title=track.title, description=track.description,
        sector=track.sector, required_skills=track.required_skills or [], min_k_score=track.min_k_score,
        salary_range=track.salary_range, growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [], created_at=track.created_at,
    )


def delete_career_track(track_id: str, db: Session) -> MessageResponse:
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise NotFoundException("Career track not found.")
    title = track.title
    db.delete(track)
    db.commit()
    return MessageResponse(message=f"'{title}' deleted.")


# ── Aspirant detail ───────────────────────────────────────────────────────────

def get_aspirant_detail(user_id: str, db: Session) -> AspirantDetailResponse:
    from app.models.mvp3 import Application

    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user_id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user_id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == user_id).first()
    selections = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user_id).all()
    app_count = db.query(func.count(Application.id)).filter(Application.aspirant_id == user_id).scalar() or 0

    return AspirantDetailResponse(
        user_id=str(user.id),
        phone=user.phone,
        email=user.email,
        is_active=user.is_active,
        registered_at=user.created_at,
        last_login_at=user.last_login_at,
        full_name=profile.full_name if profile else None,
        date_of_birth=profile.date_of_birth if profile else None,
        gender=profile.gender if profile else None,
        city=profile.city if profile else None,
        state=profile.state if profile else None,
        is_completed=profile.is_completed if profile else False,
        current_step=profile.current_step if profile else 1,
        disha_insight=profile.disha_insight if profile else None,
        education=AspirantEducation(
            highest_qualification=profile.highest_qualification,
            degree=profile.degree,
            field_of_study=profile.field_of_study,
            institution=profile.institution,
            graduation_year=profile.graduation_year,
        ) if profile else None,
        upsc_journey=AspirantUpscJourney(
            upsc_exam=profile.upsc_exam,
            years_preparing=profile.years_preparing,
            upsc_attempts=profile.upsc_attempts,
            highest_stage_cleared=profile.highest_stage_cleared,
            optional_subject=profile.optional_subject,
        ) if profile else None,
        work_experience=AspirantWorkExperience(
            has_work_experience=profile.has_work_experience,
            work_experience_years=profile.work_experience_years,
            work_experience_domain=profile.work_experience_domain,
            last_designation=profile.last_designation,
        ) if profile else None,
        skills=profile.skills if profile else None,
        career_preferences=AspirantCareerPreferences(
            preferred_sectors=profile.preferred_sectors,
            preferred_locations=profile.preferred_locations,
            open_to_relocation=profile.open_to_relocation,
            expected_salary_min=profile.expected_salary_min,
            expected_salary_max=profile.expected_salary_max,
        ) if profile else None,
        psychological_profile=AspirantPsychProfile(
            burnout_score=psych.burnout_score,
            confidence_index=psych.confidence_index,
        ) if psych else None,
        krs=AspirantKrsDetail(
            k_score=krs.k_score,
            r_score=krs.r_score,
            s_score=krs.s_score,
            composite=krs.composite,
            computed_at=krs.computed_at,
        ) if krs else None,
        selected_tracks=[
            AspirantSelectedTrack(
                track_id=str(sel.track_id),
                title=sel.track.title if sel.track else "Unknown",
                sector=sel.track.sector if sel.track else "—",
                selected_at=sel.selected_at,
            )
            for sel in selections
        ],
        total_applications=app_count,
    )


# ── Admin: Jobs management ────────────────────────────────────────────────────

def list_admin_jobs(db: Session, search: str | None = None, active_only: bool = False) -> list[AdminJobEntry]:
    from app.models.mvp3 import Application

    query = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
    )
    if active_only:
        query = query.filter(JobPosting.is_active == True)
    if search:
        query = query.filter(
            or_(
                JobPosting.title.ilike(f"%{search}%"),
                EmployerProfile.company_name.ilike(f"%{search}%"),
                JobPosting.sector.ilike(f"%{search}%"),
            )
        )
    rows = query.order_by(JobPosting.created_at.desc()).all()

    # Batch applicant counts
    job_ids = [str(j.id) for j, _ in rows]
    counts: dict[str, int] = {}
    if job_ids:
        cnt_rows = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        counts = {str(r[0]): r[1] for r in cnt_rows}

    return [
        AdminJobEntry(
            id=str(j.id),
            title=j.title,
            company_name=e.company_name,
            employer_id=str(j.employer_id),
            sector=j.sector,
            location=j.location,
            employment_type=j.employment_type,
            salary_min=j.salary_min,
            salary_max=j.salary_max,
            is_active=j.is_active,
            applicant_count=counts.get(str(j.id), 0),
            created_at=j.created_at,
            expires_at=j.expires_at,
        )
        for j, e in rows
    ]


def toggle_admin_job(job_id: str, db: Session) -> AdminJobEntry:
    from app.models.mvp3 import Application

    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found.")
    emp = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
    job.is_active = not job.is_active
    db.commit()
    db.refresh(job)
    app_count = db.query(func.count(Application.id)).filter(Application.job_id == job_id).scalar() or 0
    return AdminJobEntry(
        id=str(job.id), title=job.title,
        company_name=emp.company_name if emp else "—",
        employer_id=str(job.employer_id),
        sector=job.sector, location=job.location, employment_type=job.employment_type,
        salary_min=job.salary_min, salary_max=job.salary_max,
        is_active=job.is_active, applicant_count=app_count,
        created_at=job.created_at, expires_at=job.expires_at,
    )


def delete_admin_job(job_id: str, db: Session) -> MessageResponse:
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found.")
    title = job.title
    db.delete(job)
    db.commit()
    return MessageResponse(message=f"'{title}' deleted.")


def get_admin_job_detail(job_id: str, db: Session) -> AdminJobDetailResponse:
    from app.models.mvp3 import Application
    from app.models.user import JobPosting, EmployerProfile

    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found.")
    emp = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
    app_count = db.query(func.count(Application.id)).filter(Application.job_id == job_id).scalar() or 0

    dept_name: str | None = None
    if job.department_id:
        from app.models.company import CompanyDepartment
        dept = db.query(CompanyDepartment).filter(CompanyDepartment.id == job.department_id).first()
        dept_name = dept.name if dept else None

    return AdminJobDetailResponse(
        id=str(job.id),
        title=job.title,
        company_name=emp.company_name if emp else "—",
        employer_id=str(job.employer_id),
        sector=job.sector,
        location=job.location,
        employment_type=job.employment_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        is_active=job.is_active,
        applicant_count=app_count,
        created_at=job.created_at,
        expires_at=job.expires_at,
        description=job.description,
        required_skills=job.required_skills or [],
        min_k_score=job.min_k_score or 0,
        job_type=job.job_type,
        growth_outlook=job.growth_outlook,
        status=job.status,
        department_id=str(job.department_id) if job.department_id else None,
        department_name=dept_name,
        updated_at=job.updated_at,
    )


def list_employer_jobs_admin(
    employer_id: str,
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> EmployerJobsResponse:
    from app.models.mvp3 import Application

    query = db.query(JobPosting).filter(JobPosting.employer_id == employer_id)
    if active_only:
        query = query.filter(JobPosting.is_active == True)
    if search:
        query = query.filter(JobPosting.title.ilike(f"%{search}%"))

    total = query.count()
    jobs = query.order_by(JobPosting.created_at.desc()).offset(offset).limit(limit).all()

    job_ids = [str(j.id) for j in jobs]
    counts: dict[str, int] = {}
    if job_ids:
        cnt_rows = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        counts = {str(r[0]): r[1] for r in cnt_rows}

    items = [
        EmployerJobEntry(
            id=str(j.id),
            title=j.title,
            sector=j.sector,
            location=j.location,
            is_active=j.is_active,
            applicant_count=counts.get(str(j.id), 0),
            created_at=j.created_at,
        )
        for j in jobs
    ]
    return EmployerJobsResponse(total=total, items=items)


def list_job_applications(
    job_id: str,
    db: Session,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AdminApplicationEntry]:
    from app.models.mvp3 import Application
    query = (
        db.query(Application, User, AspirantProfile, JobPosting, EmployerProfile)
        .join(User, Application.aspirant_id == User.id)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(Application.job_id == job_id)
    )
    if status:
        query = query.filter(Application.status == status)
    rows = query.order_by(Application.created_at.desc()).limit(limit).offset(offset).all()
    return [
        AdminApplicationEntry(
            id=str(app.id),
            aspirant_name=profile.full_name if profile else None,
            aspirant_phone=user.phone,
            aspirant_id=str(app.aspirant_id),
            job_title=job.title,
            company_name=emp.company_name,
            job_id=str(app.job_id),
            status=app.status,
            match_score=app.match_score,
            applied_at=app.created_at,
        )
        for app, user, profile, job, emp in rows
    ]


def list_candidate_applications(
    user_id: str,
    db: Session,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AdminApplicationEntry]:
    from app.models.mvp3 import Application
    query = (
        db.query(Application, User, AspirantProfile, JobPosting, EmployerProfile)
        .join(User, Application.aspirant_id == User.id)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(Application.aspirant_id == user_id)
    )
    if status:
        query = query.filter(Application.status == status)
    rows = query.order_by(Application.created_at.desc()).limit(limit).offset(offset).all()
    return [
        AdminApplicationEntry(
            id=str(app.id),
            aspirant_name=profile.full_name if profile else None,
            aspirant_phone=user.phone,
            aspirant_id=str(app.aspirant_id),
            job_title=job.title,
            company_name=emp.company_name,
            job_id=str(app.job_id),
            status=app.status,
            match_score=app.match_score,
            applied_at=app.created_at,
        )
        for app, user, profile, job, emp in rows
    ]


# ── Admin: Applications ───────────────────────────────────────────────────────

def list_admin_applications(
    db: Session,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AdminApplicationEntry]:
    from app.models.mvp3 import Application

    query = (
        db.query(Application, User, AspirantProfile, JobPosting, EmployerProfile)
        .join(User, Application.aspirant_id == User.id)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
    )
    if status:
        query = query.filter(Application.status == status)
    if search:
        query = query.filter(
            or_(
                AspirantProfile.full_name.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
                JobPosting.title.ilike(f"%{search}%"),
                EmployerProfile.company_name.ilike(f"%{search}%"),
            )
        )

    rows = query.order_by(Application.created_at.desc()).limit(limit).offset(offset).all()

    return [
        AdminApplicationEntry(
            id=str(app.id),
            aspirant_name=profile.full_name if profile else None,
            aspirant_phone=user.phone,
            aspirant_id=str(app.aspirant_id),
            job_title=job.title,
            company_name=emp.company_name,
            job_id=str(app.job_id),
            status=app.status,
            match_score=app.match_score,
            applied_at=app.created_at,
        )
        for app, user, profile, job, emp in rows
    ]


# ── Admin: Activity feed ──────────────────────────────────────────────────────

def get_activity_feed(db: Session, limit: int = 25) -> list[AdminActivityItem]:
    from app.models.mvp3 import Application

    items: list[AdminActivityItem] = []

    # Recent signups (aspirants only)
    recent_users = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            ~User.id.in_(db.query(User.id).join(User.employer_profile)),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    for user, profile in recent_users:
        name = profile.full_name if profile and profile.full_name else user.phone
        items.append(AdminActivityItem(
            type="signup",
            title=f"{name} joined",
            subtitle=f"{profile.city}, {profile.state}" if profile and profile.city else None,
            timestamp=user.created_at,
        ))

    # Recent applications
    recent_apps = (
        db.query(Application, AspirantProfile, JobPosting, EmployerProfile)
        .join(AspirantProfile, AspirantProfile.user_id == Application.aspirant_id, isouter=True)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .order_by(Application.created_at.desc())
        .limit(limit)
        .all()
    )
    for app, profile, job, emp in recent_apps:
        name = profile.full_name if profile and profile.full_name else "Aspirant"
        items.append(AdminActivityItem(
            type="application",
            title=f"{name} applied to {job.title}",
            subtitle=emp.company_name,
            timestamp=app.created_at,
        ))

    # Recent job postings
    recent_jobs = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .order_by(JobPosting.created_at.desc())
        .limit(limit // 2)
        .all()
    )
    for job, emp in recent_jobs:
        items.append(AdminActivityItem(
            type="job_posted",
            title=f"{emp.company_name} posted {job.title}",
            subtitle=job.sector,
            timestamp=job.created_at,
        ))

    # Sort all by timestamp descending, take top N
    items.sort(key=lambda x: x.timestamp, reverse=True)
    return items[:limit]


# ── RBAC: Roles & permission matrix ───────────────────────────────────────────

def list_permissions(db: Session) -> list[PermissionEntry]:
    perms = db.query(Permission).order_by(Permission.resource, Permission.action).all()
    return [
        PermissionEntry(id=str(p.id), resource=p.resource, action=p.action, description=p.description)
        for p in perms
    ]


def list_roles(db: Session) -> list[RoleEntry]:
    roles = db.query(Role).order_by(Role.name).all()

    user_counts = dict(
        db.query(User.role_id, func.count(User.id))
        .filter(User.deleted_at == None)
        .group_by(User.role_id)
        .all()
    )

    perms_by_role_id: dict = {}
    for role_id, resource, action in (
        db.query(RolePermission.role_id, Permission.resource, Permission.action)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id.in_([role.id for role in roles]))
        .all()
    ):
        perms_by_role_id.setdefault(role_id, []).append(f"{resource}:{action}")

    result = []
    for role in roles:
        result.append(RoleEntry(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=perms_by_role_id.get(role.id, []),
            user_count=user_counts.get(role.id, 0),
        ))
    return result


def create_role(data: "RoleCreateRequest", actor_id: str, db: Session, request: Request | None = None) -> RoleEntry:
    from app.modules.admin.schemas import RoleCreateRequest

    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise ValueError(f"A role named '{data.name}' already exists.")

    # Resolve permission IDs — start from clone source if requested
    permission_ids = list(data.permission_ids)
    if data.clone_from_id and not permission_ids:
        source_perms = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == data.clone_from_id)
            .all()
        )
        permission_ids = [str(p.id) for p in source_perms]

    # Privilege escalation guard: actor cannot grant permissions they don't hold.
    if permission_ids:
        actor = db.query(User).filter(User.id == uuid.UUID(actor_id)).first()
        if actor and actor.role_id:
            actor_perm_ids = {
                str(rp.permission_id)
                for rp in db.query(RolePermission).filter(RolePermission.role_id == actor.role_id).all()
            }
            forbidden = [pid for pid in permission_ids if pid not in actor_perm_ids]
            if forbidden:
                raise ForbiddenException(
                    "Cannot grant permissions that you do not hold yourself."
                )

    new_role = Role(name=data.name, description=data.description, is_system=False)
    db.add(new_role)
    db.flush()

    for pid in permission_ids:
        db.add(RolePermission(role_id=new_role.id, permission_id=uuid.UUID(pid)))

    _write_audit(db, actor_id, "role.created", resource="role", resource_id=str(new_role.id),
                 new_value={"name": data.name, "permission_count": len(permission_ids)}, request=request)
    db.commit()
    db.refresh(new_role)

    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == new_role.id)
        .all()
    )
    return RoleEntry(
        id=str(new_role.id), name=new_role.name, description=new_role.description,
        is_system=False, permissions=[f"{p.resource}:{p.action}" for p in perms], user_count=0,
    )


def delete_role(role_id: str, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found.")
    if role.is_system:
        raise ForbiddenException("System roles cannot be deleted.")

    user_count = db.query(User).filter(User.role_id == role.id, User.deleted_at == None).count()
    if user_count > 0:
        raise ValueError(f"Cannot delete role '{role.name}' — {user_count} user(s) are assigned to it. Reassign them first.")

    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    _write_audit(db, actor_id, "role.deleted", resource="role", resource_id=role_id,
                 previous_value={"name": role.name}, request=request)
    db.delete(role)
    db.commit()
    return MessageResponse(message=f"Role '{role.name}' deleted.")


def update_role_permissions(role_id: str, permission_ids: list[str], actor_id: str, db: Session, request: Request | None = None) -> RoleEntry:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found.")

    old_perms = [
        f"{p.resource}:{p.action}" for p in
        db.query(Permission).join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id).all()
    ]

    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    for pid in permission_ids:
        db.add(RolePermission(role_id=role.id, permission_id=uuid.UUID(pid)))

    _write_audit(db, actor_id, "role.permissions_updated", resource="role", resource_id=role_id,
                 previous_value={"permissions": old_perms}, new_value={"permission_ids": permission_ids}, request=request)
    db.commit()

    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role.id)
        .all()
    )
    return RoleEntry(
        id=str(role.id), name=role.name, description=role.description,
        is_system=role.is_system, permissions=[f"{p.resource}:{p.action}" for p in perms],
    )


# ── Sub-admin management (super_admin only) ───────────────────────────────────

def _platform_role_or_404(role_id: str, db: Session) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role or role.name not in PLATFORM_ROLE_NAMES:
        raise NotFoundException("Platform role not found.")
    return role


def list_sub_admins(db: Session) -> list[SubAdminEntry]:
    rows = (
        db.query(User, Role)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name.in_(PLATFORM_ROLE_NAMES), User.deleted_at == None)
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        SubAdminEntry(
            user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
            role_id=str(role.id), role_name=role.name,
            status=user.status, is_active=user.is_active,
            last_login_at=user.last_login_at, created_at=user.created_at,
        )
        for user, role in rows
    ]


def create_sub_admin(data: SubAdminCreateRequest, actor_id: str, db: Session, request: Request | None = None) -> SubAdminEntry:
    role = _platform_role_or_404(data.role_id, db)
    if role.name == "super_admin":
        raise ForbiddenException("super_admin cannot be assigned via this endpoint.")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ValueError(f"A user with email '{data.email}' already exists.")

    user = User(
        email=data.email,
        phone=data.phone,
        full_name=data.full_name,
        role_id=role.id,
        email_verified=True,   # admin-created accounts skip OTP verification
        is_active=True,
    )
    db.add(user)
    db.flush()

    _write_audit(db, actor_id, "sub_admin.created", resource="user", resource_id=str(user.id),
                 new_value={"email": data.email, "role": role.name}, request=request)
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def update_sub_admin_role(user_id: str, role_id: str, actor_id: str, db: Session, request: Request | None = None) -> SubAdminEntry:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    old_role_name = user.role_name
    role = _platform_role_or_404(role_id, db)

    user.role_id = role.id
    _write_audit(db, actor_id, "sub_admin.role_changed", resource="user", resource_id=user_id,
                 previous_value={"role": old_role_name}, new_value={"role": role.name}, request=request)
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def delete_sub_admin(user_id: str, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    if user.role_name not in PLATFORM_ROLE_NAMES:
        raise NotFoundException("User is not a platform sub-admin.")

    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    _write_audit(db, actor_id, "sub_admin.removed", resource="user", resource_id=user_id,
                 previous_value={"role": user.role_name}, request=request)
    db.commit()
    return MessageResponse(message="Sub-admin removed.")


# ── User management: status / login history / sessions ───────────────────────

def list_managed_users(db: Session, search: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0) -> list[UserManagementEntry]:
    query = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .outerjoin(Role, User.role_id == Role.id)
        .filter(User.deleted_at == None)
    )
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
                AspirantProfile.full_name.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.filter(User.status == status)

    rows = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return [
        UserManagementEntry(
            user_id=str(user.id), email=user.email, phone=user.phone,
            role_name=user.role_name, full_name=profile.full_name if profile else None,
            status=user.status, is_active=user.is_active,
            failed_login_attempts=user.failed_login_attempts,
            last_login_at=user.last_login_at, registered_at=user.created_at,
        )
        for user, profile in rows
    ]


def update_user_status(user_id: str, status: str, reason: str | None, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    if status not in ("active", "suspended", "banned"):
        raise ValueError("status must be one of: active, suspended, banned")

    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")

    prev_status = user.status
    user.status = status
    user.status_reason = reason
    user.status_changed_by = uuid.UUID(actor_id)
    user.status_changed_at = datetime.now(timezone.utc)
    user.is_active = (status == "active")

    _write_audit(db, actor_id, "user.status_changed", resource="user", resource_id=user_id,
                 previous_value={"status": prev_status}, new_value={"status": status, "reason": reason}, request=request)
    db.commit()
    return MessageResponse(message=f"User status set to '{status}'.")


def get_login_history(user_id: str, db: Session, limit: int = 50) -> list[LoginHistoryEntry]:
    rows = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        LoginHistoryEntry(
            id=str(r.id), ip_address=str(r.ip_address) if r.ip_address else None,
            user_agent=r.user_agent, device_label=r.device_label,
            success=r.success, failure_reason=r.failure_reason, created_at=r.created_at,
        )
        for r in rows
    ]


def get_device_sessions(user_id: str, db: Session) -> list[DeviceSessionEntry]:
    rows = (
        db.query(DeviceSession)
        .filter(DeviceSession.user_id == user_id, DeviceSession.revoked_at == None)
        .order_by(DeviceSession.last_seen_at.desc())
        .all()
    )
    return [
        DeviceSessionEntry(
            id=str(r.id), device_label=r.device_label,
            ip_address=str(r.ip_address) if r.ip_address else None,
            last_seen_at=r.last_seen_at, created_at=r.created_at,
        )
        for r in rows
    ]


# ── Employer KYC verification (admin/verification_officer side) ──────────────

def list_employer_verifications(db: Session, status: str | None = None) -> list[EmployerVerificationEntry]:
    query = (
        db.query(EmployerVerification, EmployerProfile)
        .join(EmployerProfile, EmployerVerification.employer_id == EmployerProfile.id)
    )
    if status:
        query = query.filter(EmployerVerification.status == status)
    rows = query.order_by(EmployerVerification.submitted_at.desc()).all()

    doc_counts = dict(
        db.query(EmployerVerificationDocument.verification_id, func.count(EmployerVerificationDocument.id))
        .group_by(EmployerVerificationDocument.verification_id)
        .all()
    )

    return [
        EmployerVerificationEntry(
            id=str(v.id), employer_id=str(v.employer_id), company_name=emp.company_name,
            status=v.status, rejection_reason=v.rejection_reason,
            submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
            document_count=doc_counts.get(v.id, 0),
        )
        for v, emp in rows
    ]


def get_employer_verification_detail(verification_id: str, db: Session) -> EmployerVerificationDetail:
    v = db.query(EmployerVerification).filter(EmployerVerification.id == verification_id).first()
    if not v:
        raise NotFoundException("Verification not found.")
    emp = db.query(EmployerProfile).filter(EmployerProfile.id == v.employer_id).first()

    return EmployerVerificationDetail(
        id=str(v.id), employer_id=str(v.employer_id), company_name=emp.company_name if emp else "—",
        status=v.status, rejection_reason=v.rejection_reason, reviewer_notes=v.reviewer_notes,
        submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
        document_count=len(v.documents),
        documents=[
            VerificationDocumentEntry(
                id=str(d.id), doc_type=d.doc_type, file_url=d.file_url,
                original_filename=d.original_filename, status=d.status,
                notes=d.notes, uploaded_at=d.uploaded_at,
            )
            for d in v.documents
        ],
        events=[
            VerificationEventEntry(
                id=str(e.id), actor_name=(e.actor.email or e.actor.phone) if e.actor else None,
                from_status=e.from_status, to_status=e.to_status, note=e.note, created_at=e.created_at,
            )
            for e in v.events
        ],
    )


def get_verification_document_path(verification_id: str, document_id: str, db: Session):
    """Resolves a verification document to its on-disk path for the admin
    download endpoint — never exposed publicly, only through an authenticated,
    permission-gated route."""
    from app.core.storage import get_path

    doc = (
        db.query(EmployerVerificationDocument)
        .filter(
            EmployerVerificationDocument.id == document_id,
            EmployerVerificationDocument.verification_id == verification_id,
        )
        .first()
    )
    if not doc:
        raise NotFoundException("Document not found.")
    path = get_path(doc.file_url)
    if not path.exists():
        raise NotFoundException("Document file is missing from storage.")
    return path, doc.original_filename


def review_employer_verification(
    verification_id: str, action: str, notes: str | None, rejection_reason: str | None,
    actor_id: str, db: Session, request: Request | None = None,
) -> EmployerVerificationDetail:
    v = db.query(EmployerVerification).filter(EmployerVerification.id == verification_id).first()
    if not v:
        raise NotFoundException("Verification not found.")

    transitions = {
        "under_review": "under_review",
        "approve": "approved",
        "reject": "rejected",
    }
    if action not in transitions:
        raise ValueError("action must be one of: under_review, approve, reject")
    # Allow moving from 'requested' directly to under_review or approve/reject
    if v.status == "requested" and action not in transitions:
        raise ValueError("action must be one of: under_review, approve, reject")

    new_status = transitions[action]
    old_status = v.status

    v.status = new_status
    v.reviewer_id = uuid.UUID(actor_id)
    v.reviewer_notes = notes
    if action == "reject":
        if not rejection_reason:
            raise ValueError("rejection_reason is required when rejecting.")
        v.rejection_reason = rejection_reason
    if action in ("approve", "reject"):
        v.reviewed_at = datetime.now(timezone.utc)

    db.add(EmployerVerificationEvent(
        verification_id=v.id, actor_id=uuid.UUID(actor_id),
        from_status=old_status, to_status=new_status, note=notes or rejection_reason,
    ))

    emp = db.query(EmployerProfile).filter(EmployerProfile.id == v.employer_id).first()
    if action == "approve" and emp:
        emp.is_approved = True
        emp.approved_by = uuid.UUID(actor_id)
        emp.approved_at = datetime.now(timezone.utc)

    if emp and action in ("approve", "reject"):
        from app.core.notifications import employer_verification_email, notify
        recipient = db.query(User).filter(User.id == emp.user_id).first()
        subject, html = employer_verification_email(emp.company_name, action == "approve", rejection_reason)
        notify(recipient.email if recipient else None, subject, html)

    _write_audit(db, actor_id, "employer_verification.reviewed", resource="employer_verification",
                 resource_id=verification_id, previous_value={"status": old_status},
                 new_value={"status": new_status, "notes": notes, "rejection_reason": rejection_reason},
                 request=request)
    db.commit()
    return get_employer_verification_detail(verification_id, db)


def revoke_device_session(user_id: str, session_id: str, db: Session, actor_id: str | None = None, request: Request | None = None) -> MessageResponse:
    from app.models.user import RefreshToken

    session = (
        db.query(DeviceSession)
        .filter(DeviceSession.id == session_id, DeviceSession.user_id == user_id)
        .first()
    )
    if not session:
        raise NotFoundException("Session not found.")

    session.revoked_at = datetime.now(timezone.utc)
    token = db.query(RefreshToken).filter(RefreshToken.id == session.refresh_token_id).first()
    if token:
        token.revoked_at = datetime.now(timezone.utc)

    _write_audit(db, actor_id or user_id, "user.session_revoked", resource="device_session",
                 resource_id=session_id, new_value={"target_user_id": user_id}, request=request)
    db.commit()
    return MessageResponse(message="Session revoked.")


# ── Audit log ──────────────────────────────────────────────────────────────────

def list_audit_logs(
    db: Session,
    user_id: str | None = None,
    action: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditLogPage:
    query = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    return AuditLogPage(
        total=total,
        items=[
            AuditLogEntry(
                id=str(log.id), actor_email=actor.email if actor else None,
                actor_phone=actor.phone if actor else None,
                action=log.action, resource=log.resource,
                resource_id=str(log.resource_id) if log.resource_id else None,
                ip_address=str(log.ip_address) if log.ip_address else None,
                previous_value=log.previous_value, new_value=log.new_value,
                created_at=log.created_at,
            )
            for log, actor in rows
        ],
    )


# ── Subscription plans ────────────────────────────────────────────────────────

def _plan_to_admin_entry(plan: SubscriptionPlan) -> SubscriptionPlanAdminEntry:
    return SubscriptionPlanAdminEntry(
        id=str(plan.id), name=plan.name, price_monthly=plan.price_monthly,
        max_active_jobs=plan.max_active_jobs, max_recruiter_seats=plan.max_recruiter_seats,
        resume_access=plan.resume_access, candidate_search_limit=plan.candidate_search_limit,
        is_active=plan.is_active,
    )


def global_search(db: Session, q: str, limit_per_type: int = 5) -> GlobalSearchResponse:
    """Cross-entity search across users/employers/jobs — previously each
    section had its own isolated search box with no way to ask 'where is
    this phone number / company / job title anywhere on the platform'."""
    from app.models.mvp3 import Application

    results: list[GlobalSearchResult] = []
    pattern = f"%{q}%"

    users = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            or_(User.phone.ilike(pattern), User.email.ilike(pattern), AspirantProfile.full_name.ilike(pattern)),
        )
        .limit(limit_per_type)
        .all()
    )
    for u, profile in users:
        results.append(GlobalSearchResult(
            type="user", id=str(u.id),
            title=(profile.full_name if profile else None) or u.email or u.phone or "Unnamed user",
            subtitle=u.phone or u.email, section="users",
        ))

    employers = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            or_(EmployerProfile.company_name.ilike(pattern), User.phone.ilike(pattern), User.email.ilike(pattern)),
        )
        .limit(limit_per_type)
        .all()
    )
    for emp, u in employers:
        results.append(GlobalSearchResult(
            type="employer", id=str(emp.id),
            title=emp.company_name, subtitle=u.phone or u.email, section="employers",
        ))

    jobs = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(or_(JobPosting.title.ilike(pattern), EmployerProfile.company_name.ilike(pattern)))
        .limit(limit_per_type)
        .all()
    )
    for job, emp in jobs:
        results.append(GlobalSearchResult(
            type="job", id=str(job.id),
            title=job.title, subtitle=emp.company_name, section="jobs",
        ))

    apps = (
        db.query(Application, User, JobPosting)
        .join(User, Application.aspirant_id == User.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(or_(User.phone.ilike(pattern), AspirantProfile.full_name.ilike(pattern), JobPosting.title.ilike(pattern)))
        .limit(limit_per_type)
        .all()
    )
    for app, u, job in apps:
        results.append(GlobalSearchResult(
            type="application", id=str(app.id),
            title=f"{u.phone or u.email or 'Applicant'} → {job.title}",
            subtitle=app.status, section="applications",
        ))

    return GlobalSearchResponse(query=q, results=results)


def get_analytics(
    db: Session,
    from_dt: datetime,
    to_dt: datetime,
) -> "AnalyticsResponse":
    from app.models.mvp3 import Application
    from app.modules.admin.schemas import (
        AnalyticsPeriod, AnalyticsResponse, CohortRow, FunnelStage, ScoreBin, TimeSeriesPoint,
    )

    days = (to_dt.date() - from_dt.date()).days + 1

    # ── User growth ────────────────────────────────────────────────────────────
    user_rows = (
        db.query(
            func.date(User.created_at).label("d"),
            func.count(User.id),
        )
        .filter(User.created_at >= from_dt, User.created_at <= to_dt, User.deleted_at == None)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    user_growth = [TimeSeriesPoint(date=str(row[0]), count=row[1]) for row in user_rows]

    # ── Job posting volume ─────────────────────────────────────────────────────
    job_rows = (
        db.query(
            func.date(JobPosting.created_at).label("d"),
            func.count(JobPosting.id),
        )
        .filter(JobPosting.created_at >= from_dt, JobPosting.created_at <= to_dt)
        .group_by(func.date(JobPosting.created_at))
        .order_by(func.date(JobPosting.created_at))
        .all()
    )
    job_volume = [TimeSeriesPoint(date=str(row[0]), count=row[1]) for row in job_rows]

    # ── Application funnel ────────────────────────────────────────────────────
    FUNNEL_ORDER = ["applied", "shortlisted", "interview_scheduled", "interviewed", "offered", "hired", "rejected"]
    funnel_rows = (
        db.query(Application.status, func.count(Application.id))
        .filter(Application.created_at >= from_dt, Application.created_at <= to_dt)
        .group_by(Application.status)
        .all()
    )
    funnel_map = {status: cnt for status, cnt in funnel_rows}
    application_funnel = [
        FunnelStage(status=s, count=funnel_map.get(s, 0))
        for s in FUNNEL_ORDER
        if funnel_map.get(s, 0) > 0
    ]

    # ── Match score distribution ───────────────────────────────────────────────
    BINS = [("0–20", 0, 20), ("20–40", 20, 40), ("40–60", 40, 60), ("60–80", 60, 80), ("80–100", 80, 100)]
    score_rows = (
        db.query(Application.match_score)
        .filter(Application.match_score != None, Application.created_at >= from_dt, Application.created_at <= to_dt)
        .all()
    )
    scores = [row[0] for row in score_rows]
    match_score_distribution = []
    for label, lo, hi in BINS:
        count = sum(1 for s in scores if lo <= s < hi) if lo < 100 else sum(1 for s in scores if s == 100)
        match_score_distribution.append(ScoreBin(range=label, count=count))

    # ── Cohort table (last 6 completed months) ────────────────────────────────
    six_months_ago = to_dt - timedelta(days=180)
    cohort_signup_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(User.id),
        )
        .filter(User.created_at >= six_months_ago, User.deleted_at == None)
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .order_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    cohort_applied_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(Application.id.distinct()),
        )
        .join(Application, Application.aspirant_id == User.id)
        .filter(User.created_at >= six_months_ago, User.deleted_at == None)
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    cohort_hired_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(Application.id.distinct()),
        )
        .join(Application, Application.aspirant_id == User.id)
        .filter(
            User.created_at >= six_months_ago, User.deleted_at == None,
            Application.status == "hired",
        )
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    applied_map = {r[0]: r[1] for r in cohort_applied_rows}
    hired_map = {r[0]: r[1] for r in cohort_hired_rows}
    cohort_table = [
        CohortRow(month=month, signups=cnt, applied=applied_map.get(month, 0), hired=hired_map.get(month, 0))
        for month, cnt in cohort_signup_rows
    ]

    return AnalyticsResponse(
        period=AnalyticsPeriod(from_date=from_dt.strftime("%Y-%m-%d"), to_date=to_dt.strftime("%Y-%m-%d"), days=days),
        user_growth=user_growth,
        job_volume=job_volume,
        application_funnel=application_funnel,
        match_score_distribution=match_score_distribution,
        cohort_table=cohort_table,
    )


def get_billing_overview(db: Session) -> BillingOverviewResponse:
    """Platform-wide revenue visibility — previously completely absent.

    Computed from CompanySubscription/SubscriptionPlan state, not a payment
    ledger (no Payment/Invoice model exists yet, so this is MRR-by-subscription-
    state, not reconciled-against-gateway revenue). Still real, queried data —
    not mocked — and the only place an operator can see total MRR at all today.
    """
    active_subs = (
        db.query(CompanySubscription)
        .filter(CompanySubscription.status == "active")
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .all()
    )
    mrr = sum(s.plan.price_monthly for s in active_subs)
    active_count = len(active_subs)
    arpa = (mrr // active_count) if active_count else 0

    past_due_count = db.query(CompanySubscription).filter(CompanySubscription.status == "past_due").count()
    canceled_count = db.query(CompanySubscription).filter(CompanySubscription.status == "canceled").count()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_30d = db.query(CompanySubscription).filter(CompanySubscription.created_at >= thirty_days_ago).count()

    plan_rows = (
        db.query(SubscriptionPlan.id, SubscriptionPlan.name, SubscriptionPlan.price_monthly, func.count(CompanySubscription.id))
        .outerjoin(
            CompanySubscription,
            (CompanySubscription.plan_id == SubscriptionPlan.id) & (CompanySubscription.status == "active"),
        )
        .group_by(SubscriptionPlan.id, SubscriptionPlan.name, SubscriptionPlan.price_monthly)
        .order_by(SubscriptionPlan.price_monthly)
        .all()
    )
    plan_distribution = [
        PlanRevenueEntry(
            plan_id=str(pid), plan_name=name, price_monthly=price,
            company_count=count, mrr=price * count,
        )
        for pid, name, price, count in plan_rows
    ]

    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    month_rows = (
        db.query(
            func.to_char(CompanySubscription.created_at, "YYYY-MM"),
            func.count(CompanySubscription.id),
        )
        .filter(CompanySubscription.created_at >= six_months_ago)
        .group_by(func.to_char(CompanySubscription.created_at, "YYYY-MM"))
        .order_by(func.to_char(CompanySubscription.created_at, "YYYY-MM"))
        .all()
    )
    trend = [RevenueTrendPoint(month=month, new_subscriptions=count) for month, count in month_rows]

    return BillingOverviewResponse(
        mrr=mrr, arpa=arpa,
        active_subscriptions=active_count, past_due_subscriptions=past_due_count,
        canceled_subscriptions=canceled_count, new_subscriptions_30d=new_30d,
        plan_distribution=plan_distribution, trend=trend,
    )


def list_subscription_plans(db: Session) -> list[SubscriptionPlanAdminEntry]:
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly).all()
    return [_plan_to_admin_entry(p) for p in plans]


def update_subscription_plan(plan_id: str, data: SubscriptionPlanUpdateRequest, actor_id: str, db: Session, request: Request | None = None) -> SubscriptionPlanAdminEntry:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise NotFoundException("Subscription plan not found.")

    before = _plan_to_admin_entry(plan).model_dump()
    for field in ("price_monthly", "max_active_jobs", "max_recruiter_seats", "resume_access", "candidate_search_limit", "is_active"):
        val = getattr(data, field)
        if val is not None:
            setattr(plan, field, val)

    _write_audit(db, actor_id, "subscription_plan.updated", resource="subscription_plan",
                 resource_id=plan_id, previous_value=before, new_value=_plan_to_admin_entry(plan).model_dump(), request=request)
    db.commit()
    db.refresh(plan)
    return _plan_to_admin_entry(plan)


# ── Employer detail (admin view) ──────────────────────────────────────────────

def get_employer_detail(profile_id: str, db: Session) -> EmployerDetailResponse:
    from app.models.mvp3 import Application
    from app.models.employer_verification import EmployerVerification

    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer not found.")
    user = db.query(User).filter(User.id == profile.user_id).first()
    if not user:
        raise NotFoundException("Employer user not found.")

    # Team members — all profiles sharing the same company_id
    if profile.company_id:
        team_rows = (
            db.query(EmployerProfile, User)
            .join(User, EmployerProfile.user_id == User.id)
            .filter(EmployerProfile.company_id == profile.company_id, User.deleted_at == None)
            .order_by(EmployerProfile.is_owner.desc(), EmployerProfile.created_at)
            .all()
        )
        team = [
            EmployerTeamMemberEntry(
                user_id=str(u.id), employer_profile_id=str(p.id),
                full_name=u.full_name, email=u.email, phone=u.phone,
                role_name=u.role_name or "employer", is_owner=p.is_owner,
                is_active=u.is_active, joined_at=p.created_at,
            )
            for p, u in team_rows
        ]
    else:
        team = [EmployerTeamMemberEntry(
            user_id=str(user.id), employer_profile_id=str(profile.id),
            full_name=user.full_name, email=user.email, phone=user.phone,
            role_name=user.role_name or "employer", is_owner=True,
            is_active=user.is_active, joined_at=profile.created_at,
        )]

    # Recent jobs (latest 10)
    job_rows = (
        db.query(JobPosting)
        .filter(JobPosting.employer_id == str(profile.id))
        .order_by(JobPosting.created_at.desc())
        .limit(10)
        .all()
    )
    job_ids = [j.id for j in job_rows]
    app_counts_map: dict = {}
    if job_ids:
        ac = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        app_counts_map = {str(jid): cnt for jid, cnt in ac}

    recent_jobs = [
        EmployerJobEntry(
            id=str(j.id), title=j.title, sector=j.sector,
            location=j.location, is_active=j.is_active,
            applicant_count=app_counts_map.get(str(j.id), 0),
            created_at=j.created_at,
        )
        for j in job_rows
    ]

    # Total counts
    job_count = db.query(func.count(JobPosting.id)).filter(JobPosting.employer_id == str(profile.id)).scalar() or 0
    total_app_count = sum(app_counts_map.values()) if app_counts_map else 0

    # Subscription plan
    sub = (
        db.query(CompanySubscription, SubscriptionPlan)
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .filter(CompanySubscription.company_id == profile.company_id)
        .order_by(CompanySubscription.created_at.desc())
        .first()
    ) if profile.company_id else None
    subscription_plan = sub[1].name if sub else None

    # KYC status
    kyc = (
        db.query(EmployerVerification)
        .filter(EmployerVerification.employer_id == str(profile.id))
        .order_by(EmployerVerification.submitted_at.desc())
        .first()
    )

    return EmployerDetailResponse(
        id=str(profile.id), user_id=str(user.id),
        company_name=profile.company_name, industry=profile.industry,
        company_size=profile.company_size, website=profile.website,
        gst_number=profile.gst_number, contact_person=profile.contact_person,
        designation=profile.designation, city=profile.city,
        description=profile.description, phone=user.phone,
        phone_verified=user.phone_verified, is_approved=profile.is_approved,
        rejection_reason=profile.rejection_reason, registered_at=profile.created_at,
        job_count=job_count, application_count=total_app_count,
        subscription_plan=subscription_plan,
        team_members=team, recent_jobs=recent_jobs,
        kyc_status=kyc.status if kyc else None,
        kyc_submitted_at=kyc.submitted_at if kyc else None,
    )


# ── Admin announcements ───────────────────────────────────────────────────────

def _ann_status(ann) -> str:
    if ann.published_at:
        return "published"
    if ann.scheduled_at:
        return "scheduled"
    return "draft"


def _ann_to_entry(ann, creator_name: str | None = None) -> AnnouncementEntry:
    return AnnouncementEntry(
        id=str(ann.id),
        title=ann.title,
        body=ann.body,
        type=ann.type,
        target=ann.target,
        channel=ann.channel,
        status=_ann_status(ann),
        scheduled_at=ann.scheduled_at,
        published_at=ann.published_at,
        sent_count=ann.sent_count,
        created_by_name=creator_name,
        created_at=ann.created_at,
        updated_at=ann.updated_at,
    )


def list_announcements(db: Session, status: str | None = None) -> list[AnnouncementEntry]:
    from app.models.mvp3 import AdminAnnouncement
    now = datetime.now(timezone.utc)

    q = db.query(AdminAnnouncement, User).outerjoin(User, User.id == AdminAnnouncement.created_by)
    if status == "published":
        q = q.filter(AdminAnnouncement.published_at != None)
    elif status == "scheduled":
        q = q.filter(AdminAnnouncement.published_at == None, AdminAnnouncement.scheduled_at != None)
    elif status == "draft":
        q = q.filter(AdminAnnouncement.published_at == None, AdminAnnouncement.scheduled_at == None)

    rows = q.order_by(AdminAnnouncement.created_at.desc()).all()
    result = []
    for ann, creator in rows:
        name = None
        if creator:
            profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == creator.id).first()
            name = profile.full_name if profile else creator.phone
        result.append(_ann_to_entry(ann, name))
    return result


def create_announcement(data: AnnouncementCreateRequest, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.mvp3 import AdminAnnouncement
    ann = AdminAnnouncement(
        title=data.title,
        body=data.body,
        type=data.type,
        target=data.target,
        channel=data.channel,
        scheduled_at=data.scheduled_at,
        created_by=uuid.UUID(actor_id),
    )
    db.add(ann)
    db.flush()
    _write_audit(db, actor_id, "announcement_create", "announcement", str(ann.id), request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)


def update_announcement(ann_id: str, data: AnnouncementUpdateRequest, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.mvp3 import AdminAnnouncement
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    if ann.published_at:
        raise ForbiddenException("Published announcements cannot be edited")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(ann, field, value)
    _write_audit(db, actor_id, "announcement_update", "announcement", ann_id, request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)


def _resolve_announcement_targets(db: Session, ann) -> list[User]:
    """Return the list of active, non-deleted users this announcement targets."""
    target_roles = getattr(ann, "target_roles", None)
    needs_role_join = bool(target_roles) or ann.target == "admins"

    query = db.query(User).filter(User.is_active == True, User.deleted_at == None)

    if ann.target == "employers":
        query = query.join(EmployerProfile, EmployerProfile.user_id == User.id)
    elif ann.target in ("aspirants", "candidates"):
        query = query.join(AspirantProfile, AspirantProfile.user_id == User.id)

    if needs_role_join:
        query = query.join(Role, User.role_id == Role.id)
        if ann.target == "admins":
            query = query.filter(Role.name.in_(PLATFORM_ROLE_NAMES))
        if target_roles:
            query = query.filter(Role.name.in_(target_roles))

    return query.all()


def publish_announcement(ann_id: str, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.mvp3 import AdminAnnouncement, Notification
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    if ann.published_at:
        raise ForbiddenException("Already published")

    now = datetime.now(timezone.utc)
    ann.published_at = now

    target_users = _resolve_announcement_targets(db, ann)

    for user in target_users:
        db.add(Notification(
            user_id=user.id,
            type="announcement",
            title=ann.title,
            body=ann.body,
            delivery_status="pending",
        ))

    ann.sent_count = len(target_users)

    if ann.channel in ("email", "both"):
        from app.tasks.announcements import send_announcement_emails
        send_announcement_emails.delay(str(ann.id), [str(u.id) for u in target_users])

    _write_audit(db, actor_id, "announcement_publish", "announcement", ann_id, new_value={"sent_count": len(target_users)}, request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)






def delete_announcement(ann_id: str, actor_id: str, db: Session, request: Request | None = None) -> None:
    from app.models.mvp3 import AdminAnnouncement
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    _write_audit(db, actor_id, "announcement_delete", "announcement", ann_id, request=request)
    db.delete(ann)
    db.commit()


# ── Support tickets ───────────────────────────────────────────────────────────

def _ticket_to_entry(t) -> dict:
    return dict(
        id=str(t.id),
        subject=t.subject,
        status=t.status,
        priority=t.priority,
        entity_type=t.entity_type,
        category=getattr(t, "category", "general"),
        entity_id=str(t.entity_id) if t.entity_id else None,
        reporter_id=str(t.reporter_id) if t.reporter_id else None,
        reporter_name=getattr(t.reporter, "full_name", None) or (getattr(t.reporter, "phone", None) if t.reporter else None),
        reporter_phone=getattr(t.reporter, "phone", None) if t.reporter else None,
        assigned_to=str(t.assigned_to) if t.assigned_to else None,
        assignee_name=getattr(t.assignee, "full_name", None) or (getattr(t.assignee, "phone", None) if t.assignee else None),
        sla_deadline=t.sla_deadline,
        message_count=len(t.messages) if t.messages is not None else 0,
        created_at=t.created_at,
        updated_at=t.updated_at,
        resolved_at=t.resolved_at,
        closed_at=t.closed_at,
    )


def list_tickets(
    db: Session,
    *,
    status: str | None = None,
    priority: str | None = None,
    entity_type: str | None = None,
    category: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    from app.models.support import SupportTicket
    q = db.query(SupportTicket)
    if status:
        q = q.filter(SupportTicket.status == status)
    if priority:
        q = q.filter(SupportTicket.priority == priority)
    if entity_type:
        q = q.filter(SupportTicket.entity_type == entity_type)
    if category:
        q = q.filter(SupportTicket.category == category)
    if search:
        q = q.filter(SupportTicket.subject.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_ticket_to_entry(t) for t in items]}


def list_employer_support_tickets(profile_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    q = (
        db.query(SupportTicket)
        .filter(SupportTicket.entity_type == "employer", SupportTicket.entity_id == uuid.UUID(profile_id))
        .order_by(SupportTicket.created_at.desc())
    )
    items = q.all()
    return {"total": len(items), "items": [_ticket_to_entry(t) for t in items]}


def list_candidate_support_tickets(user_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    q = (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_id == uuid.UUID(user_id))
        .order_by(SupportTicket.created_at.desc())
    )
    items = q.all()
    return {"total": len(items), "items": [_ticket_to_entry(t) for t in items]}


def get_ticket(ticket_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    entry = _ticket_to_entry(t)
    entry["body"] = t.body
    entry["messages"] = [
        dict(
            id=str(m.id),
            sender_id=str(m.sender_id) if m.sender_id else None,
            sender_name=getattr(m.sender, "full_name", None) or (getattr(m.sender, "phone", None) if m.sender else "Admin"),
            body=m.body,
            is_internal=m.is_internal,
            created_at=m.created_at,
        )
        for m in t.messages
    ]
    entry["attachments"] = [
        dict(
            id=str(a.id),
            filename=a.filename,
            content_type=a.content_type,
            size_bytes=a.size_bytes,
            file_key=a.file_key,
            uploaded_by=str(a.uploaded_by) if a.uploaded_by else None,
            created_at=a.created_at,
        )
        for a in t.attachments
    ]
    return entry


def create_ticket(req, actor_id: str, db: Session, request: Request | None = None) -> dict:
    from app.models.support import SupportTicket
    SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 168}
    now = datetime.now(timezone.utc)
    t = SupportTicket(
        subject=req.subject,
        body=req.body,
        priority=req.priority,
        entity_type=req.entity_type,
        entity_id=uuid.UUID(req.entity_id) if req.entity_id else None,
        reporter_id=uuid.UUID(req.reporter_id) if req.reporter_id else None,
        sla_deadline=now + timedelta(hours=SLA_HOURS.get(req.priority, 72)),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    _write_audit(db, actor_id, "ticket_create", "support_ticket", str(t.id), request=request)
    return _ticket_to_entry(t)


def add_ticket_message(ticket_id: str, req, actor_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket, TicketMessage
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    msg = TicketMessage(
        ticket_id=t.id,
        sender_id=uuid.UUID(actor_id),
        body=req.body,
        is_internal=req.is_internal,
    )
    db.add(msg)
    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    sender = db.query(User).filter(User.id == uuid.UUID(actor_id)).first()
    return dict(
        id=str(msg.id),
        sender_id=actor_id,
        sender_name=getattr(sender, "full_name", None) or getattr(sender, "phone", "Admin"),
        body=msg.body,
        is_internal=msg.is_internal,
        created_at=msg.created_at,
    )


def update_ticket(ticket_id: str, req, actor_id: str, db: Session, request: Request | None = None) -> dict:
    from app.models.support import SupportTicket
    SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 168}
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    now = datetime.now(timezone.utc)
    if req.status and req.status != t.status:
        t.status = req.status
        if req.status == "resolved":
            t.resolved_at = now
        elif req.status == "closed":
            t.closed_at = now
    if req.priority and req.priority != t.priority:
        t.priority = req.priority
        t.sla_deadline = now + timedelta(hours=SLA_HOURS[req.priority])
    if req.assigned_to is not None:
        t.assigned_to = uuid.UUID(req.assigned_to) if req.assigned_to else None
    if req.category is not None:
        t.category = req.category
    t.updated_at = now
    _write_audit(db, actor_id, "ticket_update", "support_ticket", ticket_id, request=request)
    db.commit()
    db.refresh(t)
    return _ticket_to_entry(t)


# ── Admin notification management ─────────────────────────────────────────────

def list_notifications(
    db: Session,
    user_id: str | None = None,
    type_filter: str | None = None,
    delivery_status: str | None = None,
    is_read: bool | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    from app.models.mvp3 import Notification

    q = db.query(Notification, User).outerjoin(User, User.id == Notification.user_id)
    if user_id:
        q = q.filter(Notification.user_id == uuid.UUID(user_id))
    if type_filter:
        q = q.filter(Notification.type == type_filter)
    if delivery_status:
        q = q.filter(Notification.delivery_status == delivery_status)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)

    total = q.count()
    rows = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    items = [
        dict(
            id=str(n.id),
            user_id=str(n.user_id),
            user_email=getattr(u, "email", None),
            user_phone=getattr(u, "phone", None),
            type=n.type,
            title=n.title,
            body=n.body,
            link_url=n.link_url,
            is_read=n.is_read,
            delivery_status=n.delivery_status,
            email_sent_at=n.email_sent_at,
            email_failed_reason=n.email_failed_reason,
            created_at=n.created_at,
        )
        for n, u in rows
    ]
    return {"total": total, "items": items}


def get_notifications_stats(db: Session) -> dict:
    from app.models.mvp3 import Notification

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start
    ).scalar() or 0

    sent_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start,
        Notification.delivery_status == "sent",
    ).scalar() or 0

    failed_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start,
        Notification.delivery_status == "failed",
    ).scalar() or 0

    unread_total = db.query(func.count(Notification.id)).filter(
        Notification.is_read == False  # noqa: E712
    ).scalar() or 0

    type_rows = db.query(Notification.type, func.count(Notification.id)).group_by(Notification.type).all()
    by_type = [{"label": t, "count": c} for t, c in type_rows]

    status_rows = db.query(Notification.delivery_status, func.count(Notification.id)).group_by(
        Notification.delivery_status
    ).all()
    by_delivery_status = [{"label": s or "none", "count": c} for s, c in status_rows]

    return dict(
        total_today=total_today,
        sent_today=sent_today,
        failed_today=failed_today,
        unread_total=unread_total,
        by_type=by_type,
        by_delivery_status=by_delivery_status,
    )


def delete_notification(notification_id: str, db: Session) -> dict:
    from app.models.mvp3 import Notification

    n = db.query(Notification).filter(Notification.id == uuid.UUID(notification_id)).first()
    if not n:
        raise NotFoundException("Notification not found")
    db.delete(n)
    db.commit()
    return {"message": "Notification deleted"}


def get_user_notifications(user_id: str, db: Session, skip: int = 0, limit: int = 50) -> dict:
    return list_notifications(db, user_id=user_id, skip=skip, limit=limit)
