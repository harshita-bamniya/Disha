from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user, require_role
from app.core.exceptions import AuthException, BadRequestException
from app.database import get_db
from app.models.user import User
from app.modules.jobs import service
from app.modules.jobs.schemas import (
    EmployerDashboardResponse, JobPostingRequest, JobPostingResponse,
)

router = APIRouter(prefix="/employer", tags=["Employer Jobs"])

# All routes require the caller to be an employer
_employer = require_role("employer")


@router.get("/dashboard", response_model=EmployerDashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_dashboard(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/jobs", response_model=JobPostingResponse, status_code=201)
def create_job(
    body: JobPostingRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.create_job(current_user, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/jobs/{job_id}", response_model=JobPostingResponse)
def update_job(
    job_id: str,
    body: JobPostingRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.update_job(current_user, job_id, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/jobs/{job_id}/toggle", response_model=JobPostingResponse)
def toggle_active(
    job_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.toggle_active(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        service.delete_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))
