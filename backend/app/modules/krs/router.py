import json

from fastapi import APIRouter, Depends, HTTPException
from redis import Redis
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user
from app.database import get_db, get_redis
from app.models.user import User
from app.modules.krs import service
from app.modules.krs.schemas import (
    ActivePrepJobContext, KrsDashboardResponse, KrsScoreResponse,
    LiveJobResponse, PrepareJobResponse,
)

router = APIRouter(prefix="/krs", tags=["KRS Intelligence"])

_KRS_CACHE_TTL = 3600  # 1 hour


def _krs_cache_key(user_id) -> str:
    return f"krs:dashboard:{user_id}"


@router.get("/dashboard", response_model=KrsDashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    cache_key = _krs_cache_key(current_user.id)

    # Try cache first
    try:
        cached = redis.get(cache_key)
        if cached:
            return KrsDashboardResponse(**json.loads(cached))
    except Exception:
        pass  # Cache miss / Redis unavailable — fall through to DB

    try:
        result = service.get_dashboard(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Store in cache
    try:
        redis.setex(cache_key, _KRS_CACHE_TTL, result.model_dump_json())
    except Exception:
        pass  # Non-fatal — cache write failure should never break the response

    return result


@router.get("/jobs", response_model=list[LiveJobResponse])
def get_live_jobs(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Active employer job postings ranked by skill match for the logged-in aspirant."""
    return service.get_live_jobs(current_user, db)


@router.get("/jobs/preparing", response_model=list[LiveJobResponse])
def get_prepared_jobs(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Return jobs the aspirant is actively preparing for."""
    return service.get_prepared_jobs(current_user, db)


@router.post("/jobs/{job_id}/prepare", response_model=PrepareJobResponse, status_code=200)
def prepare_job(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Mark a job as 'preparing for'. Idempotent."""
    try:
        result = service.prepare_job(current_user, job_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Invalidate KRS dashboard cache since preparation context changed
    try:
        redis.delete(_krs_cache_key(current_user.id))
    except Exception:
        pass
    return result


@router.delete("/jobs/{job_id}/prepare", response_model=PrepareJobResponse, status_code=200)
def unprepare_job(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Remove a job from the preparation list."""
    result = service.unprepare_job(current_user, job_id, db)
    try:
        redis.delete(_krs_cache_key(current_user.id))
    except Exception:
        pass
    return result


@router.get("/jobs/active-prep", response_model=ActivePrepJobContext | None)
def get_active_prep(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Return the job the user is currently focusing all prep tools toward."""
    return service.get_active_prep(current_user, db)


@router.post("/jobs/{job_id}/start-prep", response_model=ActivePrepJobContext)
def start_prep(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Set a job as the active prep target. Auto-adds to prep list."""
    try:
        result = service.start_prep(current_user, job_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    try:
        redis.delete(_krs_cache_key(current_user.id))
    except Exception:
        pass
    return result


@router.delete("/jobs/active-prep", status_code=200)
def clear_prep(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Clear the active prep job — tools revert to generic mode."""
    result = service.clear_prep(current_user, db)
    try:
        redis.delete(_krs_cache_key(current_user.id))
    except Exception:
        pass
    return result


@router.post("/compute", response_model=KrsScoreResponse, status_code=200)
def recompute(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Manually re-trigger KRS computation (e.g. after profile update)."""
    try:
        krs = service.compute_and_store(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Invalidate KRS dashboard cache and job-recommendation cache
    try:
        redis.delete(_krs_cache_key(current_user.id))
        from app.modules.matching.router import invalidate_jobs_cache
        invalidate_jobs_cache(current_user.id, redis)
    except Exception:
        pass
    return KrsScoreResponse(
        k_score=krs.k_score,
        r_score=krs.r_score,
        s_score=krs.s_score,
        composite=krs.composite,
    )
