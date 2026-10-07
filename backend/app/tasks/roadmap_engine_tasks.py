"""Celery task for roadmap generation (engine v2).

Runs on its own `roadmap` queue so a slow generation (blueprint drafting can wait
minutes on LLM rate limits) never starves email/notification tasks, and so a web
deploy or restart no longer kills a roadmap that is mid-run.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)

ROADMAP_QUEUE = "roadmap"


@celery_app.task(
    name="app.tasks.roadmap_engine_tasks.generate_job_plan_task",
    # A first-time role blueprint plus ranking every skill's videos can take many minutes.
    soft_time_limit=1500,
    time_limit=1560,
    # No autoretry: the runner records failure on the plan row, and the user can retry from the UI.
    # A worker lost mid-run is redelivered (acks_late) and the runner starts over idempotently.
)
def generate_job_plan_task(
    plan_id: str,
    job_id: str,
    user_id: str,
    facts: dict[str, Any],
    burnout: float | None,
    old_progress: dict[str, Any] | None,
    self_ratings: dict[str, int] | None = None,
) -> str:
    from app.modules.roadmap_engine.runner import run_plan_generation

    status = asyncio.run(run_plan_generation(plan_id, job_id, user_id, facts, burnout, old_progress, self_ratings))
    logger.info("[ROADMAP_TASK] plan=%s finished: %s", plan_id, status)
    return status


@celery_app.task(
    name="app.tasks.roadmap_engine_tasks.prepare_blueprint_for_job_task",
    soft_time_limit=1500,
    time_limit=1560,
)
def prepare_blueprint_for_job_task(job_id: str) -> str:
    """Make sure a published job has a role blueprint ready, so the first aspirant to target it
    doesn't wait minutes for one to be drafted. Best-effort: if this fails, the blueprint is
    simply drafted on demand when the first roadmap is requested."""
    from app.database import SessionLocal
    from app.models.user import JobPosting
    from app.modules.roadmap_engine.blueprint import get_or_draft_blueprint

    db = SessionLocal()
    try:
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job or job.status != "published":
            return "skipped"
        bp = asyncio.run(get_or_draft_blueprint(db, job))
        logger.info("[BLUEPRINT_PREP] job=%s title=%r -> blueprint %s v%d (%s)", job_id, job.title, bp.slug, bp.version, bp.review_status)
        return "ready"
    except Exception as exc:
        logger.warning("[BLUEPRINT_PREP] job=%s failed (will draft on demand): %s", job_id, exc)
        return "failed"
    finally:
        db.close()
