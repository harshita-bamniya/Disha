"""Skill competence tracking."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.roadmap import (
    UserSkillCompetence,
)
from app.models.user import (
    User,
)
from app.modules.roadmap.schemas import (
    GapSkillOut, SkillCompetenceOut,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def update_skill_competence(
    user_id: str,
    skill_text: str,
    quiz_score: float | None,
    exercise_score: float | None,
    db: Session,
) -> UserSkillCompetence:
    """Update (or create) a UserSkillCompetence record with new score data.

    Uses running average: new_avg = (old_avg * n + new_score) / (n + 1)
    """
    norm = skill_text.lower().strip()
    rec = (
        db.query(UserSkillCompetence)
        .filter(UserSkillCompetence.user_id == user_id, UserSkillCompetence.skill_text == norm)
        .first()
    )
    if not rec:
        rec = UserSkillCompetence(user_id=user_id, skill_text=norm)
        db.add(rec)

    # Bug fix (2026-08-24, confirmed 100% reproducible on every interview
    # completion): a freshly-constructed row's numeric columns are still
    # Python None here — the Column `default=` only applies at flush/insert
    # time, not to the in-memory object before that — so `rec.attempts`
    # (and the two score-avg fields below) must be coalesced explicitly
    # rather than trusted, or the very first score for a brand-new skill
    # crashes with `float * NoneType` and silently aborts the whole
    # per-session competence-update batch (caught by a broad except upstream).
    n = rec.attempts or 0

    if quiz_score is not None:
        old = rec.quiz_score_avg or 0.0
        rec.quiz_score_avg = (old * n + quiz_score) / (n + 1)
    if exercise_score is not None:
        old = rec.exercise_score_avg or 0.0
        rec.exercise_score_avg = (old * n + exercise_score) / (n + 1)

    rec.attempts = n + 1
    rec.competence_score = (
        ((rec.quiz_score_avg or 0.0) * 0.4) +
        ((rec.exercise_score_avg or 0.0) * 0.4) +
        min(rec.attempts, 10) * 2  # consistency bonus, max 20
    )
    rec.competence_score = min(100.0, rec.competence_score)
    rec.last_assessed = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rec)
    return rec


def get_skill_competence(user: User, db: Session) -> list[SkillCompetenceOut]:
    recs = (
        db.query(UserSkillCompetence)
        .filter(UserSkillCompetence.user_id == user.id)
        .order_by(UserSkillCompetence.competence_score.desc())
        .all()
    )
    return [SkillCompetenceOut(
        skill_text=r.skill_text,
        competence_score=r.competence_score,
        quiz_score_avg=r.quiz_score_avg,
        exercise_score_avg=r.exercise_score_avg,
        attempts=r.attempts,
        last_assessed=r.last_assessed,
    ) for r in recs]


def get_gap_skills_with_competence(user: User, db: Session) -> list[GapSkillOut]:
    roadmap = core.get_roadmap(None, user, db)
    if not roadmap:
        return []

    gap_skills = roadmap.gap_skills or []
    competence_map: dict[str, float] = {}
    if gap_skills:
        recs = (
            db.query(UserSkillCompetence)
            .filter(
                UserSkillCompetence.user_id == user.id,
                UserSkillCompetence.skill_text.in_([s.lower().strip() for s in gap_skills]),
            )
            .all()
        )
        competence_map = {r.skill_text: r.competence_score for r in recs}

    return [
        GapSkillOut(
            skill=skill,
            priority_rank=i + 1,
            competence_score=competence_map.get(skill.lower().strip()),
        )
        for i, skill in enumerate(gap_skills)
    ]

