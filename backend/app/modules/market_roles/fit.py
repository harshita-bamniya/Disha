"""How a learner's PROFILE skills line up with a reference role's skills (read-only, no resume, no AI).

  have     the profile lists this skill (same words)
  related  not listed, but a Skill Framework row ties a listed skill to it (UPSC activity -> corporate skill)
  gap      neither

This is a lens on a research record, not a hiring prediction, so it returns counts and the reason for each line,
never an invented percentage score.
"""
from __future__ import annotations

import re
from typing import Any

from app.modules.roadmap_engine import skill_bridge

_STOP = {"and", "the", "for", "with", "of", "to", "in", "on", "a", "an", "&", "using"}


def _toks(text: str) -> set[str]:
    return {t[:6] for t in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if t not in _STOP}


def _same(skill: str, listed: str) -> bool:
    a, b = _toks(skill), _toks(listed)
    if not a or not b:
        return (skill or "").strip().lower() == (listed or "").strip().lower()
    return len(a & b) / max(len(a), len(b)) >= 0.75 or a <= b and len(a) >= 2 or b <= a and len(b) >= 2


def classify(skill: str, user_skills: list[str], fw_rows: list[Any]) -> dict[str, Any]:
    for u in user_skills:
        if _same(skill, u):
            return {"skill": skill, "status": "have", "via": u}
    found = skill_bridge.bridge(skill, user_skills, fw_rows)
    if found:
        user, row = found
        return {"skill": skill, "status": "related", "via": user, "reason": f"UPSC '{row.upsc_activity}' builds {row.skill_developed}"}
    return {"skill": skill, "status": "gap", "via": None}


def skill_fit(required: list[str], preferred: list[str], user_skills: list[str], fw_rows: list[Any]) -> dict[str, Any]:
    req = [classify(s, user_skills, fw_rows) for s in required]
    pref = [classify(s, user_skills, fw_rows) for s in preferred]
    count = lambda items, st: sum(1 for i in items if i["status"] == st)  # noqa: E731
    return {
        "required": req, "preferred": pref,
        "summary": {"required_total": len(req), "have": count(req, "have"), "related": count(req, "related"), "gap": count(req, "gap")},
        "based_on": "your profile skills",
    }
