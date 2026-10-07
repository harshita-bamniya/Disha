"""The learner's own 0-3 ratings of the skills a posting asks for, asked just before a roadmap is generated.

Scale: 0 never used it, 1 know the basics, 2 have used it, 3 confident / use it often.

Ratings are the learner's statements, so they are used exactly as given: a rating of 2 or 3 counts as a
strength for that requirement, and a module that exists only to build rated-strong requirements is
shortened. A low rating overrides a profile-based guess. Nothing here is inferred from a resume.
"""
from __future__ import annotations

import re
from typing import Any

SCALE = {0: "Never used it", 1: "Know the basics", 2: "Have used it", 3: "Confident, use it often"}
MAX_RATED = 12
_ORDER = ["learn", "partial", "review", "known"]


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def clean_ratings(raw: Any, allowed_names: list[str]) -> dict[str, int]:
    """Keep only ratings for skills this posting really asks for, as ints 0-3, under the posting's own names."""
    by_norm = {norm(n): n for n in allowed_names}
    out: dict[str, int] = {}
    if not isinstance(raw, dict):
        return out
    for name, value in raw.items():
        canonical = by_norm.get(norm(str(name)))
        try:
            v = int(value)
        except (TypeError, ValueError):
            continue
        if canonical and 0 <= v <= 3 and len(out) < MAX_RATED:
            out[canonical] = v
    return out


def apply_to_status(
    skills: list[dict[str, Any]],
    status: dict[str, dict[str, Any]],
    serves: dict[str, list[str]] | None,
    ratings: dict[str, int],
) -> int:
    """Upgrade module status from the learner's ratings. Never downgrades. Returns how many modules changed."""
    if not ratings or not serves:
        return 0
    by_norm = {norm(k): (k, v) for k, v in ratings.items()}
    changed = 0
    for s in skills:
        served = serves.get(s["id"], [])
        rated = [by_norm[norm(i)] for i in served if norm(i) in by_norm]
        if not rated:
            continue
        current = status[s["id"]]["status"]
        values = [v for _, v in rated]
        if min(values) >= 3 and len(rated) == len(served):
            target = "review"       # everything this module serves is something they say they do confidently
        elif max(values) >= 2:
            target = "partial"
        else:
            continue
        if _ORDER.index(target) <= _ORDER.index(current):
            continue
        best_name, best_value = max(rated, key=lambda p: p[1])
        status[s["id"]] = {
            **status[s["id"]], "status": target, "matched": best_name, "source": "self_rating", "rating": best_value,
        }
        changed += 1
    return changed


def strengths(
    profile_strengths: list[tuple[str, str]], requirement_names: list[str], ratings: dict[str, int],
) -> list[tuple[str, str]]:
    """(requirement, label) in the posting's order. Own ratings win over profile guesses."""
    by_norm = {norm(k): v for k, v in ratings.items()}
    profile = {norm(r): skill for r, skill in profile_strengths}
    out: list[tuple[str, str]] = []
    for name in requirement_names:
        rating = by_norm.get(norm(name))
        if rating is not None:
            if rating >= 2:
                out.append((name, f"you rated yourself {rating}/3"))
            continue                                  # rated 0-1: not a strength, whatever the profile says
        if norm(name) in profile:
            out.append((name, f"from your {profile[norm(name)]}"))
    return out
