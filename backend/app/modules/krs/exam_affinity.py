"""Exam → implied-skills loader — DB-first with in-memory fallback.

Mirrors the app/ai/prompts/loader.py pattern: the primary source is the
exam_skill_affinities table (editable at runtime, no redeploy needed to tune
as real outcome data comes in), with a hardcoded fallback so matching never
breaks if the table is empty or unreachable.

These are deliberately a LOW-CONFIDENCE PRIOR, not a real skill claim — see
app/modules/krs/matching.py for how they're capped and kept separate from
skills_you_have/skills_to_develop.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Used only when the DB table has no active row for the exam (cold start,
# DB unavailable, or a new exam value added before its row is seeded).
_BUILTIN_AFFINITIES: dict[str, list[str]] = {
    "cse":       ["Policy Analysis", "Public Administration", "Stakeholder Engagement", "Report Writing", "Governance"],
    "state_pcs": ["Public Administration", "Regional Governance", "Policy Analysis", "Stakeholder Engagement"],
    "capf":      ["Risk Assessment", "Crisis Management", "Team Leadership", "Operations Management", "Compliance & Governance"],
    "cds":       ["Team Leadership", "Operations Management", "Crisis Management", "Logistics Planning", "Discipline & Execution"],
    "ies":       ["Project Management", "Technical Problem Solving", "Infrastructure Planning", "Quality Assurance"],
    "cms":       ["Healthcare Administration", "Patient Care Coordination", "Public Health", "Clinical Judgment"],
    "other":     [],
}


def get_implied_skills(exam: str | None, db: Session | None = None) -> list[str]:
    """Return the low-confidence implied-skill list for a UPSC exam, or [] if
    none is set / no prior exists for it."""
    if not exam:
        return []

    if db is not None:
        try:
            from app.models.user import ExamSkillAffinity
            row = (
                db.query(ExamSkillAffinity)
                .filter(ExamSkillAffinity.exam == exam, ExamSkillAffinity.is_active == True)  # noqa: E712
                .first()
            )
            if row is not None:
                return list(row.implied_skills or [])
        except Exception as exc:
            logger.warning("[EXAM_AFFINITY] DB lookup failed for exam=%r: %s", exam, exc)

    return list(_BUILTIN_AFFINITIES.get(exam, []))
