"""Admin: career track management."""

from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    CareerTrack,
    UserCareerSelection,
)
from app.modules.admin.schemas import (
    CareerTrackAdminEntry,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    MessageResponse,
)
from app.modules.admin.service import core


def list_career_tracks_admin(db: Session) -> list[CareerTrackAdminEntry]:
    tracks = db.query(CareerTrack).order_by(CareerTrack.title).all()

    # Batch aspirant counts
    counts_rows = (
        db.query(UserCareerSelection.track_id, func.count(UserCareerSelection.user_id))
        .group_by(UserCareerSelection.track_id)
        .all()
    )
    counts = {str(r[0]): r[1] for r in counts_rows}

    return [
        CareerTrackAdminEntry(
            id=str(t.id),
            slug=t.slug,
            title=t.title,
            description=t.description,
            sector=t.sector,
            required_skills=t.required_skills or [],
            min_k_score=t.min_k_score,
            salary_range=t.salary_range,
            growth_outlook=t.growth_outlook,
            example_roles=t.example_roles or [],
            created_at=t.created_at,
            aspirant_count=counts.get(str(t.id), 0),
        )
        for t in tracks
    ]


def create_career_track(data: CareerTrackCreateRequest, admin_user_id: str, db: Session, request: Request | None = None) -> CareerTrackAdminEntry:
    existing = db.query(CareerTrack).filter(CareerTrack.slug == data.slug).first()
    if existing:
        raise ValueError(f"A track with slug '{data.slug}' already exists.")

    track = CareerTrack(
        slug=data.slug,
        title=data.title,
        description=data.description,
        sector=data.sector,
        required_skills=data.required_skills,
        min_k_score=data.min_k_score,
        salary_range=data.salary_range,
        growth_outlook=data.growth_outlook,
        example_roles=data.example_roles,
    )
    db.add(track)
    db.flush()  # assign track.id (Python-side default only fires at flush) before referencing it below
    core._write_audit(db, admin_user_id, "career_track.created", resource="career_track",
                 resource_id=str(track.id), previous_value=None,
                 new_value={"slug": track.slug, "title": track.title}, request=request)
    db.commit()
    db.refresh(track)

    return CareerTrackAdminEntry(
        id=str(track.id), slug=track.slug, title=track.title, description=track.description,
        sector=track.sector, required_skills=track.required_skills or [], min_k_score=track.min_k_score,
        salary_range=track.salary_range, growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [], created_at=track.created_at,
    )


def update_career_track(track_id: str, data: CareerTrackUpdateRequest, admin_user_id: str, db: Session, request: Request | None = None) -> CareerTrackAdminEntry:
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise NotFoundException("Career track not found.")

    previous = {}
    new = {}
    for field in ("title", "description", "sector", "required_skills", "min_k_score",
                  "salary_range", "growth_outlook", "example_roles"):
        val = getattr(data, field)
        if val is not None:
            previous[field] = getattr(track, field)
            new[field] = val
            setattr(track, field, val)

    core._write_audit(db, admin_user_id, "career_track.updated", resource="career_track",
                 resource_id=str(track.id), previous_value=previous or None, new_value=new or None,
                 request=request)
    db.commit()
    db.refresh(track)

    return CareerTrackAdminEntry(
        id=str(track.id), slug=track.slug, title=track.title, description=track.description,
        sector=track.sector, required_skills=track.required_skills or [], min_k_score=track.min_k_score,
        salary_range=track.salary_range, growth_outlook=track.growth_outlook,
        example_roles=track.example_roles or [], created_at=track.created_at,
    )


def delete_career_track(track_id: str, admin_user_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise NotFoundException("Career track not found.")
    title = track.title
    core._write_audit(db, admin_user_id, "career_track.deleted", resource="career_track",
                 resource_id=str(track.id), previous_value={"title": title}, new_value=None,
                 request=request)
    db.delete(track)
    db.commit()
    return MessageResponse(message=f"'{title}' deleted.")

