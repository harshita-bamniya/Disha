"""Celery tasks for the Roadmap Intelligence System.

  review_ticket_async      — AI review of a ticket submission (triggered on submit)
  recalibrate_all_roadmaps — Weekly recalibration of all active roadmaps
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.roadmap_tasks.review_ticket_async",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def review_ticket_async(self, submission_id: str) -> dict:
    """Run AI work review for a ticket submission.

    Fetches submission + ticket template, calls work_reviewer.review_ticket_submission(),
    then stores the result on the TicketSubmission row.
    """
    from app.database import SessionLocal
    from app.models.roadmap import TicketSubmission, TicketTemplate
    from app.models.user import CareerTrack
    from app.ai.work_reviewer import review_ticket_submission

    db = SessionLocal()
    try:
        sub = db.query(TicketSubmission).filter(TicketSubmission.id == submission_id).first()
        if not sub:
            logger.warning("[TICKET_REVIEW] Submission %s not found", submission_id)
            return {"error": "not_found"}

        # Mark as reviewing
        sub.review_status = "reviewing"
        db.commit()

        ticket = db.query(TicketTemplate).filter(TicketTemplate.id == sub.ticket_id).first()
        if not ticket:
            sub.review_status = "failed"
            db.commit()
            return {"error": "ticket_not_found"}

        career_track_name = "General"
        if ticket.career_track_id:
            track = db.query(CareerTrack).filter(CareerTrack.id == ticket.career_track_id).first()
            career_track_name = track.title if track else "General"

        # Run async AI call in sync Celery context
        result = asyncio.run(review_ticket_submission(
            submission_text=sub.submission_text,
            ticket_title=ticket.title,
            ticket_context=ticket.context,
            ticket_deliverable=ticket.deliverable,
            rubric=ticket.evaluation_rubric or {},
            career_track=career_track_name,
            difficulty=ticket.difficulty,
        ))

        sub.ai_review_result = result
        sub.review_status = "done" if not result.get("error") else "failed"
        sub.ai_reviewed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            "[TICKET_REVIEW] Completed for submission=%s score=%s",
            submission_id, result.get("overall_score"),
        )
        return {"submission_id": submission_id, "score": result.get("overall_score")}

    except Exception as exc:
        logger.error("[TICKET_REVIEW] Failed for submission=%s: %s", submission_id, exc)
        try:
            sub = db.query(TicketSubmission).filter(TicketSubmission.id == submission_id).first()
            if sub:
                sub.review_status = "failed"
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.roadmap_tasks.recalibrate_all_roadmaps")
def recalibrate_all_roadmaps() -> dict:
    """Weekly: recalibrate all active roadmaps with fresh job market data.

    For each active UserRoadmap:
    - Re-fetch top-5 jobs for the career track
    - Recompute gap_skills ordering
    - Recompute JRS
    Runs Sunday 5am IST (registered in worker.py beat_schedule).
    """
    from app.database import SessionLocal
    from app.models.roadmap import UserRoadmap
    from app.modules.roadmap.service import recalibrate_roadmap

    db = SessionLocal()
    recalibrated = 0
    failed = 0
    try:
        roadmaps = db.query(UserRoadmap).filter(UserRoadmap.is_active == True).all()
        for roadmap in roadmaps:
            try:
                recalibrate_roadmap(roadmap, db)
                recalibrated += 1
            except Exception as exc:
                logger.warning("[RECALIBRATE] Failed for roadmap=%s: %s", roadmap.id, exc)
                failed += 1

        logger.info("[RECALIBRATE] Done — %d recalibrated, %d failed", recalibrated, failed)
        return {"recalibrated": recalibrated, "failed": failed}
    except Exception as exc:
        logger.error("[RECALIBRATE] Task failed: %s", exc)
        return {"recalibrated": recalibrated, "failed": failed, "error": str(exc)}
    finally:
        db.close()
