import uuid
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile,
    CareerTrack,
    EmployerProfile,
    JobPosting,
    KrsScore,
    PsychologicalAssessment,
    User,
    UserCareerSelection,
)
from app.modules.admin.schemas import (
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


def _employer_to_response(profile: EmployerProfile, user: User) -> PendingEmployerResponse:
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
    )


def list_employers(db: Session, status: str = "pending") -> list[PendingEmployerResponse]:
    """Return employers filtered by status: pending | approved | all."""
    query = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(User.deleted_at == None)
    )

    if status == "pending":
        # Phone verified but not yet admin-approved
        query = query.filter(
            EmployerProfile.is_approved == False,
            User.phone_verified == True,
        )
    elif status == "approved":
        query = query.filter(EmployerProfile.is_approved == True)
    # "all" → no extra filter

    query = query.order_by(EmployerProfile.created_at.desc())

    return [_employer_to_response(profile, user) for profile, user in query.all()]


def approve_employer(profile_id: str, admin_user_id: str, db: Session) -> MessageResponse:
    """Approve employer: set is_approved=True + activate user account."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")

    user = db.query(User).filter(User.id == profile.user_id).first()
    if not user:
        raise NotFoundException("Associated user not found.")

    profile.is_approved = True
    profile.approved_by = uuid.UUID(admin_user_id)
    profile.approved_at = datetime.now(timezone.utc)
    profile.rejection_reason = None  # clear any previous rejection
    user.is_active = True            # allow login

    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' has been approved. They can now log in.")


def reject_employer(profile_id: str, reason: str, db: Session) -> MessageResponse:
    """Reject an employer registration with a reason."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")

    profile.rejection_reason = reason
    profile.is_approved = False

    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' registration rejected.")


def get_stats(db: Session) -> AdminStatsResponse:
    """Platform-wide overview stats."""
    total_aspirants = db.query(AspirantProfile).count()
    completed_onboarding = (
        db.query(AspirantProfile).filter(AspirantProfile.is_completed == True).count()
    )
    total_employers = db.query(EmployerProfile).count()
    pending_employers = (
        db.query(EmployerProfile)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(EmployerProfile.is_approved == False, User.phone_verified == True)
        .count()
    )
    approved_employers = (
        db.query(EmployerProfile).filter(EmployerProfile.is_approved == True).count()
    )
    total_job_postings = db.query(JobPosting).count()
    active_job_postings = (
        db.query(JobPosting).filter(JobPosting.is_active == True).count()
    )

    return AdminStatsResponse(
        total_aspirants=total_aspirants,
        completed_onboarding=completed_onboarding,
        total_employers=total_employers,
        pending_employers=pending_employers,
        approved_employers=approved_employers,
        total_job_postings=total_job_postings,
        active_job_postings=active_job_postings,
    )


# ── Aspirant user management ──────────────────────────────────────────────────

def list_aspirants(db: Session, search: str | None = None) -> list[AspirantUserEntry]:
    """List all aspirant users with their onboarding status and KRS scores."""
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

    # Only aspirants — exclude employers and admins who have employer_profile / admin role
    # Simplest proxy: users who have an aspirant_profile OR no employer_profile
    query = query.filter(
        ~User.id.in_(
            db.query(User.id)
            .join(User.employer_profile)
        )
    )

    rows = query.order_by(User.created_at.desc()).all()

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
            krs_composite=krs.composite if krs else None,
            k_score=krs.k_score if krs else None,
            r_score=krs.r_score if krs else None,
            s_score=krs.s_score if krs else None,
            registered_at=user.created_at,
        ))
    return result


# ── Career track management ───────────────────────────────────────────────────

def list_career_tracks_admin(db: Session) -> list[CareerTrackAdminEntry]:
    tracks = db.query(CareerTrack).order_by(CareerTrack.title).all()
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
        id=str(track.id),
        slug=track.slug,
        title=track.title,
        description=track.description,
        sector=track.sector,
        required_skills=track.required_skills or [],
        min_k_score=track.min_k_score,
        salary_range=track.salary_range,
        growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [],
        created_at=track.created_at,
    )


