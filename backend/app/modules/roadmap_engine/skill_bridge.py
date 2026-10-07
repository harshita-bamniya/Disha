"""Evidence-backed "partial" credit: the UPSC Skill Framework instead of a model's guess.

A module is `partial` (the learner has a related strength, but has not done this skill) only when ONE row of the
research Skill Framework links both sides: the row's UPSC activity/skill names the learner's listed skill, and the
row's skill/corporate translation names the module's skill. The row must have depth >= MIN_DEPTH. Without such a
row a model-suggested `partial` is reset to `learn`. The framework never creates `known`: it is a research
mapping from activity to skill, not proof the learner can do the task.
"""
from __future__ import annotations

import re
from typing import Any

MIN_DEPTH = 7
_GENERIC = {"analys", "resear", "skills", "knowl", "manage", "genera", "basic", "work", "studies", "study", "indian", "india"}


def _w(text: str) -> set[str]:
    return {t[:6] for t in re.findall(r"[a-z]{3,}", (text or "").lower())} - _GENERIC


def bridge(job_skill: str, user_skills: list[str], rows: list[Any]) -> tuple[str, Any] | None:
    """(the learner's skill, the framework row linking it to `job_skill`), or None."""
    js = _w(job_skill)
    if not js:
        return None
    best: tuple[int, str, Any] | None = None
    for r in rows:
        if r.skill_depth < MIN_DEPTH:
            continue
        job_side = _w(" ".join([r.skill_developed or "", r.corporate_translation or ""]))
        shared = js & job_side
        # the module's skill must be mostly named by the row: half its distinctive words, and 2+ unless it is a short name
        if not shared or len(shared) / len(js) < 0.5 or (len(shared) < 2 and len(js) > 2):
            continue
        user_side = _w(" ".join([r.upsc_activity or "", r.skill_developed or ""]))
        for u in user_skills:
            uw = _w(u)
            if uw and uw <= user_side:        # the row must name ALL of the learner's skill, not one shared word
                score = r.skill_depth
                if best is None or score > best[0]:
                    best = (score, u, r)
    return (best[1], best[2]) if best else None


def apply(
    skills: list[dict[str, Any]], status: dict[str, dict[str, Any]], user_skills: list[str], rows: list[Any],
) -> dict[str, int]:
    """Reset unfounded `partial`s to `learn`; give `partial` where the framework backs it. Never touches known/review."""
    kept = reset = added = 0
    for s in skills:
        st = status[s["id"]]
        if st["status"] not in ("partial", "learn"):
            continue
        prev = st["status"]
        found = bridge(s["name"], user_skills, rows) if user_skills else None
        if found:
            user, row = found
            st.update(status="partial", matched=user,
                      reason=f"From your {user}: UPSC '{row.upsc_activity}' builds {row.skill_developed} (research mapping)")
            added += prev == "learn"
            kept += 1
        elif st["status"] == "partial":
            st.update(status="learn", matched=None, reason="")
            reset += 1
    return {"backed": kept, "reset_to_learn": reset, "added": added}


def load_rows(db) -> list[Any]:
    from app.models.reference_data import UpscSkillFramework
    return db.query(UpscSkillFramework).all()
