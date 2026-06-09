import logging

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "disha_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_acks_late=True,          # Only ack after task completes (safer on crash)
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # Fair dispatch — don't over-prefetch
    task_soft_time_limit=120,      # 2-min soft limit — raises SoftTimeLimitExceeded
    task_time_limit=180,           # 3-min hard kill
    beat_schedule={
        # Prune expired counsellor memories daily at 2am IST
        "prune-counsellor-memories": {
            "task": "app.tasks.worker.prune_counsellor_memories",
            "schedule": crontab(hour=2, minute=0),
        },
        # Revoke expired refresh tokens weekly
        "revoke-expired-tokens": {
            "task": "app.tasks.worker.revoke_expired_refresh_tokens",
            "schedule": crontab(hour=3, minute=0, day_of_week=0),
        },
        # Re-embed all active jobs weekly so embeddings never grow stale.
        # Runs Sunday 4am IST — low-traffic window.
        "refresh-job-embeddings": {
            "task": "app.tasks.worker.refresh_job_embeddings",
            "schedule": crontab(hour=4, minute=0, day_of_week=0),
        },
    },
)


# ── Embedding tasks ────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.tasks.worker.embed_job",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def embed_job(self, job_id: str) -> None:
    """Compute and store description embedding for a job posting."""
    from app.database import SessionLocal
    from app.models.user import JobPosting
    from app.modules.recommendations import embedder

    db = SessionLocal()
    try:
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            logger.warning("[EMBED_JOB] Job %s not found — skipping", job_id)
            return

        text = embedder.build_job_text(job)
        vec = embedder.embed(text)
        if vec:
            job.description_embedding = vec
            db.commit()
            logger.info("[EMBED_JOB] Embedding stored for job=%s", job_id)
        else:
            logger.warning("[EMBED_JOB] Empty embedding for job=%s", job_id)
    except Exception as exc:
        logger.error("[EMBED_JOB] Failed for job=%s: %s", job_id, exc)
        raise  # Let Celery retry
    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="app.tasks.worker.embed_profile",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def embed_profile(self, user_id: str) -> None:
    """Compute and store profile embedding for a user's KRS score."""
    from app.database import SessionLocal
    from app.models.user import AspirantProfile, KrsScore, PsychologicalAssessment
    from app.modules.recommendations import embedder

    db = SessionLocal()
    try:
        profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user_id).first()
        if not profile:
            logger.warning("[EMBED_PROFILE] Profile not found for user=%s", user_id)
            return

        psych = db.query(PsychologicalAssessment).filter(
            PsychologicalAssessment.user_id == user_id
        ).first()
        krs = db.query(KrsScore).filter(KrsScore.user_id == user_id).first()
        if not krs:
            logger.warning("[EMBED_PROFILE] KRS record not found for user=%s", user_id)
            return

        text = embedder.build_user_text(profile, psych)
        vec = embedder.embed(text)
        if vec:
            krs.profile_embedding = vec
            db.commit()
            logger.info("[EMBED_PROFILE] Embedding stored for user=%s", user_id)
    except Exception as exc:
        logger.error("[EMBED_PROFILE] Failed for user=%s: %s", user_id, exc)
        raise
    finally:
        db.close()


# ── Maintenance tasks ─────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.worker.prune_counsellor_memories")
def prune_counsellor_memories() -> dict:
    """
    Remove expired counsellor memories and cap each user at 50 active memories
    (keeping the most recent and highest importance).
    """
    from datetime import datetime, timezone
    from app.database import SessionLocal
    from app.models.mvp2 import CounsellorMemory
    from sqlalchemy import func

    db = SessionLocal()
    removed = 0
    try:
        # Delete expired memories
        now = datetime.now(timezone.utc)
        expired = db.query(CounsellorMemory).filter(
            CounsellorMemory.expires_at < now,
            CounsellorMemory.is_active == True,
        ).all()
        for m in expired:
            m.is_active = False
        removed += len(expired)

        # Cap per-user active memories at 50 (remove oldest low-importance)
        user_counts = (
            db.query(CounsellorMemory.user_id, func.count(CounsellorMemory.id))
            .filter(CounsellorMemory.is_active == True)
            .group_by(CounsellorMemory.user_id)
            .having(func.count(CounsellorMemory.id) > 50)
            .all()
        )
        importance_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        for user_id, count in user_counts:
            excess = count - 50
            memories = (
                db.query(CounsellorMemory)
                .filter(CounsellorMemory.user_id == user_id, CounsellorMemory.is_active == True)
                .order_by(CounsellorMemory.created_at.asc())
                .all()
            )
            # Sort: lowest importance first, then oldest
            memories.sort(key=lambda m: (importance_order.get(m.importance, 99), m.created_at))
            for m in memories[:excess]:
                m.is_active = False
            removed += excess

        db.commit()
        logger.info("[PRUNE_MEMORIES] Deactivated %d memories", removed)
        return {"removed": removed}
    except Exception as exc:
        logger.error("[PRUNE_MEMORIES] Failed: %s", exc)
        db.rollback()
        return {"removed": 0, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.refresh_job_embeddings")
def refresh_job_embeddings() -> dict:
    """Re-queue embedding for every active job posting.

    Runs weekly so embeddings stay fresh after model updates or description edits
    that happened to miss the synchronous trigger.  Each embed_job task is
    idempotent — it overwrites the existing vector.
    """
    from app.database import SessionLocal
    from app.models.user import JobPosting

    db = SessionLocal()
    queued = 0
    try:
        job_ids = [str(jid) for (jid,) in db.query(JobPosting.id).filter(JobPosting.is_active == True).all()]
        for job_id in job_ids:
            try:
                embed_job.delay(job_id)
                queued += 1
            except Exception as exc:
                logger.warning("[REFRESH_EMBED] Could not queue embed_job for %s: %s", job_id, exc)
        logger.info("[REFRESH_EMBED] Queued %d job embedding refresh tasks", queued)
        return {"queued": queued}
    except Exception as exc:
        logger.error("[REFRESH_EMBED] Failed: %s", exc)
        return {"queued": queued, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.revoke_expired_refresh_tokens")
def revoke_expired_refresh_tokens() -> dict:
    """Hard-delete refresh token rows that expired more than 7 days ago."""
    from datetime import datetime, timedelta, timezone
    from app.database import SessionLocal
    from app.models.user import RefreshToken

    db = SessionLocal()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    try:
        deleted = db.query(RefreshToken).filter(
            RefreshToken.expires_at < cutoff
        ).delete()
        db.commit()
        logger.info("[TOKEN_CLEANUP] Deleted %d expired refresh tokens", deleted)
        return {"deleted": deleted}
    except Exception as exc:
        logger.error("[TOKEN_CLEANUP] Failed: %s", exc)
        db.rollback()
        return {"deleted": 0, "error": str(exc)}
    finally:
        db.close()
