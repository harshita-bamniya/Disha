"""SQLAlchemy ORM models for the AI counsellor / companion chat system (Module 08)."""
import uuid

from pgvector.sqlalchemy import Vector
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class Conversation(Base):
    __tablename__ = "conversations"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String(200), nullable=True)
    context_type  = Column(String(30), default="general", nullable=False)
    status        = Column(String(20), default="active", nullable=False)
    message_count = Column(Integer, default=0, nullable=False)
    # skill_learning context fields
    skill_focus      = Column(String(200), nullable=True)   # e.g. "Policy Research"
    job_context      = Column(JSONB, nullable=True)          # {job_id, job_title, company, sector}
    # Unused since the 'mock_interview' context_type was retired (the structured
    # interview module at InterviewSession/InterviewFeedback is the one canonical
    # interview data model now) — column kept nullable rather than dropped since
    # no code writes to it anymore.
    interview_config = Column(JSONB, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user          = relationship("User")
    messages      = relationship("Message", back_populates="conversation", order_by="Message.created_at", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "context_type IN ('career','emotional','learning','resume','general','skill_learning','job_roadmap','career_coaching')",
            name="ck_conv_context_type"
        ),
        CheckConstraint("status IN ('active','archived')", name="ck_conv_status"),
    )


class Message(Base):
    __tablename__ = "messages"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role            = Column(String(20), nullable=False)
    content         = Column(Text, nullable=False)
    content_hi      = Column(Text, nullable=True)
    token_count     = Column(Integer, nullable=True)
    model_used      = Column(String(100), nullable=True)
    safety_flagged  = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    conversation    = relationship("Conversation", back_populates="messages")
    safety_flags    = relationship("SafetyFlag", back_populates="message")

    __table_args__ = (
        CheckConstraint("role IN ('user','assistant','system')", name="ck_message_role"),
    )


class CounsellorMemory(Base):
    __tablename__ = "counsellor_memory"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    memory_type    = Column(String(30), nullable=False)
    content        = Column(Text, nullable=False)
    importance     = Column(String(20), default="medium", nullable=False)
    source_conv_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    is_active      = Column(Boolean, default=True, nullable=False)
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user           = relationship("User")
    embedding      = relationship("CounsellorMemoryEmbedding", back_populates="memory", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "memory_type IN ('fact','preference','concern','milestone','goal')",
            name="ck_memory_type"
        ),
        CheckConstraint("importance IN ('low','medium','high','critical')", name="ck_memory_importance"),
    )


class CounsellorMemoryEmbedding(Base):
    __tablename__ = "counsellor_memory_embeddings"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    memory_id  = Column(UUID(as_uuid=True), ForeignKey("counsellor_memory.id", ondelete="CASCADE"), nullable=False, unique=True)
    embedding  = Column(Vector(384), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    memory     = relationship("CounsellorMemory", back_populates="embedding")


class SafetyFlag(Base):
    __tablename__ = "safety_flags"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    message_id   = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    flag_type    = Column(String(30), nullable=False)
    severity     = Column(String(20), nullable=False)
    triggered_by = Column(String(200), nullable=True)
    action_taken = Column(String(50), default="logged", nullable=False)
    reviewed_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    message      = relationship("Message", back_populates="safety_flags")
    user         = relationship("User", foreign_keys=[user_id])
