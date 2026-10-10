"""Daily-activity recording (feeds the active-user numbers on the admin dashboard)."""
from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


def record_activity(db: Session, user_id) -> None:
    """Mark `user_id` as active today (India time). Idempotent, and never allowed to break the caller:
    it runs in a savepoint so a failure cannot poison the surrounding transaction."""
    from app.models.analytics import UserActivityDaily

    try:
        with db.begin_nested():
            db.execute(
                insert(UserActivityDaily)
                .values(user_id=user_id, activity_date=datetime.now(IST).date())
                .on_conflict_do_nothing(index_elements=["user_id", "activity_date"])
            )
    except Exception:
        logger.exception("[ACTIVITY] could not record activity for user=%s", user_id)
