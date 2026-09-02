"""Shared helpers for the admin service split (audit logging, IP formatting)."""
import ipaddress
import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.user import (
    AuditLog,
)


def _safe_ip(host: str | None) -> str | None:
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return None


def _write_audit(
    db: Session, actor_id: str | None, action: str, resource: str | None = None,
    resource_id: str | None = None, previous_value: dict | None = None, new_value: dict | None = None,
    request: Request | None = None,
) -> None:
    """Records a moderation action for the audit log viewer. Caller still owns db.commit()."""
    ip: str | None = None
    if request:
        forwarded = request.headers.get("X-Forwarded-For")
        raw = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
        ip = _safe_ip(raw)
    db.add(AuditLog(
        user_id=uuid.UUID(actor_id) if actor_id else None,
        action=action, resource=resource,
        resource_id=uuid.UUID(resource_id) if resource_id else None,
        previous_value=previous_value, new_value=new_value,
        ip_address=ip,
    ))

