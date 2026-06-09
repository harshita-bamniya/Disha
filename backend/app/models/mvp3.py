"""SQLAlchemy ORM models for Phase 3 (Scale):
- Module 09: Full Employer Matching (Applications + Status History)
- Prompt Templates (versioned, DB-stored, no-code updates)
- Platform Settings + Feature Flags
- UserEvent ORM (replaces raw SQL in analytics)
- OAuth Providers (reserved, schema only)
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint, CheckConstraint, Date,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 09 — EMPLOYER MATCHING (Applications)
# ═══════════════════════════════════════════════════════════════════════════════

class Application(Base):
    """An aspirant applies to a specific job posting."""
    __tablename__ = "applications"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    aspirant_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id          = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True)

    # Computed at application time from the aspirant's current KRS
    match_score     = Column(Integer, nullable=True)   # 0-100, computed at submission time

    # Optional cover letter / context from aspirant
    cover_note      = Column(Text, nullable=True)

    # Current status — single source of truth (denormalized for fast reads)
    status          = Column(String(30), nullable=False, default="applied", index=True)

    # Employer shortlist / rejection note (visible to aspirant)
    employer_note   = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    aspirant        = relationship("User", foreign_keys=[aspirant_id])
    job             = relationship("JobPosting", back_populates="applications")
    status_history  = relationship("ApplicationStatusHistory", back_populates="application",
                                   order_by="ApplicationStatusHistory.created_at", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("aspirant_id", "job_id", name="uq_application_aspirant_job"),
        CheckConstraint(
            "status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
            name="ck_application_status"
        ),
    )


class ApplicationStatusHistory(Base):
    """Full audit trail of every status transition on an application."""
    __tablename__ = "application_status_history"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status     = Column(String(30), nullable=True)   # null for initial 'applied' event
    to_status       = Column(String(30), nullable=False)
    changed_by      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note            = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    application     = relationship("Application", back_populates="status_history")
    actor           = relationship("User", foreign_keys=[changed_by])

    __table_args__ = (
        CheckConstraint(
            "to_status IN ('applied','under_review','shortlisted','rejected','hired','withdrawn')",
            name="ck_hist_to_status"
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT TEMPLATES — Versioned, DB-stored, no-code prompt updates
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# PLATFORM SETTINGS — Key-value config store for runtime settings
# ═══════════════════════════════════════════════════════════════════════════════

class PlatformSetting(Base):
    """Runtime-editable platform configuration.

    Stores settings that admins can change without a deployment:
    e.g. maintenance_mode, max_applications_per_user, onboarding_total_steps.
    """
    __tablename__ = "platform_settings"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    key         = Column(String(100), unique=True, nullable=False, index=True)
    value       = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    updated_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE FLAGS — Granular rollout control
# ═══════════════════════════════════════════════════════════════════════════════

class FeatureFlag(Base):
    """Feature flags for controlled rollout of Phase 3 features.

    rollout_pct: 0-100, percentage of users who see the feature.
    target_roles: JSON array of role names; null = all roles.
    """
    __tablename__ = "feature_flags"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    flag_name    = Column(String(100), unique=True, nullable=False, index=True)
    is_enabled   = Column(Boolean, nullable=False, default=False)
    rollout_pct  = Column(Integer, nullable=False, default=0)   # 0-100
    target_roles = Column(JSONB, nullable=True)                 # ["aspirant"] or null
    description  = Column(Text, nullable=True)
    updated_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("rollout_pct BETWEEN 0 AND 100", name="ck_flag_rollout_pct"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# USER EVENTS — ORM model replacing raw SQL in analytics router
# ═══════════════════════════════════════════════════════════════════════════════

class UserEvent(Base):
    """Behavioral event stream. High-volume — partition by month in production.

    This model replaces the raw SQL string in analytics/router.py.
    """
    __tablename__ = "user_events"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id  = Column(String(64), nullable=True)
    event_name  = Column(String(100), nullable=False, index=True)
    event_data  = Column(JSONB, nullable=True, server_default="{}")
    page_url    = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_user_events_created_at", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# OAUTH PROVIDERS — Reserved for Phase 3 Google/LinkedIn login
# ═══════════════════════════════════════════════════════════════════════════════

class OAuthProvider(Base):
    """OAuth identity links (Google, LinkedIn). Schema reserved — not active in Phase 3 MVP."""
    __tablename__ = "oauth_providers"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider     = Column(String(30), nullable=False)      # "google" | "linkedin"
    provider_uid = Column(String(255), nullable=False)
    access_token_hint = Column(String(20), nullable=True)  # last 4 chars only — for display
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user         = relationship("User")

    __table_args__ = (
        UniqueConstraint("provider", "provider_uid", name="uq_oauth_provider_uid"),
        CheckConstraint("provider IN ('google','linkedin')", name="ck_oauth_provider"),
    )
