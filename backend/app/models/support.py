"""Support ticket models for the admin support module."""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


TICKET_STATUSES = ("open", "pending", "resolved", "closed")
TICKET_PRIORITIES = ("low", "normal", "high", "urgent")
ENTITY_TYPES = ("employer", "candidate", "general")


class SupportTicket(Base):
    """A support ticket raised by or on behalf of a user."""
    __tablename__ = "support_tickets"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    subject       = Column(String(300), nullable=False)
    body          = Column(Text, nullable=True)  # initial description
    status        = Column(String(20), nullable=False, default="open", server_default="open",
                           index=True)
    priority      = Column(String(10), nullable=False, default="normal", server_default="normal",
                           index=True)

    # Who the ticket is about
    entity_type   = Column(String(20), nullable=False, default="general", server_default="general")
    entity_id     = Column(UUID(as_uuid=True), nullable=True)  # employer/aspirant user_id

    # Reporter — the user who submitted the ticket (may be null for admin-created)
    reporter_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True, index=True)

    # Assigned admin
    assigned_to   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True, index=True)

    # Category & optional context links
    category      = Column(String(40), nullable=False, default="general", server_default="general")
    context_job_id         = Column(UUID(as_uuid=True), ForeignKey("job_postings.id",    ondelete="SET NULL"), nullable=True)
    context_application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id",   ondelete="SET NULL"), nullable=True)

    # SLA deadline (set on creation based on priority)
    sla_deadline  = Column(DateTime(timezone=True), nullable=True)

    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                            onupdate=func.now(), nullable=False)
    resolved_at   = Column(DateTime(timezone=True), nullable=True)
    closed_at     = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(f"status IN {TICKET_STATUSES}", name="ck_ticket_status"),
        CheckConstraint(f"priority IN {TICKET_PRIORITIES}", name="ck_ticket_priority"),
        CheckConstraint(f"entity_type IN {ENTITY_TYPES}", name="ck_ticket_entity_type"),
    )

    reporter    = relationship("User", foreign_keys=[reporter_id])
    assignee    = relationship("User", foreign_keys=[assigned_to])
    messages    = relationship("TicketMessage", back_populates="ticket",
                               cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    attachments = relationship("TicketAttachment", back_populates="ticket",
                                cascade="all, delete-orphan")


class TicketMessage(Base):
    """A message in a support ticket thread. is_internal = admin-only note."""
    __tablename__ = "ticket_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ticket_id  = Column(UUID(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    sender_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                         nullable=True)
    body       = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ticket  = relationship("SupportTicket", back_populates="messages")
    sender  = relationship("User", foreign_keys=[sender_id])


class TicketAttachment(Base):
    """A file attached to a support ticket."""
    __tablename__ = "ticket_attachments"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ticket_id     = Column(UUID(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    uploaded_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True)
    file_key      = Column(String(500), nullable=False)   # S3 / storage key
    filename      = Column(String(300), nullable=False)
    content_type  = Column(String(100), nullable=True)
    size_bytes    = Column(Integer, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ticket   = relationship("SupportTicket", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by])
