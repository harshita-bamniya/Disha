import logging

from celery import Celery
from celery.schedules import crontab

import app.models  # noqa: F401 — registers every model class before any task's mappers configure
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
        # Recalibrate all active roadmaps weekly with fresh job market data.
        # Runs Sunday 5am IST — after job embeddings refresh.
        "recalibrate-roadmaps": {
            "task": "app.tasks.roadmap_tasks.recalibrate_all_roadmaps",
            "schedule": crontab(hour=5, minute=0, day_of_week=0),
        },
        # Reset weekly XP counters every Sunday at 6am IST
        "reset-weekly-xp": {
            "task": "app.tasks.worker.reset_weekly_xp",
            "schedule": crontab(hour=6, minute=0, day_of_week=0),
        },
        # Notify aspirants whose targeted-job (roadmap) deadlines are approaching
        # but they haven't applied yet. Daily 7am IST.
        "job-deadline-reminders": {
            "task": "app.tasks.worker.send_deadline_reminders",
            "schedule": crontab(hour=7, minute=0),
        },
        # Digest of new high-match jobs posted in the last day. Daily 8am IST —
        # after the deadline reminder so a user doesn't get two pings back to back.
        "job-match-digest": {
            "task": "app.tasks.worker.send_job_match_digest",
            "schedule": crontab(hour=8, minute=0),
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
    """
    Embed a job posting:
      1. Build a rich text from title + description + skills + metadata and
         store the vector in job_postings.description_embedding (for ANN retrieval).
      2. Embed each required_skill individually and upsert into skill_vectors
         so semantic skill-overlap matching works at query time.
    No external API is called — only the local fastembed model.
    """
    from app.database import SessionLocal
    from app.models.user import JobPosting
    from app.models.mvp2 import SkillVector
    from app.modules.recommendations import embedder

    db = SessionLocal()
    try:
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            logger.warning("[EMBED_JOB] Job %s not found — skipping", job_id)
            return

        # 1. Embed full job document
        text = embedder.build_job_text(job)
        vec = embedder.embed(text)
        if vec:
            job.description_embedding = vec
            logger.info("[EMBED_JOB] Description embedding stored for job=%s", job_id)
        else:
            logger.warning("[EMBED_JOB] Empty description embedding for job=%s", job_id)

        # 2. Embed required_skills into skill_vectors cache
        skills = list(job.required_skills or [])
        if skills:
            normalised = [s.lower().strip() for s in skills]
            existing = {
                r.skill_text
                for r in db.query(SkillVector.skill_text)
                .filter(SkillVector.skill_text.in_(normalised))
                .all()
            }
            to_embed = [s for s in normalised if s not in existing]
            if to_embed:
                vecs = embedder.embed_batch(to_embed)
                for skill_text, skill_vec in zip(to_embed, vecs):
                    if skill_vec is not None:
                        db.merge(SkillVector(skill_text=skill_text, embedding=skill_vec))
                logger.info("[EMBED_JOB] Cached %d skill vectors for job=%s", len(to_embed), job_id)

        db.commit()
    except Exception as exc:
        logger.error("[EMBED_JOB] Failed for job=%s: %s", job_id, exc)
        raise
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


# ── Skill embedding cache task ────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.tasks.worker.embed_skill_texts",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def embed_skill_texts(self, skills: list[str]) -> None:
    """Embed a list of skill strings and upsert into the skill_vectors cache.

    Idempotent — already-cached skills are skipped.
    Called after user saves skills and after AI job skill extraction completes.
    """
    from app.database import SessionLocal
    from app.models.mvp2 import SkillVector
    from app.modules.recommendations import embedder

    if not skills:
        return

    db = SessionLocal()
    try:
        normalised = [s.lower().strip() for s in skills]
        existing = {
            row.skill_text
            for row in db.query(SkillVector.skill_text)
            .filter(SkillVector.skill_text.in_(normalised))
            .all()
        }
        to_embed = [s for s in normalised if s not in existing]
        if not to_embed:
            return

        vecs = embedder.embed_batch(to_embed)
        for skill_text, vec in zip(to_embed, vecs):
            if vec is not None:
                db.merge(SkillVector(skill_text=skill_text, embedding=vec))

        db.commit()
        logger.info("[SKILL_EMBED] Cached %d new skill vectors", len(to_embed))
    except Exception as exc:
        logger.error("[SKILL_EMBED] Failed: %s", exc)
        db.rollback()
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


@celery_app.task(name="app.tasks.worker.reset_weekly_xp")
def reset_weekly_xp() -> dict:
    """Reset xp_this_week to 0 for all users every Sunday."""
    from app.database import SessionLocal
    from app.modules.xp.service import reset_weekly_xp as _reset

    db = SessionLocal()
    try:
        count = _reset(db)
        return {"reset_count": count}
    except Exception as exc:
        logger.error("[XP_RESET] Failed: %s", exc)
        db.rollback()
        return {"reset_count": 0, "error": str(exc)}
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


@celery_app.task(name="app.tasks.worker.send_deadline_reminders")
def send_deadline_reminders() -> dict:
    """Notifies an aspirant when a job they've targeted (generated a roadmap
    for) is closing soon and they haven't applied yet — previously there was
    no proactive nudge at all; the platform only let people pull, not receive.

    Runs daily, so a job closing in 3 days can fire this up to 3 times as the
    deadline approaches — no dedupe table is kept. Treated as a feature
    (reminders intensify near the deadline), not a bug, but documented here
    since it differs from a typical "send once" notification.
    """
    from datetime import date, timedelta
    from app.database import SessionLocal
    from app.models.job_plan import JobLearningPlan
    from app.models.mvp3 import Application
    from app.models.user import JobPosting
    from app.modules.inbox.service import create_notification

    db = SessionLocal()
    sent = 0
    try:
        cutoff = date.today() + timedelta(days=3)
        rows = (
            db.query(JobLearningPlan, JobPosting)
            .join(JobPosting, JobLearningPlan.job_id == JobPosting.id)
            .filter(
                JobPosting.is_active == True,
                JobPosting.expires_at != None,
                JobPosting.expires_at <= cutoff,
                JobPosting.expires_at >= date.today(),
            )
            .all()
        )
        for plan, job in rows:
            already_applied = (
                db.query(Application)
                .filter(Application.aspirant_id == plan.user_id, Application.job_id == job.id)
                .first()
            )
            if already_applied:
                continue
            days_left = (job.expires_at - date.today()).days
            create_notification(
                db, plan.user_id, "deadline_reminder",
                f"Closing soon: {job.title}",
                f"You've been preparing for this role — applications close in {days_left} day{'s' if days_left != 1 else ''}.",
                f"/app/jobs/{job.id}",
            )
            sent += 1
        db.commit()
        logger.info("[DEADLINE_REMINDER] Sent %d reminders", sent)
        return {"sent": sent}
    except Exception as exc:
        logger.error("[DEADLINE_REMINDER] Failed: %s", exc)
        db.rollback()
        return {"sent": sent, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.send_job_match_digest")
def send_job_match_digest() -> dict:
    """Daily digest notification for high-match jobs posted in the last 24h —
    previously an aspirant had no way to learn about a new strong match
    without manually re-browsing the jobs list."""
    from datetime import datetime, timedelta, timezone
    from app.database import SessionLocal
    from app.models.user import AspirantProfile, JobPosting, KrsScore
    from app.modules.inbox.service import create_notification
    from app.modules.recommendations.ranker import rank_jobs_for_user

    MATCH_THRESHOLD = 70

    db = SessionLocal()
    sent = 0
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=1)
        recent_job_exists = db.query(JobPosting).filter(JobPosting.created_at >= cutoff, JobPosting.is_active == True).first()
        if not recent_job_exists:
            return {"sent": 0, "skipped": "no new jobs in the last 24h"}

        profiles = (
            db.query(AspirantProfile)
            .filter(AspirantProfile.is_completed == True)
            .all()
        )
        for profile in profiles:
            krs = db.query(KrsScore).filter(KrsScore.user_id == profile.user_id).first()
            try:
                ranked, _ = rank_jobs_for_user(
                    profile, krs, db,
                    extra_sql_filters=[JobPosting.created_at >= cutoff],
                    limit=5,
                )
            except Exception as exc:
                logger.warning("[JOB_MATCH_DIGEST] Ranking failed for user %s: %s", profile.user_id, exc)
                continue

            strong_matches = [r for r in ranked if r.match_score >= MATCH_THRESHOLD]
            if not strong_matches:
                continue

            top = strong_matches[0]
            count = len(strong_matches)
            create_notification(
                db, profile.user_id, "job_match_digest",
                f"{count} new job{'s' if count != 1 else ''} match your profile",
                f"Top match: {top.job.title} ({top.match_score}% match)." + (f" Plus {count - 1} more." if count > 1 else ""),
                "/app/jobs",
            )
            sent += 1
        db.commit()
        logger.info("[JOB_MATCH_DIGEST] Sent %d digests", sent)
        return {"sent": sent}
    except Exception as exc:
        logger.error("[JOB_MATCH_DIGEST] Failed: %s", exc)
        db.rollback()
        return {"sent": sent, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="app.tasks.worker.send_notification_email",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
)
def send_notification_email(
    self, to: str, subject: str, html: str,
    ics_content: str | None = None, ics_filename: str | None = None,
) -> None:
    """Sends a single notification email out-of-band, so request handlers
    (new application, status change, interview scheduled, etc.) never wait
    on the email provider. Raises on failure so Celery's autoretry kicks in —
    unlike app.core.email.send_email, which swallows errors for direct callers."""
    import asyncio
    from app.core.email import get_email_provider

    attachment = (ics_filename, ics_content, "calendar") if ics_content else None
    provider = get_email_provider()
    asyncio.run(provider.send(to, subject, html, attachment))
