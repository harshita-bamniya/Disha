"""SQLAlchemy ORM models for the in-app notification inbox and admin broadcasts.

There was previously no in-product notification surface at all (only outbound
email); recruiters had to live in their inbox instead of the app. This closes
that gap.
"""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
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


NOTIFICATION_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    # Aspirant-side — added when the inbox was extended beyond employers
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
    # Offer letter e-signature — sent to the employer team on candidate response
    "offer_accepted", "offer_declined",
    # Admin broadcast announcements (S5)
    "announcement",
    # AI Interviewer predictive-validity flywheel — asks a candidate what
    # happened with the role they practiced for, ~2 weeks after the interview
    "interview_outcome_request",
)


class Notification(Base):
    """In-app notification for any user — employer-side or aspirant-side.
    Distinct from the email-only notify() helper in app.core.notifications —
    this is what populates the bell icon / inbox inside the product itself."""
    __tablename__ = "notifications"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type        = Column(String(30), nullable=False)
    title       = Column(String(255), nullable=False)
    body        = Column(Text, nullable=True)
    link_url    = Column(Text, nullable=True)   # frontend route to deep-link to, e.g. /app/employer/pipeline/<job_id>
    is_read             = Column(Boolean, nullable=False, default=False, index=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    # Email delivery tracking — populated by send_announcement_emails Celery task (S5)
    delivery_status     = Column(String(20), nullable=True, default="pending")  # pending|sent|failed
    email_sent_at       = Column(DateTime(timezone=True), nullable=True)
    email_failed_reason = Column(Text, nullable=True)

    user        = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint(f"type IN {NOTIFICATION_TYPES}", name="ck_notification_type"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )


# ── Admin broadcast announcements ─────────────────────────────────────────────

ANNOUNCEMENT_TYPES    = ("'info'", "'warning'", "'success'", "'alert'")
ANNOUNCEMENT_TARGETS  = ("'all'", "'aspirants'", "'employers'")
ANNOUNCEMENT_CHANNELS = ("'in_app'", "'email'", "'both'")

_ANNTYPE_SQL  = f"({', '.join(ANNOUNCEMENT_TYPES)})"
_ANNTGT_SQL   = f"({', '.join(ANNOUNCEMENT_TARGETS)})"
_ANNCH_SQL    = f"({', '.join(ANNOUNCEMENT_CHANNELS)})"


class AdminAnnouncement(Base):
    """Admin-broadcast message to a segment of users.

    Lifecycle: draft → scheduled (if scheduled_at set) → published.
    published_at is set when the message is dispatched; sent_count is updated
    to the number of matching users at publish time.
    """
    __tablename__ = "admin_announcements"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title        = Column(String(200), nullable=False)
    body         = Column(Text, nullable=False)
    type         = Column(String(20), nullable=False, default="info")     # info|warning|success|alert
    target       = Column(String(30), nullable=False, default="all")      # all|aspirants|employers
    channel      = Column(String(20), nullable=False, default="in_app")   # in_app|email|both
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    sent_count   = Column(Integer, nullable=False, default=0)
    created_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint(f"type IN {_ANNTYPE_SQL}", name="ck_announcement_type"),
        CheckConstraint(f"target IN {_ANNTGT_SQL}", name="ck_announcement_target"),
        CheckConstraint(f"channel IN {_ANNCH_SQL}", name="ck_announcement_channel"),
    )
