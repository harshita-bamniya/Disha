"""Daily mission generation for the dashboard."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.roadmap import (
    TicketSubmission,
)
from app.models.user import (
    User,
)
from app.models.learning import LearningPath, LessonCompletion, UserLearningEnrollment

from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def get_daily_mission(user: User, db: Session) -> dict:
    """Return a single actionable mission for today based on current stage and gaps.

    Logic:
      Stage 1 → write/revise narrative
      Stage 2 → complete the next lesson in top gap skill
      Stage 3 → complete an exercise (case study or quiz)
      Stage 4 → submit or review a work ticket
      Stage 5 → do a mock interview session or polish resume
      Stage 6 → apply to a job from the target list
    """
    roadmap = core.get_roadmap(None, user, db)
    if not roadmap:
        return {
            "type": "setup",
            "title": "Generate Your Roadmap",
            "description": "Start by generating your personalised 6-stage roadmap.",
            "cta_label": "Generate Roadmap",
            "cta_path": "/app/roadmap",
            "xp_reward": 0,
        }

    stage = roadmap.current_stage
    gap_skills = roadmap.gap_skills or []
    top_gap = gap_skills[0] if gap_skills else "your target skill"

    if stage == 1:
        has_narrative = bool(roadmap.narrative_text)
        if not has_narrative:
            return {
                "type": "narrative",
                "title": "Write Your Career Narrative",
                "description": "Craft a 150-200 word story that reframes your UPSC experience in private-sector language.",
                "cta_label": "Start Narrative",
                "cta_path": "/app/roadmap",
                "xp_reward": 80,
            }
        else:
            return {
                "type": "narrative_improve",
                "title": "Improve Your Career Narrative",
                "description": f"Your narrative scored {roadmap.narrative_score or 0}/100. Review the AI feedback and submit an improved draft.",
                "cta_label": "Revise Narrative",
                "cta_path": "/app/roadmap",
                "xp_reward": 50,
            }

    if stage == 2:
        # Find next incomplete lesson in enrolled paths
        enrolled = db.query(UserLearningEnrollment).filter(
            UserLearningEnrollment.user_id == user.id,
            UserLearningEnrollment.status.in_(["enrolled", "in_progress"]),
        ).first()
        if enrolled:
            path = db.query(LearningPath).filter(LearningPath.id == enrolled.learning_path_id).first()
            completed_ids = {str(r.lesson_id) for r in
                             db.query(LessonCompletion).filter(LessonCompletion.user_id == user.id).all()}
            next_lesson = None
            for module in (path.modules if path else []):
                for lesson in module.lessons:
                    if str(lesson.id) not in completed_ids and lesson.is_active:
                        next_lesson = lesson
                        break
                if next_lesson:
                    break
            if next_lesson and path:
                return {
                    "type": "lesson",
                    "title": f"Complete: {next_lesson.title}",
                    "description": f"This lesson builds {top_gap} — a skill required by your target roles.",
                    "cta_label": "Start Lesson",
                    "cta_path": f"/app/learn/{path.id}/lessons/{next_lesson.id}",
                    "xp_reward": 10,
                }
        return {
            "type": "enroll",
            "title": f"Enroll in a Learning Path",
            "description": f"Find and enroll in a path that covers {top_gap}.",
            "cta_label": "Browse Paths",
            "cta_path": "/app/learn",
            "xp_reward": 10,
        }

    if stage == 3:
        return {
            "type": "exercise",
            "title": f"Complete a Practice Exercise",
            "description": f"Apply your {top_gap} knowledge through a hands-on case study or exercise.",
            "cta_label": "Browse Exercises",
            "cta_path": "/app/roadmap?tab=exercises",
            "xp_reward": 50,
        }

    if stage == 4:
        pending_subs = db.query(TicketSubmission).filter(
            TicketSubmission.roadmap_id == roadmap.id,
            TicketSubmission.review_status == "pending",
        ).count()
        if pending_subs > 0:
            return {
                "type": "ticket_awaiting",
                "title": "Ticket Under Review",
                "description": "You have a ticket being reviewed. Start another to build momentum.",
                "cta_label": "View Tickets",
                "cta_path": "/app/roadmap?tab=tickets",
                "xp_reward": 100,
            }
        return {
            "type": "ticket",
            "title": "Submit a Work Ticket",
            "description": "Demonstrate your skills through a real-world work simulation ticket.",
            "cta_label": "View Tickets",
            "cta_path": "/app/roadmap?tab=tickets",
            "xp_reward": 100,
        }

    if stage == 5:
        return {
            "type": "interview",
            "title": "Practice a Mock Interview",
            "description": "One 10-minute mock interview session today sharpens your answers significantly.",
            "cta_label": "Start Interview",
            "cta_path": "/app/mock-interview",
            "xp_reward": 75,
        }

    # Stage 6
    return {
        "type": "apply",
        "title": "Apply to a Target Role Today",
        "description": "Consistent applications are the only path to an offer. Submit one today.",
        "cta_label": "Browse Jobs",
        "cta_path": "/app/jobs",
        "xp_reward": 0,
    }

