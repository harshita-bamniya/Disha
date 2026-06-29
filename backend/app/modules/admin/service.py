import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.employer_verification import (
    EmployerVerification, EmployerVerificationDocument, EmployerVerificationEvent,
)
from app.models.subscription import SubscriptionPlan
from app.models.user import (
    AspirantProfile, AuditLog, CareerTrack, DeviceSession, EmployerProfile, JobPosting,
    KrsScore, LoginHistory, Permission, PsychologicalAssessment, Role,
    RolePermission, User, UserCareerSelection,
)
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
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
    CareerTrackAdminEntry,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    DeviceSessionEntry,
    EmployerVerificationDetail,
    EmployerVerificationEntry,
    LoginHistoryEntry,
    MessageResponse,
    PendingEmployerResponse,
    PermissionEntry,
    PLATFORM_ROLE_NAMES,
    RoleEntry,
    SubAdminCreateRequest,
    SubAdminEntry,
    SubscriptionPlanAdminEntry,
    SubscriptionPlanUpdateRequest,
    UserManagementEntry,
    VerificationDocumentEntry,
    VerificationEventEntry,
)


def _write_audit(
    db: Session, actor_id: str | None, action: str, resource: str | None = None,
    resource_id: str | None = None, previous_value: dict | None = None, new_value: dict | None = None,
) -> None:
    """Records a moderation action for the audit log viewer. Caller still owns db.commit()."""
    db.add(AuditLog(
        user_id=uuid.UUID(actor_id) if actor_id else None,
        action=action, resource=resource,
        resource_id=uuid.UUID(resource_id) if resource_id else None,
        previous_value=previous_value, new_value=new_value,
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


def list_employers(db: Session, status: str = "pending") -> list[PendingEmployerResponse]:
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
    rows = query.all()

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


def revoke_employer(profile_id: str, admin_user_id: str, db: Session) -> MessageResponse:
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
                 resource_id=str(profile.id), previous_value={"is_approved": True}, new_value={"is_approved": False})
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

def list_aspirants(db: Session, search: str | None = None) -> list[AspirantUserEntry]:
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

    rows = query.order_by(User.created_at.desc()).all()

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
            financial_pressure_score=psych.financial_pressure_score,
            risk_tolerance=psych.risk_tolerance,
            motivation_type=psych.motivation_type,
            identity_attachment=psych.identity_attachment,
            support_system=psych.support_system,
            disha_insight=psych.disha_insight,
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

    result = []
    for role in roles:
        perms = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == role.id)
            .all()
        )
        result.append(RoleEntry(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=[f"{p.resource}:{p.action}" for p in perms],
            user_count=user_counts.get(role.id, 0),
        ))
    return result


def update_role_permissions(role_id: str, permission_ids: list[str], actor_id: str, db: Session) -> RoleEntry:
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
                 previous_value={"permissions": old_perms}, new_value={"permission_ids": permission_ids})
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


def create_sub_admin(data: SubAdminCreateRequest, actor_id: str, db: Session) -> SubAdminEntry:
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
                 new_value={"email": data.email, "role": role.name})
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def update_sub_admin_role(user_id: str, role_id: str, actor_id: str, db: Session) -> SubAdminEntry:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    old_role_name = user.role_name
    role = _platform_role_or_404(role_id, db)

    user.role_id = role.id
    _write_audit(db, actor_id, "sub_admin.role_changed", resource="user", resource_id=user_id,
                 previous_value={"role": old_role_name}, new_value={"role": role.name})
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def delete_sub_admin(user_id: str, actor_id: str, db: Session) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    if user.role_name not in PLATFORM_ROLE_NAMES:
        raise NotFoundException("User is not a platform sub-admin.")

    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    _write_audit(db, actor_id, "sub_admin.removed", resource="user", resource_id=user_id,
                 previous_value={"role": user.role_name})
    db.commit()
    return MessageResponse(message="Sub-admin removed.")


# ── User management: status / login history / sessions ───────────────────────

def list_managed_users(db: Session, search: str | None = None, status: str | None = None) -> list[UserManagementEntry]:
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

    rows = query.order_by(User.created_at.desc()).all()
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


def update_user_status(user_id: str, status: str, reason: str | None, actor_id: str, db: Session) -> MessageResponse:
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
                 previous_value={"status": prev_status}, new_value={"status": status, "reason": reason})
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
    actor_id: str, db: Session,
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
                 new_value={"status": new_status, "notes": notes, "rejection_reason": rejection_reason})
    db.commit()
    return get_employer_verification_detail(verification_id, db)


def revoke_device_session(user_id: str, session_id: str, db: Session) -> MessageResponse:
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


def list_subscription_plans(db: Session) -> list[SubscriptionPlanAdminEntry]:
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly).all()
    return [_plan_to_admin_entry(p) for p in plans]


def update_subscription_plan(plan_id: str, data: SubscriptionPlanUpdateRequest, actor_id: str, db: Session) -> SubscriptionPlanAdminEntry:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise NotFoundException("Subscription plan not found.")

    before = _plan_to_admin_entry(plan).model_dump()
    for field in ("price_monthly", "max_active_jobs", "max_recruiter_seats", "resume_access", "candidate_search_limit", "is_active"):
        val = getattr(data, field)
        if val is not None:
            setattr(plan, field, val)

    _write_audit(db, actor_id, "subscription_plan.updated", resource="subscription_plan",
                 resource_id=plan_id, previous_value=before, new_value=_plan_to_admin_entry(plan).model_dump())
    db.commit()
    db.refresh(plan)
    return _plan_to_admin_entry(plan)
