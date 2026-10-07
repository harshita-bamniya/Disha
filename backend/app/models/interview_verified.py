"""Verified Interview: the employer-facing side of the AI interview.

An employer defines an interview (template), invites a candidate who applied
to one of their jobs, and sees an evidence-linked scorecard only while the
candidate's consent (a share grant) is live. The candidate takes exactly one
attempt, sees the same scorecard, and can appeal it.
"""
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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class InterviewTemplate(Base):
    """An employer's interview blueprint: role, competencies (with weights) and
    up to three of their own questions."""
    __tablename__ = "interview_templates"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employer_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id       = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    job_id           = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True)
    title            = Column(String(150), nullable=False)
    role             = Column(String(150), nullable=False)
    language         = Column(String(10), nullable=False, default="en")
    duration_minutes = Column(Integer, nullable=False, default=15)
    # [{"skill": str, "weight": number, "must_have": bool}]
    competencies     = Column(JSONB, nullable=False)
    # Up to 3 employer-written questions, already passed through the compliance filter
    custom_questions = Column(JSONB, nullable=False, default=list)
    status           = Column(String(12), nullable=False, default="active")
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('active','archived')", name="ck_interview_template_status"),
        CheckConstraint("duration_minutes BETWEEN 10 AND 20", name="ck_interview_template_duration"),
    )


class InterviewInvitation(Base):
    """One candidate invited to one template. Single use: one attempt."""
    __tablename__ = "interview_invitations"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    template_id       = Column(UUID(as_uuid=True), ForeignKey("interview_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_user_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id    = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    status            = Column(String(12), nullable=False, default="invited", index=True)
    expires_at        = Column(DateTime(timezone=True), nullable=False)
    session_id        = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True)
    # A documented technical failure can earn one more attempt (admin-granted).
    retry_granted     = Column(Boolean, nullable=False, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    started_at        = Column(DateTime(timezone=True), nullable=True)
    completed_at      = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("template_id", "candidate_user_id", name="uq_interview_invitation_candidate"),
        CheckConstraint("status IN ('invited','started','completed','declined','expired')", name="ck_interview_invitation_status"),
    )


class ShareGrant(Base):
    """The candidate's consent for one employer to see one verified interview,
    for a limited time. The ONLY thing that lets an employer read a result."""
    __tablename__ = "share_grants"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id       = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    invitation_id    = Column(UUID(as_uuid=True), ForeignKey("interview_invitations.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_at       = Column(DateTime(timezone=True), server_default=func.now())
    expires_at       = Column(DateTime(timezone=True), nullable=False)
    revoked_at       = Column(DateTime(timezone=True), nullable=True)
    view_count       = Column(Integer, nullable=False, default=0)
    last_viewed_at   = Column(DateTime(timezone=True), nullable=True)


class InterviewAppeal(Base):
    """A candidate asking for a human to review their verified score."""
    __tablename__ = "interview_appeals"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id      = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason          = Column(Text, nullable=False)
    status          = Column(String(12), nullable=False, default="open", index=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at     = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('open','resolved')", name="ck_interview_appeal_status"),
    )


class EmployerDecision(Base):
    """A human employer's decision on a verified interview. The AI never decides."""
    __tablename__ = "employer_decisions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id       = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    decision         = Column(String(12), nullable=False)
    reason_code      = Column(String(30), nullable=False)
    note             = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "employer_user_id", name="uq_employer_decision"),
        CheckConstraint("decision IN ('shortlist','hold','decline')", name="ck_employer_decision"),
    )


class IntegrityEvent(Base):
    """A soft integrity observation during a verified interview (e.g. the tab
    lost focus). Timestamps only, never frames. Shown to both the employer and
    the candidate as an observation; it never lowers a score or rejects anyone."""
    __tablename__ = "integrity_events"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    kind       = Column(String(30), nullable=False)
    started_ms = Column(Integer, nullable=False)
    ended_ms   = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("kind IN ('tab_hidden','window_blur','face_missing','multiple_faces')", name="ck_integrity_event_kind"),
    )
