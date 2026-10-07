"""
Career Track Matching Engine.

Match score (0-100) = 0.60 * skill_overlap + 0.40 * krs_fit, plus a small flat
bonus when the aspirant's UPSC exam implies transferable skills that overlap
with the track (see exam_affinity.py) — capped and additive, same treatment
as an explicitly chosen sector, never blended into skill_overlap itself.
- skill_overlap: % of track's required_skills the aspirant semantically has
- krs_fit:       how well the aspirant's K score meets the track's min_k_score

skill_overlap now uses vector cosine similarity (threshold 0.78) so free-form
user skills like "stakeholder management" correctly match "Stakeholder Engagement".
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import AspirantProfile, CareerTrack

# Flat bonus applied when the track's required skills meaningfully overlap
# with the aspirant's exam-implied transferable skills (see exam_affinity.py)
# — smaller than an explicit signal like a chosen sector would get, since
# this is inferred from the exam alone, not something the user told us.
_EXAM_AFFINITY_BONUS = 6
_EXAM_AFFINITY_THRESHOLD = 40  # min overlap % before the bonus kicks in


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

    # Small, capped nudge from the aspirant's exam-implied transferable skills
    # (see exam_affinity.py) — e.g. a CDS background implies things like Team
    # Leadership and Crisis Management even if the user never typed them in.
    # This is a LOW-CONFIDENCE PRIOR, not a real skill claim: it's a flat
    # bonus applied the same way _apply_sector_bonus works for an explicitly
    # chosen sector, and it never touches `overlap` above or
    # skills_you_have/skills_to_develop anywhere else — those stay honest and
    # based only on what the user actually reported.
    if db is not None and required:
        from app.modules.krs.exam_affinity import get_implied_skills
        implied_skills = get_implied_skills(profile.upsc_exam, db)
        if implied_skills and skill_overlap_pct(implied_skills, required, db) >= _EXAM_AFFINITY_THRESHOLD:
            composite = min(100, composite + _EXAM_AFFINITY_BONUS)

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
