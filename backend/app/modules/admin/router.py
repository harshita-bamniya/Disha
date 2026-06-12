from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.rbac import require_admin
from app.database import get_db
from app.models.user import User
from app.modules.admin import service
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
    AdminJobEntry,
    AdminStatsResponse,
    AspirantDetailResponse,
    AspirantUserEntry,
    CareerTrackAdminEntry,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    MessageResponse,
    PendingEmployerResponse,
    RejectRequest,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_stats(db)


# ── Employers ─────────────────────────────────────────────────────────────────

@router.get("/employers", response_model=list[PendingEmployerResponse])
def list_employers(
    status: Literal["pending", "approved", "all"] = "pending",
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_employers(db, status)


@router.post("/employers/{profile_id}/approve", response_model=MessageResponse)
def approve_employer(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.approve_employer(profile_id, str(admin.id), db)


@router.post("/employers/{profile_id}/reject", response_model=MessageResponse)
def reject_employer(
    profile_id: str,
    body: RejectRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.reject_employer(profile_id, body.reason, db)


@router.post("/employers/{profile_id}/revoke", response_model=MessageResponse)
def revoke_employer(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.revoke_employer(profile_id, db)


# ── Aspirant users ─────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AspirantUserEntry])
def list_users(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_aspirants(db, search)


@router.get("/users/{user_id}", response_model=AspirantDetailResponse)
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_aspirant_detail(user_id, db)


@router.post("/users/{user_id}/deactivate", response_model=MessageResponse)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.deactivate_user(user_id, db)


@router.post("/users/{user_id}/reactivate", response_model=MessageResponse)
def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.reactivate_user(user_id, db)


# ── Career track management ───────────────────────────────────────────────────

@router.get("/career-tracks", response_model=list[CareerTrackAdminEntry])
def list_career_tracks(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_career_tracks_admin(db)


@router.post("/career-tracks", response_model=CareerTrackAdminEntry, status_code=201)
def create_career_track(
    body: CareerTrackCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    try:
        return service.create_career_track(body, db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/career-tracks/{track_id}", response_model=CareerTrackAdminEntry)
def update_career_track(
    track_id: str,
    body: CareerTrackUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.update_career_track(track_id, body, db)


@router.delete("/career-tracks/{track_id}", response_model=MessageResponse)
def delete_career_track(
    track_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.delete_career_track(track_id, db)


# ── Jobs management ───────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[AdminJobEntry])
def list_jobs(
    search: Optional[str] = Query(None),
    active_only: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_admin_jobs(db, search, active_only)


@router.patch("/jobs/{job_id}/toggle", response_model=AdminJobEntry)
def toggle_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.toggle_admin_job(job_id, db)


@router.delete("/jobs/{job_id}", response_model=MessageResponse)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.delete_admin_job(job_id, db)


# ── Applications ──────────────────────────────────────────────────────────────

@router.get("/applications", response_model=list[AdminApplicationEntry])
def list_applications(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_admin_applications(db, status, search, limit, offset)


# ── Activity feed ─────────────────────────────────────────────────────────────

@router.get("/activity", response_model=list[AdminActivityItem])
def activity_feed(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_activity_feed(db, limit)
