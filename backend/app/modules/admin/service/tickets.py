"""Admin: support ticket management."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    User,
)
from app.modules.admin.service import core


def _ticket_to_entry(t) -> dict:
    return dict(
        id=str(t.id),
        subject=t.subject,
        status=t.status,
        priority=t.priority,
        entity_type=t.entity_type,
        category=getattr(t, "category", "general"),
        entity_id=str(t.entity_id) if t.entity_id else None,
        reporter_id=str(t.reporter_id) if t.reporter_id else None,
        reporter_name=getattr(t.reporter, "full_name", None) or (getattr(t.reporter, "phone", None) if t.reporter else None),
        reporter_phone=getattr(t.reporter, "phone", None) if t.reporter else None,
        assigned_to=str(t.assigned_to) if t.assigned_to else None,
        assignee_name=getattr(t.assignee, "full_name", None) or (getattr(t.assignee, "phone", None) if t.assignee else None),
        sla_deadline=t.sla_deadline,
        message_count=len(t.messages) if t.messages is not None else 0,
        created_at=t.created_at,
        updated_at=t.updated_at,
        resolved_at=t.resolved_at,
        closed_at=t.closed_at,
    )


def list_tickets(
    db: Session,
    *,
    status: str | None = None,
    priority: str | None = None,
    entity_type: str | None = None,
    category: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    from app.models.support import SupportTicket
    q = db.query(SupportTicket)
    if status:
        q = q.filter(SupportTicket.status == status)
    if priority:
        q = q.filter(SupportTicket.priority == priority)
    if entity_type:
        q = q.filter(SupportTicket.entity_type == entity_type)
    if category:
        q = q.filter(SupportTicket.category == category)
    if search:
        q = q.filter(SupportTicket.subject.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_ticket_to_entry(t) for t in items]}


def get_ticket(ticket_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    entry = _ticket_to_entry(t)
    entry["body"] = t.body
    entry["messages"] = [
        dict(
            id=str(m.id),
            sender_id=str(m.sender_id) if m.sender_id else None,
            sender_name=getattr(m.sender, "full_name", None) or (getattr(m.sender, "phone", None) if m.sender else "Admin"),
            body=m.body,
            is_internal=m.is_internal,
            created_at=m.created_at,
        )
        for m in t.messages
    ]
    entry["attachments"] = [
        dict(
            id=str(a.id),
            filename=a.filename,
            content_type=a.content_type,
            size_bytes=a.size_bytes,
            file_key=a.file_key,
            uploaded_by=str(a.uploaded_by) if a.uploaded_by else None,
            created_at=a.created_at,
        )
        for a in t.attachments
    ]
    return entry


def create_ticket(req, actor_id: str, db: Session, request: Request | None = None) -> dict:
    from app.models.support import SupportTicket
    SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 168}
    now = datetime.now(timezone.utc)
    t = SupportTicket(
        subject=req.subject,
        body=req.body,
        priority=req.priority,
        entity_type=req.entity_type,
        entity_id=uuid.UUID(req.entity_id) if req.entity_id else None,
        reporter_id=uuid.UUID(req.reporter_id) if req.reporter_id else None,
        sla_deadline=now + timedelta(hours=SLA_HOURS.get(req.priority, 72)),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    core._write_audit(db, actor_id, "ticket_create", "support_ticket", str(t.id), request=request)
    return _ticket_to_entry(t)


def add_ticket_message(ticket_id: str, req, actor_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket, TicketMessage
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    msg = TicketMessage(
        ticket_id=t.id,
        sender_id=uuid.UUID(actor_id),
        body=req.body,
        is_internal=req.is_internal,
    )
    db.add(msg)
    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    sender = db.query(User).filter(User.id == uuid.UUID(actor_id)).first()
    return dict(
        id=str(msg.id),
        sender_id=actor_id,
        sender_name=getattr(sender, "full_name", None) or getattr(sender, "phone", "Admin"),
        body=msg.body,
        is_internal=msg.is_internal,
        created_at=msg.created_at,
    )


def update_ticket(ticket_id: str, req, actor_id: str, db: Session, request: Request | None = None) -> dict:
    from app.models.support import SupportTicket
    SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 168}
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise NotFoundException("Ticket not found")
    now = datetime.now(timezone.utc)
    if req.status and req.status != t.status:
        t.status = req.status
        if req.status == "resolved":
            t.resolved_at = now
        elif req.status == "closed":
            t.closed_at = now
    if req.priority and req.priority != t.priority:
        t.priority = req.priority
        t.sla_deadline = now + timedelta(hours=SLA_HOURS[req.priority])
    if req.assigned_to is not None:
        t.assigned_to = uuid.UUID(req.assigned_to) if req.assigned_to else None
    if req.category is not None:
        t.category = req.category
    t.updated_at = now
    core._write_audit(db, actor_id, "ticket_update", "support_ticket", ticket_id, request=request)
    db.commit()
    db.refresh(t)
    return _ticket_to_entry(t)

