"""
Career Track Matching Engine.

Match score (0-100) = 0.60 * skill_overlap + 0.40 * krs_fit
- skill_overlap: % of track's required_skills the aspirant has (Jaccard-style)
- krs_fit:       how well the aspirant's K score meets the track's min_k_score
"""
from app.models.user import AspirantProfile, CareerTrack


def _skill_overlap_pct(user_skills: set[str], required: list[str]) -> int:
    if not required:
        return 100
    user_lower = {s.lower().strip() for s in user_skills}
    required_lower = [s.lower().strip() for s in required]
    matched = len(user_lower & set(required_lower))
    return round(matched / len(required) * 100)


def _krs_fit(k_score: int, min_k: int) -> int:
    """How well the aspirant's K score meets the track's minimum threshold (0-100)."""
    if min_k == 0:
        return 100
    if k_score >= min_k:
        # Above threshold — give full credit + bonus for exceeding
        bonus = min((k_score - min_k) / (100 - min_k) * 20, 20)
        return min(100, round(80 + bonus))
    else:
        # Below threshold — partial credit
        return round(k_score / min_k * 70)


def compute_match_score(
    profile: AspirantProfile,
    track: CareerTrack,
    k_score: int,
) -> tuple[int, int]:
    """Returns (match_score, skill_overlap_pct)."""
    user_skills = set(profile.skills or [])
    overlap = _skill_overlap_pct(user_skills, track.required_skills or [])
    fit = _krs_fit(k_score, track.min_k_score)
    composite = round(overlap * 0.60 + fit * 0.40)
    return composite, overlap


def rank_tracks(
    profile: AspirantProfile,
    tracks: list[CareerTrack],
    k_score: int,
    top_n: int = 5,
) -> list[tuple[CareerTrack, int, int]]:
    """Returns top_n (track, match_score, skill_overlap) sorted by match_score desc."""
    scored = [
        (track, *compute_match_score(profile, track, k_score))
        for track in tracks
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_n]
