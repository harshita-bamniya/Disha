"""Admin: audit log viewer."""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.user import (
    AuditLog,
    User,
)
from app.modules.admin.schemas import (
    AuditLogEntry,
    AuditLogPage,
)


def list_audit_logs(
    db: Session,
    user_id: str | None = None,
    action: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditLogPage:
    query = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    return AuditLogPage(
        total=total,
        items=[
            AuditLogEntry(
                id=str(log.id), actor_email=actor.email if actor else None,
                actor_phone=actor.phone if actor else None,
                action=log.action, resource=log.resource,
                resource_id=str(log.resource_id) if log.resource_id else None,
                ip_address=str(log.ip_address) if log.ip_address else None,
                previous_value=log.previous_value, new_value=log.new_value,
                created_at=log.created_at,
            )
            for log, actor in rows
        ],
    )

