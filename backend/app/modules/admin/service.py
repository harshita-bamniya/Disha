import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile, CareerTrack, EmployerProfile, JobPosting,
    KrsScore, PsychologicalAssessment, User, UserCareerSelection,
)
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
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
    MessageResponse,
    PendingEmployerResponse,
)


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


def approve_employer(profile_id: str, admin_user_id: str, db: Session) -> MessageResponse:
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")

    user = db.query(User).filter(User.id == profile.user_id).first()
    if not user:
        raise NotFoundException("Associated user not found.")

    profile.is_approved = True
    profile.approved_by = uuid.UUID(admin_user_id)
    profile.approved_at = datetime.now(timezone.utc)
    profile.rejection_reason = None
    user.is_active = True

    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' has been approved. They can now log in.")


def reject_employer(profile_id: str, reason: str, db: Session) -> MessageResponse:
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")

    profile.rejection_reason = reason
    profile.is_approved = False

    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' registration rejected.")


def revoke_employer(profile_id: str, db: Session) -> MessageResponse:
    """Revoke a previously approved employer — disables their login."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")
    user = db.query(User).filter(User.id == profile.user_id).first()

    profile.is_approved = False
    profile.rejection_reason = "Approval revoked by admin."
    if user:
        user.is_active = False

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
