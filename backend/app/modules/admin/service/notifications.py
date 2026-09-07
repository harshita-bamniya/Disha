"""Admin: notification management."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    User,
)


def list_notifications(
    db: Session,
    user_id: str | None = None,
    type_filter: str | None = None,
    delivery_status: str | None = None,
    is_read: bool | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    from app.models.notifications import Notification

    q = db.query(Notification, User).outerjoin(User, User.id == Notification.user_id)
    if user_id:
        q = q.filter(Notification.user_id == uuid.UUID(user_id))
    if type_filter:
        q = q.filter(Notification.type == type_filter)
    if delivery_status:
        q = q.filter(Notification.delivery_status == delivery_status)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)

    total = q.count()
    rows = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    items = [
        dict(
            id=str(n.id),
            user_id=str(n.user_id),
            user_email=getattr(u, "email", None),
            user_phone=getattr(u, "phone", None),
            type=n.type,
            title=n.title,
            body=n.body,
            link_url=n.link_url,
            is_read=n.is_read,
            delivery_status=n.delivery_status,
            email_sent_at=n.email_sent_at,
            email_failed_reason=n.email_failed_reason,
            created_at=n.created_at,
        )
        for n, u in rows
    ]
    return {"total": total, "items": items}


def get_notifications_stats(db: Session) -> dict:
    from app.models.notifications import Notification

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start
    ).scalar() or 0

    sent_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start,
        Notification.delivery_status == "sent",
    ).scalar() or 0

    failed_today = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= today_start,
        Notification.delivery_status == "failed",
    ).scalar() or 0

    unread_total = db.query(func.count(Notification.id)).filter(
        Notification.is_read == False  # noqa: E712
    ).scalar() or 0

    type_rows = db.query(Notification.type, func.count(Notification.id)).group_by(Notification.type).all()
    by_type = [{"label": t, "count": c} for t, c in type_rows]

    status_rows = db.query(Notification.delivery_status, func.count(Notification.id)).group_by(
        Notification.delivery_status
    ).all()
    by_delivery_status = [{"label": s or "none", "count": c} for s, c in status_rows]

    return dict(
        total_today=total_today,
        sent_today=sent_today,
        failed_today=failed_today,
        unread_total=unread_total,
        by_type=by_type,
        by_delivery_status=by_delivery_status,
    )


def delete_notification(notification_id: str, db: Session) -> dict:
    from app.models.notifications import Notification

    n = db.query(Notification).filter(Notification.id == uuid.UUID(notification_id)).first()
    if not n:
        raise NotFoundException("Notification not found")
    db.delete(n)
    db.commit()
    return {"message": "Notification deleted"}


def get_user_notifications(user_id: str, db: Session, skip: int = 0, limit: int = 50) -> dict:
    return list_notifications(db, user_id=user_id, skip=skip, limit=limit)

