"""Personal lines for a roadmap, assembled from verified facts only.

Earlier the AI wrote free text about the learner and invented things ("your public administration
experience", "your public speaking from UPSC prep"). Now every statement about the learner is built
in code from a skill name that really is on their profile (or from the absence of one). The AI never
writes a claim about the learner. The role-side explanation comes from the blueprint itself.
"""
from __future__ import annotations

from typing import Any


def _sentence(text: str) -> str:
    text = (text or "").strip()
    return text if not text or text[-1] in ".!?" else text + "."


def module_line(
    status: str, matched: str | None, why_for_role: str, source: str = "profile", rating: int | None = None,
) -> str:
    why = _sentence(why_for_role)
    if source == "self_rating" and matched and rating is not None:
        if status == "review":
            return f"You rated yourself {rating}/3 on {matched}, so this is a refresher. {why}".strip()
        return f"You rated yourself {rating}/3 on {matched}, but this module's skill itself is new to you. {why}".strip()
    if status == "review" and matched:
        return f"You already list {matched}, so this is a refresher. {why}".strip()
    if status == "partial" and matched:
        return f"{matched} on your profile is related, but this skill itself is new to you. {why}".strip()
    return f"New for you: none of your listed skills cover this. {why}".strip()


def module_lines(modules: list[dict[str, Any]]) -> dict[str, str]:
    return {
        m["id"]: module_line(m["status"], m.get("matched_skill"), m.get("why_for_role", ""),
                             m.get("matched_source", "profile"), m.get("matched_rating"))
        for m in modules
    }


def summary(
    strengths: list[tuple[str, str]], modules: list[dict[str, Any]], stretch_count: int,
) -> str:
    """`strengths` = (what the posting asks for, why it counts: "from your <skill>" or "you rated yourself 3/3")."""
    if strengths:
        # keep the posting's order (specific requirements first); show one entry per profile skill
        seen: set[str] = set()
        shown_items = []
        for req, label in strengths:
            key = label.lower()
            if key in seen and label.startswith("from your"):
                continue
            seen.add(key)
            exact = label.lower() == f"from your {req}".lower()
            shown_items.append(req if exact else f"{req} ({label})")
        first = f"For this posting you already have a foothold in: {'; '.join(shown_items[:3])}."
    else:
        first = "None of your listed skills directly cover this posting's requirements, so the plan starts from the basics."
    gaps = [m["skill"] for m in modules if m["status"] == "learn"][:3]
    focus = f" It focuses first on: {', '.join(gaps)}." if gaps else ""
    extra = f" {stretch_count} further skills this posting does not ask for are listed as optional." if stretch_count else ""
    return (first + focus + extra).strip()
