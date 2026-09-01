from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user
from app.database import get_db
from app.models.user import User
from app.modules.careers import service
from app.modules.careers.schemas import (
    MySelectionsResponse,
    SelectionResponse,
    TrackDetailResponse,
    TrackSummaryResponse,
)

router = APIRouter(prefix="/careers", tags=["Career Mapping"])


@router.get("/tracks", response_model=list[TrackSummaryResponse])
def list_tracks(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """All career tracks ranked by personalised match score."""
    return service.get_all_tracks(current_user, db)


@router.get("/tracks/mine", response_model=MySelectionsResponse)
def my_selections(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Return the aspirant's chosen career paths."""
    return service.get_my_selections(current_user, db)


@router.get("/tracks/{slug}", response_model=TrackDetailResponse)
def get_track(
    slug: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Full track detail with gap analysis."""
    try:
        return service.get_track_detail(slug, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/tracks/{track_id}/select", response_model=SelectionResponse)
def select_track(
    track_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Add a career track to the user's selections (max 2)."""
    try:
        return service.select_track(track_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/tracks/{track_id}/select", response_model=SelectionResponse)
def deselect_track(
    track_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Remove a career track from the user's selections."""
    try:
        return service.deselect_track(track_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
