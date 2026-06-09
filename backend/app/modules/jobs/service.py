import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException
from app.models.user import EmployerProfile, JobPosting, User
from app.modules.jobs.schemas import (
    EmployerDashboardResponse, JobPostingRequest,
    JobPostingResponse,
)

logger = logging.getLogger(__name__)


def _get_approved_employer(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        raise AuthException("Your employer account is pending admin approval.")
    return profile


def _get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    return profile


def _job_to_response(job: JobPosting) -> JobPostingResponse:
    return JobPostingResponse(
        id=str(job.id),
        title=job.title,
        description=job.description,
        sector=job.sector,
        required_skills=job.required_skills or [],
        min_k_score=job.min_k_score,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        growth_outlook=job.growth_outlook,
        job_type=job.job_type,
        location=job.location,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        is_active=job.is_active,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def get_dashboard(user: User, db: Session) -> EmployerDashboardResponse:
    profile = _get_employer_profile(user, db)
    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.employer_id == profile.id)
        .order_by(JobPosting.created_at.desc())
        .all()
    )
    active = [j for j in jobs if j.is_active]
    return EmployerDashboardResponse(
        company_name=profile.company_name,
        is_approved=profile.is_approved,
        total_jobs=len(jobs),
        active_jobs=len(active),
        jobs=[_job_to_response(j) for j in jobs],
    )


def _embed_job(job: JobPosting) -> None:
    """Dispatch embedding to Celery — retried automatically on failure."""
    from app.tasks.worker import embed_job
    embed_job.delay(str(job.id))


def create_job(user: User, data: JobPostingRequest, db: Session) -> JobPostingResponse:
    profile = _get_approved_employer(user, db)
    job = JobPosting(
        employer_id=profile.id,
        title=data.title,
        description=data.description,
        sector=data.sector,
        required_skills=data.required_skills,
        min_k_score=data.min_k_score,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        growth_outlook=data.growth_outlook,
        job_type=data.job_type,
        location=data.location,
        employment_type=data.employment_type,
        expires_at=data.expires_at,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info(f"[JOBS] {profile.company_name} posted: {job.title}")
    _embed_job(job)
    return _job_to_response(job)


def update_job(user: User, job_id: str, data: JobPostingRequest, db: Session) -> JobPostingResponse:
    profile = _get_approved_employer(user, db)
    job = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id == profile.id
    ).first()
    if not job:
        raise BadRequestException("Job posting not found.")

    job.title = data.title
    job.description = data.description
    job.sector = data.sector
    job.required_skills = data.required_skills
    job.min_k_score = data.min_k_score
    job.salary_min = data.salary_min
    job.salary_max = data.salary_max
    job.growth_outlook = data.growth_outlook
    job.job_type = data.job_type
    job.location = data.location
    job.employment_type = data.employment_type
    job.expires_at = data.expires_at
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    logger.info(f"[JOBS] Updated job {job_id}: {job.title}")
    _embed_job(job)
    return _job_to_response(job)


def toggle_active(user: User, job_id: str, db: Session) -> JobPostingResponse:
    profile = _get_approved_employer(user, db)
    job = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id == profile.id
    ).first()
    if not job:
        raise BadRequestException("Job posting not found.")
    job.is_active = not job.is_active
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


def delete_job(user: User, job_id: str, db: Session) -> None:
    profile = _get_approved_employer(user, db)
    job = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id == profile.id
    ).first()
    if not job:
        raise BadRequestException("Job posting not found.")
    db.delete(job)
    db.commit()
    logger.info(f"[JOBS] Deleted job {job_id}")
