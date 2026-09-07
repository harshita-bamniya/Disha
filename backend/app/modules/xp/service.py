"""XP Service — award and query XP for aspirants."""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.xp import UserXP, XPTransaction, XP_AWARDS, compute_level

logger = logging.getLogger(__name__)


def award_xp(
    user_id: UUID | str,
    event_type: str,
    ref_id: str | None = None,
    note: str | None = None,
    db: Session = None,
) -> int:
    """Award XP for an event. Returns the new xp_total. No-ops if event_type is unknown."""
    delta = XP_AWARDS.get(event_type)
    if not delta:
        logger.warning("[XP] Unknown event_type=%s, skipping", event_type)
        return 0
    if db is None:
        logger.warning("[XP] No db session passed for award_xp, skipping")
        return 0

    uid = str(user_id)

    # Upsert UserXP row
    row = db.query(UserXP).filter(UserXP.user_id == uid).with_for_update().first()
    if not row:
        row = UserXP(user_id=uid, xp_total=0, xp_this_week=0, level=1)
        db.add(row)
        db.flush()

    row.xp_total += delta
    row.xp_this_week += delta
    row.level = compute_level(row.xp_total)

    tx = XPTransaction(
        user_id=uid,
        xp_delta=delta,
        event_type=event_type,
        ref_id=str(ref_id) if ref_id else None,
        note=note,
    )
    db.add(tx)
    db.flush()

    logger.info("[XP] user=%s event=%s delta=%d total=%d", uid, event_type, delta, row.xp_total)
    return row.xp_total


def get_xp_summary(user_id: UUID | str, db: Session) -> dict:
    row = db.query(UserXP).filter(UserXP.user_id == str(user_id)).first()
    if not row:
        return {"xp_total": 0, "xp_this_week": 0, "level": 1, "next_level_at": 500}

    next_level_threshold = row.level * 500
    return {
        "xp_total": row.xp_total,
        "xp_this_week": row.xp_this_week,
        "level": row.level,
        "next_level_at": next_level_threshold,
        "xp_to_next": max(0, next_level_threshold - row.xp_total),
    }


def get_recent_transactions(user_id: UUID | str, limit: int = 10, db: Session = None) -> list[dict]:
    if db is None:
        return []
    rows = (
        db.query(XPTransaction)
        .filter(XPTransaction.user_id == str(user_id))
        .order_by(XPTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "xp_delta": r.xp_delta,
            "event_type": r.event_type,
            "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def reset_weekly_xp(db: Session) -> int:
    """Called by weekly Celery task. Resets xp_this_week for all users."""
    count = db.query(UserXP).update({"xp_this_week": 0})
    db.commit()
    logger.info("[XP] Weekly reset: cleared xp_this_week for %d users", count)
    return count
