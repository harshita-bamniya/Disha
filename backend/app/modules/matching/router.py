"""Phase 3 — Module 09: Employer Matching router.

Aspirant routes (/api/jobs/...):
  GET  /api/jobs                          → paginated job listings with match score
  GET  /api/jobs/{job_id}                 → job detail
  POST /api/jobs/{job_id}/apply           → submit application
  GET  /api/jobs/applications             → aspirant's own applications
  GET  /api/jobs/applications/{id}        → application detail + history
  POST /api/jobs/applications/{id}/withdraw → withdraw application

Employer routes (/api/employer/pipeline/...):
  GET  /api/employer/pipeline/{job_id}            → candidate pipeline
  PATCH /api/employer/pipeline/applications/{id}  → update application status
"""
import hashlib
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from redis import Redis
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user, require_role
from app.core.exceptions import AuthException, BadRequestException, NotFoundException
from app.database import get_db, get_redis
from app.models.user import User
from app.modules.matching import service
from app.modules.matching.schemas import (
    ApplyRequest, ApplicationDetailOut, ApplicationOut,
    JobDetail, JobRecommendationsResponse, JobCandidatePipeline,
    UpdateApplicationStatusRequest,
)

_JOBS_CACHE_TTL = 600  # 10 minutes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Employer Matching"])

_aspirant = require_role("aspirant")
_employer = require_role("employer")


def _jobs_cache_key(user_id, sector, job_type, min_salary, limit, offset) -> str:
    sig = hashlib.md5(
        json.dumps(
            {"s": sector, "jt": job_type, "ms": min_salary, "l": limit, "o": offset},
            sort_keys=True,
        ).encode()
    ).hexdigest()
    return f"jobs:recs:{user_id}:{sig}"


def invalidate_jobs_cache(user_id, redis: Redis) -> None:
    """Delete all job-recommendation cache entries for a user (scan-based)."""
    try:
        pattern = f"jobs:recs:{user_id}:*"
        cursor = 0
        while True:
            cursor, keys = redis.scan(cursor, match=pattern, count=100)
            if keys:
                redis.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass  # Cache eviction failure is never fatal


# ── Aspirant: job discovery ───────────────────────────────────────────────────

@router.get("/jobs", response_model=JobRecommendationsResponse)
def list_jobs(
    sector: Optional[str] = Query(None, description="Filter by sector (partial match)"),
    job_type: Optional[str] = Query(None, description="remote | pan_india | hybrid | onsite"),
    min_salary: Optional[int] = Query(None, description="Minimum salary in LPA"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Browse active job postings ranked by match score for the current aspirant."""
    cache_key = _jobs_cache_key(current_user.id, sector, job_type, min_salary, limit, offset)

    # Try cache first
    try:
        cached = redis.get(cache_key)
        if cached:
            return JobRecommendationsResponse.model_validate_json(cached)
    except Exception:
        pass

    try:
        result = service.get_job_recommendations(
            current_user, db,
            sector=sector, job_type=job_type,
            min_salary=min_salary, limit=limit, offset=offset,
        )
    except Exception as exc:
        logger.error("[MATCHING] list_jobs error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch job listings.")

    try:
        redis.setex(cache_key, _JOBS_CACHE_TTL, result.model_dump_json())
    except Exception:
        pass

    return result


@router.get("/jobs/applications", response_model=list[ApplicationOut])
def list_my_applications(
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Return all applications submitted by the current aspirant."""
    return service.list_my_applications(current_user, db)


@router.get("/jobs/applications/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_application_detail(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job_detail(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_job_detail(job_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=201)
def apply_to_job(
    job_id: str,
    body: ApplyRequest,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Submit an application to a job posting."""
    try:
        return service.apply_to_job(job_id, body, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs/applications/{application_id}/withdraw", status_code=200)
def withdraw_application(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.withdraw_application(application_id, current_user, db)
    except (NotFoundException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Employer: candidate pipeline ──────────────────────────────────────────────

@router.get("/employer/pipeline/{job_id}", response_model=JobCandidatePipeline)
def get_job_pipeline(
    job_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Employer views all candidates who applied to a specific job."""
    try:
        return service.get_job_pipeline(job_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/employer/pipeline/applications/{application_id}", status_code=200)
def update_application_status(
    application_id: str,
    body: UpdateApplicationStatusRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Employer moves an application through the pipeline (review → shortlist → hire/reject)."""
    try:
        return service.update_application_status(application_id, body, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))
