from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.rbac import require_admin
from app.database import get_db
from app.models.user import User
from app.modules.admin import service
from app.modules.admin.schemas import (
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
    """Platform overview statistics."""
    return service.get_stats(db)


@router.get("/employers", response_model=list[PendingEmployerResponse])
def list_employers(
    status: Literal["pending", "approved", "all"] = "pending",
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List employers filtered by approval status."""
    return service.list_employers(db, status)


@router.post("/employers/{profile_id}/approve", response_model=MessageResponse)
def approve_employer(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Approve an employer — activates their account for login."""
    return service.approve_employer(profile_id, str(admin.id), db)


@router.post("/employers/{profile_id}/reject", response_model=MessageResponse)
def reject_employer(
    profile_id: str,
    body: RejectRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Reject an employer registration with a reason."""
    return service.reject_employer(profile_id, body.reason, db)


# ── Aspirant users ────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AspirantUserEntry])
def list_users(
    search: Optional[str] = Query(None, description="Search by phone, email, name, or city"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all aspirant users with onboarding status and KRS scores."""
    return service.list_aspirants(db, search)


@router.get("/users/{user_id}", response_model=AspirantDetailResponse)
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Full profile detail for a single aspirant."""
    return service.get_aspirant_detail(user_id, db)


# ── Career track management ───────────────────────────────────────────────────

@router.get("/career-tracks", response_model=list[CareerTrackAdminEntry])
def list_career_tracks(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all career tracks."""
    return service.list_career_tracks_admin(db)


@router.post("/career-tracks", response_model=CareerTrackAdminEntry, status_code=201)
def create_career_track(
    body: CareerTrackCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new career track."""
    try:
        return service.create_career_track(body, db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.put("/career-tracks/{track_id}", response_model=CareerTrackAdminEntry)
def update_career_track(
    track_id: str,
    body: CareerTrackUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update an existing career track."""
    return service.update_career_track(track_id, body, db)


@router.delete("/career-tracks/{track_id}", response_model=MessageResponse)
def delete_career_track(
    track_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a career track."""
    return service.delete_career_track(track_id, db)
