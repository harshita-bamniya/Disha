"""Scheduled privacy housekeeping."""
import logging

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.privacy_tasks.purge_resume_scans")
def purge_resume_scans() -> dict:
    """Delete resume-match scans older than the configured retention window."""
    from app.config import get_settings
    from app.database import SessionLocal
    from app.modules.resume_match import privacy

    days = get_settings().resume_match_retention_days
    db = SessionLocal()
    try:
        n = privacy.purge_expired(db, days)
    finally:
        db.close()
    logger.info("[PRIVACY] purged %d resume-match scans older than %d days", n, days)
    return {"purged": n, "retention_days": days}