def update_career_track(track_id: str, data: CareerTrackUpdateRequest, db: Session) -> CareerTrackAdminEntry:
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise NotFoundException("Career track not found.")

    if data.title is not None:
        track.title = data.title
    if data.description is not None:
        track.description = data.description
    if data.sector is not None:
        track.sector = data.sector
    if data.required_skills is not None:
        track.required_skills = data.required_skills
    if data.min_k_score is not None:
        track.min_k_score = data.min_k_score
    if data.salary_range is not None:
        track.salary_range = data.salary_range
    if data.growth_outlook is not None:
        track.growth_outlook = data.growth_outlook
    if data.example_roles is not None:
        track.example_roles = data.example_roles

    db.commit()
    db.refresh(track)

    return CareerTrackAdminEntry(
        id=str(track.id),
        slug=track.slug,
        title=track.title,
        description=track.description,
        sector=track.sector,
        required_skills=track.required_skills or [],
        min_k_score=track.min_k_score,
        salary_range=track.salary_range,
        growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [],
        created_at=track.created_at,
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
    """Full profile detail for the admin user modal."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")

    profile: AspirantProfile | None = (
        db.query(AspirantProfile).filter(AspirantProfile.user_id == user_id).first()
    )
    psych: PsychologicalAssessment | None = (
        db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user_id).first()
    )
    krs: KrsScore | None = (
        db.query(KrsScore).filter(KrsScore.user_id == user_id).first()
    )
    selections = (
        db.query(UserCareerSelection)
        .filter(UserCareerSelection.user_id == user_id)
        .all()
    )

    return AspirantDetailResponse(
        # Identity
        user_id=str(user.id),
        phone=user.phone,
        email=user.email,
        is_active=user.is_active,
        registered_at=user.created_at,
        last_login_at=user.last_login_at,

        # Personal
        full_name=profile.full_name if profile else None,
        date_of_birth=profile.date_of_birth if profile else None,
        gender=profile.gender if profile else None,
        city=profile.city if profile else None,
        state=profile.state if profile else None,

        # Onboarding status
        is_completed=profile.is_completed if profile else False,
        current_step=profile.current_step if profile else 1,

        # Education
        education=AspirantEducation(
            highest_qualification=profile.highest_qualification,
            degree=profile.degree,
            field_of_study=profile.field_of_study,
            institution=profile.institution,
            graduation_year=profile.graduation_year,
        ) if profile else None,

        # UPSC Journey
        upsc_journey=AspirantUpscJourney(
            upsc_exam=profile.upsc_exam,
            years_preparing=profile.years_preparing,
            upsc_attempts=profile.upsc_attempts,
            highest_stage_cleared=profile.highest_stage_cleared,
            optional_subject=profile.optional_subject,
        ) if profile else None,

        # Work Experience
        work_experience=AspirantWorkExperience(
            has_work_experience=profile.has_work_experience,
            work_experience_years=profile.work_experience_years,
            work_experience_domain=profile.work_experience_domain,
            last_designation=profile.last_designation,
        ) if profile else None,

        # Skills
        skills=profile.skills if profile else None,

        # Career Preferences
        career_preferences=AspirantCareerPreferences(
            preferred_sectors=profile.preferred_sectors,
            preferred_locations=profile.preferred_locations,
            open_to_relocation=profile.open_to_relocation,
            expected_salary_min=profile.expected_salary_min,
            expected_salary_max=profile.expected_salary_max,
        ) if profile else None,

        # Psychological profile
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

        # KRS
        krs=AspirantKrsDetail(
            k_score=krs.k_score,
            r_score=krs.r_score,
            s_score=krs.s_score,
            composite=krs.composite,
            computed_at=krs.computed_at,
        ) if krs else None,

        # Selected career tracks
        selected_tracks=[
            AspirantSelectedTrack(
                track_id=str(sel.track_id),
                title=sel.track.title if sel.track else "Unknown",
                sector=sel.track.sector if sel.track else "—",
                selected_at=sel.selected_at,
            )
            for sel in selections
        ],
    )
