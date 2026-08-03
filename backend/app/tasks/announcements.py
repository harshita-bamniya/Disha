"""Celery tasks for admin announcement email delivery (Session S5)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)

_BATCH_SIZE = 50


@celery_app.task(
    bind=True,
    name="app.tasks.announcements.send_announcement_emails",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_announcement_emails(self, announcement_id: str, user_ids: list[str]) -> dict:
    """Send announcement email to each target user and update delivery_status on their Notification row.

    Processes user_ids in batches of 50 and commits after each batch so a
    crash mid-run doesn't lose all progress.
    """
    from app.database import SessionLocal
    from app.models.mvp3 import AdminAnnouncement, Notification
    from app.models.user import User
    from app.core.email import get_email_provider
    from app.core.notifications import _wrap

    db = SessionLocal()
    sent = 0
    failed = 0

    try:
        ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == announcement_id).first()
        if not ann:
            logger.warning("[ANNOUNCE_EMAIL] Announcement %s not found", announcement_id)
            return {"sent": 0, "failed": 0, "error": "not_found"}

        subject = ann.title
        html = _wrap(ann.title, f"<p>{ann.body}</p>")
        provider = get_email_provider()

        total_batches = (len(user_ids) + _BATCH_SIZE - 1) // _BATCH_SIZE

        for batch_num, i in enumerate(range(0, len(user_ids), _BATCH_SIZE), start=1):
            batch_ids = user_ids[i : i + _BATCH_SIZE]
            users = db.query(User).filter(User.id.in_(batch_ids)).all()

            for user in users:
                # Find the pending announcement notification for this user
                notif = (
                    db.query(Notification)
                    .filter(
                        Notification.user_id == user.id,
                        Notification.type == "announcement",
                        Notification.delivery_status == "pending",
                    )
                    .order_by(Notification.created_at.desc())
                    .first()
                )

                if not user.email:
                    if notif:
                        notif.delivery_status = "failed"
                        notif.email_failed_reason = "no email address"
                    failed += 1
                    continue

                try:
                    asyncio.run(provider.send(user.email, subject, html))
                    if notif:
                        notif.delivery_status = "sent"
                        notif.email_sent_at = datetime.now(timezone.utc)
                    sent += 1
                except Exception as exc:
                    logger.error("[ANNOUNCE_EMAIL] Failed for user=%s: %s", user.id, exc)
                    if notif:
                        notif.delivery_status = "failed"
                        notif.email_failed_reason = str(exc)[:500]
                    failed += 1

            db.commit()
            logger.info(
                "[ANNOUNCE_EMAIL] Batch %d/%d done — sent=%d failed=%d",
                batch_num, total_batches, sent, failed,
            )

        logger.info(
            "[ANNOUNCE_EMAIL] Complete for announcement=%s sent=%d failed=%d",
            announcement_id, sent, failed,
        )
        return {"sent": sent, "failed": failed}

    except Exception as exc:
        logger.error("[ANNOUNCE_EMAIL] Task failed for announcement=%s: %s", announcement_id, exc)
        db.rollback()
        raise
    finally:
        db.close()
