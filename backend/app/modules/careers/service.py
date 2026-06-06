"""
Module 04 — Career Mapping Service

Provides career track exploration, personalised match scores,
gap analysis, and track selection (max 2 per user).
"""
import logging
from sqlalchemy.orm import Session

from app.models.user import (
    AspirantProfile, CareerMatch, CareerTrack,
    KrsScore, User, UserCareerSelection,
)
from app.modules.careers.schemas import (
    MySelectionsResponse, SelectionResponse,
    TrackDetailResponse, TrackSummaryResponse,
)

logger = logging.getLogger(__name__)

_MAX_SELECTIONS = 2


# ── Helpers ───────────────────────────────────────────────────────────────────

def _match_map(user_id, db: Session) -> dict[str, tuple[int, int]]:
    """Returns {track_id_str: (match_score, skill_overlap)} for all pre-computed matches."""
    rows = db.query(CareerMatch).filter(CareerMatch.user_id == user_id).all()
    return {str(r.track_id): (r.match_score, r.skill_overlap) for r in rows}


def _selection_set(user_id, db: Session) -> set[str]:
    rows = db.query(UserCareerSelection).filter(UserCareerSelection.user_id == user_id).all()
    return {str(r.track_id) for r in rows}


def _user_skills(user: User, db: Session) -> set[str]:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    return set(profile.skills or []) if profile else set()


# ── Public API ────────────────────────────────────────────────────────────────

def get_all_tracks(user: User, db: Session) -> list[TrackSummaryResponse]:
    """All career tracks sorted by match score desc (None scores go last)."""
    tracks = db.query(CareerTrack).order_by(CareerTrack.title).all()
    matches = _match_map(user.id, db)
    selected = _selection_set(user.id, db)

    result = []
    for t in tracks:
        tid = str(t.id)
        ms, so = matches.get(tid, (None, None))
        result.append(TrackSummaryResponse(
            id=tid,
            slug=t.slug,
            title=t.title,
            sector=t.sector,
            salary_range=t.salary_range,
            growth_outlook=t.growth_outlook,
            match_score=ms,
            skill_overlap=so,
            is_selected=(tid in selected),
        ))

    # Sort by match_score desc; tracks without a score go to the bottom
    result.sort(key=lambda x: x.match_score if x.match_score is not None else -1, reverse=True)
    return result


def get_track_detail(slug: str, user: User, db: Session) -> TrackDetailResponse:
    """Full track detail with personalised gap analysis."""
    track = db.query(CareerTrack).filter(CareerTrack.slug == slug).first()
    if not track:
        raise ValueError(f"Career track '{slug}' not found")

    tid = str(track.id)
    matches = _match_map(user.id, db)
    selected = _selection_set(user.id, db)
    user_skills = _user_skills(user, db)

    required = list(track.required_skills or [])
    skills_have = sorted(user_skills & set(required))
    skills_gap = sorted(set(required) - user_skills)

    ms, so = matches.get(tid, (None, None))

    return TrackDetailResponse(
        id=tid,
        slug=track.slug,
        title=track.title,
        description=track.description,
        sector=track.sector,
        required_skills=required,
        min_k_score=track.min_k_score,
        salary_range=track.salary_range,
        growth_outlook=track.growth_outlook,
        example_roles=list(track.example_roles or []),
        match_score=ms,
        skill_overlap=so,
        skills_you_have=skills_have,
        skills_to_develop=skills_gap,
        is_selected=(tid in selected),
    )


def select_track(track_id: str, user: User, db: Session) -> SelectionResponse:
    """Add a career track to the user's selections (max 2)."""
    # Verify track exists
    track = db.query(CareerTrack).filter(CareerTrack.id == track_id).first()
    if not track:
        raise ValueError("Career track not found")

    existing = db.query(UserCareerSelection).filter(
        UserCareerSelection.user_id == user.id
    ).all()

    already_selected = any(str(s.track_id) == track_id for s in existing)
    if already_selected:
        return SelectionResponse(
            track_id=track_id,
            is_selected=True,
            total_selections=len(existing),
            message="Already selected",
        )

    if len(existing) >= _MAX_SELECTIONS:
        raise ValueError(
            f"You can select at most {_MAX_SELECTIONS} career tracks. "
            "Please deselect one before adding another."
        )

    sel = UserCareerSelection(user_id=user.id, track_id=track_id)
    db.add(sel)
    db.commit()
    logger.info(f"[CAREERS] user={user.id} selected track={track_id}")

    total = len(existing) + 1
    return SelectionResponse(
        track_id=track_id,
        is_selected=True,
        total_selections=total,
        message=f"'{track.title}' added to your career paths",
    )


def deselect_track(track_id: str, user: User, db: Session) -> SelectionResponse:
    """Remove a career track from the user's selections."""
    sel = db.query(UserCareerSelection).filter(
        UserCareerSelection.user_id == user.id,
        UserCareerSelection.track_id == track_id,
    ).first()

    if not sel:
        remaining = db.query(UserCareerSelection).filter(
            UserCareerSelection.user_id == user.id
        ).count()
        return SelectionResponse(
            track_id=track_id,
            is_selected=False,
            total_selections=remaining,
            message="Track was not selected",
        )

    db.delete(sel)
    db.commit()
    logger.info(f"[CAREERS] user={user.id} deselected track={track_id}")

    remaining = db.query(UserCareerSelection).filter(
        UserCareerSelection.user_id == user.id
    ).count()

    return SelectionResponse(
        track_id=track_id,
        is_selected=False,
        total_selections=remaining,
        message="Removed from your career paths",
    )


def get_my_selections(user: User, db: Session) -> MySelectionsResponse:
    """Return the user's chosen career tracks with full summary data."""
    sels = (
        db.query(UserCareerSelection)
        .filter(UserCareerSelection.user_id == user.id)
        .all()
    )
    selected_ids = {str(s.track_id) for s in sels}
    if not selected_ids:
        return MySelectionsResponse(selections=[], total=0)

    tracks = db.query(CareerTrack).filter(
        CareerTrack.id.in_([s.track_id for s in sels])
    ).all()
    matches = _match_map(user.id, db)

    items = []
    for t in tracks:
        tid = str(t.id)
        ms, so = matches.get(tid, (None, None))
        items.append(TrackSummaryResponse(
            id=tid,
            slug=t.slug,
            title=t.title,
            sector=t.sector,
            salary_range=t.salary_range,
            growth_outlook=t.growth_outlook,
            match_score=ms,
            skill_overlap=so,
            is_selected=True,
        ))

    return MySelectionsResponse(selections=items, total=len(items))
