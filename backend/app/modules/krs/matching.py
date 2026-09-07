"""
Career Track Matching Engine.

Match score (0-100) = 0.60 * skill_overlap + 0.40 * krs_fit
- skill_overlap: % of track's required_skills the aspirant semantically has
- krs_fit:       how well the aspirant's K score meets the track's min_k_score

skill_overlap now uses vector cosine similarity (threshold 0.78) so free-form
user skills like "stakeholder management" correctly match "Stakeholder Engagement".
"""
from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.user import AspirantProfile, CareerTrack


def _krs_fit(k_score: int, min_k: int) -> int:
    """How well the aspirant's K score meets the track's minimum threshold (0-100)."""
    if min_k == 0:
        # No threshold set — use K score directly so UPSC depth still differentiates.
        # Mains-cleared (K=74) ranks above someone who just started (K=20).
        return k_score
    if k_score >= min_k:
        bonus = min((k_score - min_k) / (100 - min_k) * 20, 20)
        return min(100, round(80 + bonus))
    else:
        return round(k_score / min_k * 70)


def compute_match_score(
    profile: AspirantProfile,
    track: CareerTrack,
    k_score: int,
    db: Session | None = None,
) -> tuple[int, int]:
    """Returns (match_score, skill_overlap_pct).

    Uses semantic skill overlap when db is provided; falls back to string match otherwise.
    """
    from app.modules.krs.skill_gap import skill_overlap_pct
    user_skills = list(profile.skills or [])
    required = list(track.required_skills or [])

    if db is not None and required:
        overlap = skill_overlap_pct(user_skills, required, db)
    else:
        # String-match fallback (used in tests / no-db contexts)
        if not required:
            overlap = 100
        else:
            user_lower = {s.lower().strip() for s in user_skills}
            matched = sum(1 for s in required if s.lower().strip() in user_lower)
            overlap = round(matched / len(required) * 100)

    fit = _krs_fit(k_score, track.min_k_score)
    composite = round(overlap * 0.60 + fit * 0.40)
    return composite, overlap


def rank_tracks(
    profile: AspirantProfile,
    tracks: list[CareerTrack],
    k_score: int,
    top_n: int = 5,
    db: Session | None = None,
) -> list[tuple[CareerTrack, int, int]]:
    """Returns top_n (track, match_score, skill_overlap) sorted by match_score desc."""
    scored = [
        (track, *compute_match_score(profile, track, k_score, db))
        for track in tracks
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_n]
