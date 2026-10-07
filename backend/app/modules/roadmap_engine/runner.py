"""Runs one roadmap generation. Shared by the Celery task (normal path) and the
in-process fallback used only when the broker is unreachable.

Idempotent: a redelivered task (worker lost mid-run, acks_late) starts over
cleanly, and a plan that is no longer `generating` (cancelled, already finished)
is left alone.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import sentry_sdk

logger = logging.getLogger(__name__)


class _Cancelled(Exception):
    pass


async def run_plan_generation(
    plan_id: str,
    job_id: str,
    user_id: str,
    facts: dict[str, Any],
    burnout: float | None,
    old_progress: dict[str, Any] | None,
    self_ratings: dict[str, int] | None = None,
) -> str:
    """Returns the final status: ready | failed | cancelled | skipped."""
    from app.database import SessionLocal
    from app.models.job_plan import JobLearningPlan
    from app.models.user import AspirantProfile, JobPosting
    from app.modules.roadmap_engine.engine import build_plan

    pid = uuid.UUID(str(plan_id))
    db = SessionLocal()

    def set_step(step: str, detail: dict | None = None) -> None:
        values: dict[str, Any] = {"generation_step": step}
        if detail is not None:
            values["generation_detail"] = detail
        db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).update(values)
        db.commit()

    def still_generating() -> bool:
        """The user cancels by deleting the plan row while it generates; check between steps."""
        db.expire_all()
        current = db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
        return current is not None and current.status == "generating"

    try:
        if not still_generating():
            return "skipped"
        try:
            job = db.query(JobPosting).filter(JobPosting.id == uuid.UUID(str(job_id))).first()
            if not job:
                raise RuntimeError("Job no longer exists.")
            profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == uuid.UUID(str(user_id))).first()
            result = await build_plan(
                db, job, profile, facts, burnout, old_progress or {}, set_step,
                cancelled=lambda: not still_generating(),
                self_ratings=self_ratings,
            )
            if not still_generating():
                raise _Cancelled()
            plan = db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
            plan.plan = result
            plan.status = "ready"
            db.commit()
            return "ready"
        except (_Cancelled, asyncio.CancelledError):
            logger.info("Plan generation %s cancelled by user.", pid)
            return "cancelled"
        except Exception as exc:
            logger.error("Plan gen failed %s: %s", pid, exc, exc_info=True)
            sentry_sdk.capture_exception(exc)
            db.rollback()
            plan = db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
            if plan:
                plan.status = "failed"
                plan.error_msg = str(exc)[:500]
                db.commit()
            return "failed"
    finally:
        db.close()
