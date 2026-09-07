"""User-facing support ticket endpoints.

Employers:  /employer/support/tickets[/{id}[/messages]]
Candidates: /me/support/tickets[/{id}[/messages]]
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_employer, get_current_user
from app.database import get_db
from app.models.user import User, EmployerProfile
from app.models.support import SupportTicket, TicketMessage
from app.modules.admin.schemas import TicketEntry, TicketDetailResponse, TicketListResponse, TicketMessageEntry
from app.modules.support.schemas import UserCreateTicketRequest, UserAddMessageRequest

employer_router = APIRouter(prefix="/employer/support", tags=["Employer Support"])
candidate_router = APIRouter(prefix="/me/support", tags=["Candidate Support"])

SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 168}
VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


# ── Shared helpers ────────────────────────────────────────────────────────────

def _get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Employer profile not found.")
    return profile


def _ticket_to_entry(t: SupportTicket) -> dict:
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


def _ticket_to_detail(t: SupportTicket) -> dict:
    entry = _ticket_to_entry(t)
    entry["body"] = t.body
    entry["messages"] = [
        dict(
            id=str(m.id),
            sender_id=str(m.sender_id) if m.sender_id else None,
            sender_name=getattr(m.sender, "full_name", None) or (getattr(m.sender, "phone", None) if m.sender else "Support"),
            body=m.body,
            is_internal=m.is_internal,
            created_at=m.created_at,
        )
        for m in t.messages
        if not m.is_internal  # never expose internal notes to users
    ]
    entry["attachments"] = []
    return entry


def _create_ticket(
    db: Session,
    req: UserCreateTicketRequest,
    entity_type: str,
    entity_id: uuid.UUID,
    reporter_id: uuid.UUID,
) -> dict:
    priority = req.priority if req.priority in VALID_PRIORITIES else "normal"
    now = datetime.now(timezone.utc)
    t = SupportTicket(
        subject=req.subject,
        body=req.body,
        priority=priority,
        category=req.category or "general",
        entity_type=entity_type,
        entity_id=entity_id,
        reporter_id=reporter_id,
        context_job_id=uuid.UUID(req.context_job_id) if req.context_job_id else None,
        context_application_id=uuid.UUID(req.context_application_id) if req.context_application_id else None,
        sla_deadline=now + timedelta(hours=SLA_HOURS.get(priority, 72)),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _ticket_to_entry(t)


def _add_message(db: Session, ticket: SupportTicket, sender_id: uuid.UUID, body: str) -> dict:
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=sender_id,
        body=body,
        is_internal=False,
    )
    db.add(msg)
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    sender = db.query(User).filter(User.id == sender_id).first()
    return dict(
        id=str(msg.id),
        sender_id=str(sender_id),
        sender_name=getattr(sender, "full_name", None) or getattr(sender, "phone", "User"),
        body=msg.body,
        is_internal=False,
        created_at=msg.created_at,
    )


# ── Employer endpoints ────────────────────────────────────────────────────────

@employer_router.post("/tickets", response_model=TicketEntry)
def employer_create_ticket(
    req: UserCreateTicketRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    profile = _get_employer_profile(current_user, db)
    return _create_ticket(db, req, "employer", profile.id, current_user.id)


@employer_router.get("/tickets", response_model=TicketListResponse)
def employer_list_tickets(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return {"total": len(tickets), "items": [_ticket_to_entry(t) for t in tickets]}


@employer_router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
def employer_get_ticket(
    ticket_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if str(t.reporter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _ticket_to_detail(t)


@employer_router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageEntry)
def employer_add_message(
    ticket_id: str,
    req: UserAddMessageRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if str(t.reporter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _add_message(db, t, current_user.id, req.body)


# ── Candidate endpoints ───────────────────────────────────────────────────────

@candidate_router.post("/tickets", response_model=TicketEntry)
def candidate_create_ticket(
    req: UserCreateTicketRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_ticket(db, req, "candidate", current_user.id, current_user.id)


@candidate_router.get("/tickets", response_model=TicketListResponse)
def candidate_list_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return {"total": len(tickets), "items": [_ticket_to_entry(t) for t in tickets]}


@candidate_router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
def candidate_get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if str(t.reporter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _ticket_to_detail(t)


@candidate_router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageEntry)
def candidate_add_message(
    ticket_id: str,
    req: UserAddMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == uuid.UUID(ticket_id)).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if str(t.reporter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _add_message(db, t, current_user.id, req.body)
