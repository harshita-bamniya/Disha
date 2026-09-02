"""Social-proof cohort signals."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.roadmap import (
    StageGateEvaluation, TicketSubmission, UserRoadmap,
)
from app.models.user import (
    User,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def get_cohort_signals(user: User, db: Session) -> dict:
    """Return social proof signals for users in the same career track this week."""
    from datetime import timedelta
    roadmap = core.get_roadmap(None, user, db)
    if not roadmap:
        return {"signals": []}

    track_id = roadmap.career_track_id
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Users in same track who advanced stages this week
    advanced_count = (
        db.query(StageGateEvaluation)
        .join(UserRoadmap, StageGateEvaluation.roadmap_id == UserRoadmap.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            UserRoadmap.user_id != user.id,
            StageGateEvaluation.status == "passed",
            StageGateEvaluation.evaluated_at >= one_week_ago,
        )
        .count()
    )

    # Users in same track who completed interviews this week
    from app.models.interview import InterviewSession as IS
    interview_count = (
        db.query(IS)
        .join(User, IS.user_id == User.id)
        .join(UserRoadmap, UserRoadmap.user_id == User.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            IS.user_id != user.id,
            IS.status == "completed",
            IS.completed_at >= one_week_ago,
        )
        .count()
    )

    # Users who submitted tickets this week
    ticket_count = (
        db.query(TicketSubmission)
        .join(UserRoadmap, TicketSubmission.roadmap_id == UserRoadmap.id)
        .filter(
            UserRoadmap.career_track_id == track_id,
            TicketSubmission.user_id != user.id,
            TicketSubmission.submitted_at >= one_week_ago,
        )
        .count()
    )

    signals = []
    if advanced_count > 0:
        signals.append({
            "type": "stage_advance",
            "message": f"{advanced_count} {'person' if advanced_count == 1 else 'people'} in your career track advanced a stage this week.",
            "count": advanced_count,
        })
    if interview_count > 0:
        signals.append({
            "type": "interview",
            "message": f"{interview_count} {'person' if interview_count == 1 else 'people'} in your track completed mock interviews this week.",
            "count": interview_count,
        })
    if ticket_count > 0:
        signals.append({
            "type": "ticket",
            "message": f"{ticket_count} work tickets submitted by your cohort this week.",
            "count": ticket_count,
        })

    if not signals:
        signals.append({
            "type": "encouragement",
            "message": "Be the first in your cohort to complete an activity this week.",
            "count": 0,
        })

    return {"signals": signals, "period_days": 7}

