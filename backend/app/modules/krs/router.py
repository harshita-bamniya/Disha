from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user
from app.database import get_db
from app.models.user import User
from app.modules.krs import service
from app.modules.krs.schemas import KrsDashboardResponse, KrsScoreResponse, LiveJobResponse, PrepareJobResponse

router = APIRouter(prefix="/krs", tags=["KRS Intelligence"])


@router.get("/dashboard", response_model=KrsDashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_dashboard(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
):
    """Mark a job as 'preparing for'. Idempotent."""
    try:
        return service.prepare_job(current_user, job_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/jobs/{job_id}/prepare", response_model=PrepareJobResponse, status_code=200)
def unprepare_job(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Remove a job from the preparation list."""
    return service.unprepare_job(current_user, job_id, db)


@router.post("/compute", response_model=KrsScoreResponse, status_code=200)
def recompute(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Manually re-trigger KRS computation (e.g. after profile update)."""
    try:
        krs = service.compute_and_store(current_user, db)
        return KrsScoreResponse(
            k_score=krs.k_score,
            r_score=krs.r_score,
            s_score=krs.s_score,
            composite=krs.composite,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
