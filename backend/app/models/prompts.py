"""SQLAlchemy ORM models for versioned, DB-stored AI prompt templates."""
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
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class PromptTemplate(Base):
    """Versioned AI prompt templates. Active version loaded at runtime.

    Design: each use_case has exactly one row where is_active=True.
    Updating a prompt means inserting a new row + deactivating the old one —
    never updating content in-place (preserves audit trail).
    """
    __tablename__ = "prompt_templates"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name         = Column(String(100), nullable=False)          # e.g. "counsellor_system_v4"
    use_case     = Column(String(100), nullable=False, index=True)  # e.g. "counsellor_system"
    prompt_type  = Column(String(20), nullable=False, default="system")  # system | user | assistant
    content      = Column(Text, nullable=False)
    version      = Column(Integer, nullable=False, default=1)
    is_active    = Column(Boolean, nullable=False, default=True, index=True)
    model_hint   = Column(String(100), nullable=True)           # preferred model for this prompt
    notes        = Column(Text, nullable=True)                  # change reason / changelog
    created_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("prompt_type IN ('system','user','assistant')", name="ck_prompt_type"),
        # Enforce at most one active version per use_case in the application layer
        # (DB partial unique index on is_active=True is Postgres-specific — handled in migration)
        Index("ix_prompt_templates_use_case_active", "use_case", "is_active"),
    )
