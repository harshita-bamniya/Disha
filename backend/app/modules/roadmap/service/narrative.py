"""Stage 1 narrative submission and AI evaluation."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.roadmap import (
    UserRoadmap,
)
from app.models.user import (
    User,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def save_narrative(
    roadmap_id: str,
    narrative_text: str,
    ai_feedback: dict,
    user: User,
    db: Session,
) -> UserRoadmap:
    """Persist narrative text + AI feedback on the roadmap record."""
    roadmap = core._get_owned_roadmap(roadmap_id, user, db)
    roadmap.narrative_text = narrative_text
    roadmap.narrative_feedback = ai_feedback
    roadmap.narrative_score = ai_feedback.get("overall_score", 0)

    # Recompute JRS
    roadmap.job_readiness_score = core._compute_jrs_internal(user, roadmap, db)
    db.commit()
    db.refresh(roadmap)
    return roadmap

