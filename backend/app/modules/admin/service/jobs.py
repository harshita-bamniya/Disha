"""Admin: job posting management."""

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    User,
)
from app.modules.admin.schemas import (
    AdminApplicationEntry,
    AdminJobDetailResponse,
    AdminJobEntry,
    MessageResponse,
)


def list_admin_jobs(db: Session, search: str | None = None, active_only: bool = False) -> list[AdminJobEntry]:
    from app.models.applications import Application

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
    from app.models.applications import Application

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
    from app.models.applications import Application
    from app.models.user import EmployerProfile, JobPosting

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


def list_job_applications(
    job_id: str,
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


def list_admin_applications(
    db: Session,
    status: str | None = None,
    search: str | None = None,
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

