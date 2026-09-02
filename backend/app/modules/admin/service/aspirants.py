"""Admin: aspirant user management."""
import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    KrsScore,
    PsychologicalAssessment,
    User,
    UserCareerSelection,
)
from app.modules.admin.schemas import (
    AdminApplicationEntry,
    AspirantCareerPreferences,
    AspirantDetailResponse,
    AspirantEducation,
    AspirantKrsDetail,
    AspirantPsychProfile,
    AspirantSelectedTrack,
    AspirantUpscJourney,
    AspirantUserEntry,
    AspirantWorkExperience,
    MessageResponse,
)
from app.modules.admin.service import tickets


def list_aspirants(db: Session, search: str | None = None, limit: int = 100, offset: int = 0) -> list[AspirantUserEntry]:
    from app.models.applications import Application

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


def get_aspirant_detail(user_id: str, db: Session) -> AspirantDetailResponse:
    from app.models.applications import Application

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


def list_candidate_applications(
    user_id: str,
    db: Session,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AdminApplicationEntry]:
    from app.models.applications import Application
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


def list_candidate_support_tickets(user_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    q = (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_id == uuid.UUID(user_id))
        .order_by(SupportTicket.created_at.desc())
    )
    items = q.all()
    return {"total": len(items), "items": [tickets._ticket_to_entry(t) for t in items]}

