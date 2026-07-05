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


# Full ATS pipeline (Module 05 Phase 3) — superset of the original 6 statuses.
# 'under_review' kept as a legacy alias for screening (existing rows may use it).
APPLICATION_STATUSES = (
    "applied", "under_review", "screening", "shortlisted", "interview_scheduled",
    "interview_completed", "offer_sent", "hired", "rejected", "withdrawn",
)


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
        CheckConstraint(f"status IN {APPLICATION_STATUSES}", name="ck_application_status"),
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
        CheckConstraint(f"to_status IN {APPLICATION_STATUSES}", name="ck_hist_to_status"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ATS PIPELINE EXTRAS — Notes, ratings, interview feedback (Module 05 Phase 3)
# ═══════════════════════════════════════════════════════════════════════════════

class CandidateNote(Base):
    """Recruiter notes thread on an application — multiple, timestamped, attributable."""
    __tablename__ = "candidate_notes"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note            = Column(Text, nullable=False)
    is_internal     = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    application     = relationship("Application")
    author          = relationship("User", foreign_keys=[author_id])


class CandidateRating(Base):
    """1-5 star rating per (application, rater) — recruiters rate independently."""
    __tablename__ = "candidate_ratings"

    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True)
    rater_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rating          = Column(Integer, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    application     = relationship("Application")
    rater           = relationship("User", foreign_keys=[rater_id])

    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_candidate_rating_range"),
    )


class CandidateInterviewFeedback(Base):
    """An interview round on an application — scheduling + feedback in one lifecycle.

    Distinct from InterviewFeedback (mvp2.py), which scores the AI mock-interview
    practice feature — this table is recruiter-scheduled interviews with real candidates.
    Lifecycle: scheduled -> completed (feedback added) | canceled.
    """
    __tablename__ = "candidate_interview_feedback"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewer_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_at    = Column(DateTime(timezone=True), nullable=True)
    meeting_link    = Column(Text, nullable=True)
    status          = Column(String(20), nullable=False, default="scheduled")  # scheduled|completed|canceled
    recommendation  = Column(String(20), nullable=True)   # strong_yes|yes|no|strong_no
    feedback        = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Self-serve reschedule request from the candidate — previously a
    # recruiter-picked time was final with no way for the candidate to flag
    # a conflict short of emailing outside the product.
    reschedule_requested_at = Column(DateTime(timezone=True), nullable=True)
    reschedule_note         = Column(Text, nullable=True)

    application     = relationship("Application")
    interviewer     = relationship("User", foreign_keys=[interviewer_id])

    __table_args__ = (
        CheckConstraint(
            "recommendation IS NULL OR recommendation IN ('strong_yes','yes','no','strong_no')",
            name="ck_interview_feedback_recommendation",
        ),
        CheckConstraint(
            "status IN ('scheduled','completed','canceled')",
            name="ck_interview_feedback_status",
        ),
    )


class SavedCandidate(Base):
    """Talent pool — a recruiter bookmarks a candidate (by aspirant, not by a
    specific application) so they aren't lost once the req they applied to closes.

    Scoped to the saving recruiter's EmployerProfile; listing/removal queries
    expand to the whole company's EmployerProfile ids (same pattern used for
    applications/jobs) so any teammate sees and can manage the shared pool.
    """
    __tablename__ = "saved_candidates"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employer_id     = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    aspirant_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    saved_by        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note            = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    aspirant        = relationship("User", foreign_keys=[aspirant_id])
    saver           = relationship("User", foreign_keys=[saved_by])

    __table_args__ = (
        UniqueConstraint("employer_id", "aspirant_id", name="uq_saved_candidate_employer_aspirant"),
    )


class CandidateEmailLog(Base):
    """Audit trail of every email a recruiter sends a candidate from the pipeline.

    Recruiter outreach previously had no in-product channel at all — emails sent
    here are also persisted (not just fired-and-forgotten) so there's a record of
    what contact happened, for compliance and for other teammates on the req.
    """
    __tablename__ = "candidate_email_logs"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    recipient_email = Column(String(255), nullable=False)
    subject         = Column(String(255), nullable=False)
    body            = Column(Text, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    application     = relationship("Application")
    sender          = relationship("User", foreign_keys=[sender_id])


OFFER_LETTER_STATUSES = ("sent", "accepted", "declined")


class OfferLetter(Base):
    """A persisted offer letter tied 1:1 to an application, with a lightweight
    self-serve e-signature flow (typed legal name + IP/timestamp audit trail).

    Previously "offer management" was just the application.status='offer_sent'
    flag — there was no actual document and no way for a candidate to respond
    in-product. This is a "click to accept" style e-signature, not a legally
    binding DocuSign-grade signature — a real e-sign provider integration needs
    a separate vendor contract (see docs/ENTERPRISE_AUDIT_ROADMAP.md, item M2).
    """
    __tablename__ = "offer_letters"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id              = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    created_by                  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    role_title                  = Column(String(200), nullable=False)
    company_address             = Column(String(300), nullable=True)
    hiring_manager_name         = Column(String(150), nullable=False)
    hiring_manager_designation  = Column(String(150), nullable=False)
    salary_ctc                  = Column(String(100), nullable=False)
    start_date                  = Column(String(50), nullable=False)
    work_location                = Column(String(200), nullable=False)
    employment_type             = Column(String(50), nullable=False, default="Full-Time")
    extra_clauses                = Column(Text, nullable=True)

    status                      = Column(String(20), nullable=False, default="sent")  # sent | accepted | declined
    sent_at                      = Column(DateTime(timezone=True), server_default=func.now())
    responded_at                 = Column(DateTime(timezone=True), nullable=True)

    # E-signature audit trail — captured at the moment of acceptance
    signature_name               = Column(String(150), nullable=True)
    signature_ip                 = Column(String(64), nullable=True)
    signature_user_agent         = Column(Text, nullable=True)

    decline_reason               = Column(Text, nullable=True)

    created_at                  = Column(DateTime(timezone=True), server_default=func.now())

    application                 = relationship("Application")
    creator                      = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint(f"status IN {OFFER_LETTER_STATUSES}", name="ck_offer_letter_status"),
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
# IN-APP NOTIFICATION INBOX + RECRUITER TASKS — there was previously no
# in-product notification surface at all (only outbound email); recruiters
# had to live in their inbox instead of the app. This closes that gap.
# ═══════════════════════════════════════════════════════════════════════════════

NOTIFICATION_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    # Aspirant-side — added when the inbox was extended beyond employers
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
    # Offer letter e-signature — sent to the employer team on candidate response
    "offer_accepted", "offer_declined",
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
    is_read     = Column(Boolean, nullable=False, default=False, index=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user        = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint(f"type IN {NOTIFICATION_TYPES}", name="ck_notification_type"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )


class JobTemplate(Base):
    """Reusable job-posting boilerplate — distinct from a draft JobPosting,
    which is a specific dated requisition. A template has no expires_at or
    salary; an employer picks one to pre-fill a new posting, then fills in
    the req-specific details (dates, comp) before publishing."""
    __tablename__ = "job_templates"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employer_id     = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name            = Column(String(150), nullable=False)   # employer's own label, e.g. "Standard Analyst Req"
    title           = Column(String(200), nullable=False)
    description     = Column(Text, nullable=False)
    sector          = Column(String(100), nullable=False)
    required_skills = Column(JSONB, nullable=False)
    job_type        = Column(String(20), nullable=True)
    employment_type = Column(String(30), nullable=True)
    min_k_score     = Column(Integer, nullable=False, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    employer        = relationship("EmployerProfile")


class EmployerTask(Base):
    """A recruiter's personal to-do, optionally linked to a candidate's
    application (e.g. "follow up with Priya next week"). Simple, manual —
    not auto-generated; this is the to-do list recruiters didn't have inside
    the product before, so they tracked follow-ups in their own notes app."""
    __tablename__ = "employer_tasks"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    assigned_to     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    title           = Column(String(255), nullable=False)
    due_at          = Column(DateTime(timezone=True), nullable=True)
    is_done         = Column(Boolean, nullable=False, default=False, index=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    assignee        = relationship("User", foreign_keys=[assigned_to])
    creator         = relationship("User", foreign_keys=[created_by])
    application     = relationship("Application")


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


class GoogleCalendarToken(Base):
    """Stores Google Calendar OAuth2 tokens per employer user.
    One row per user — upserted on each auth callback.
    Tokens are encrypted at rest in production via DB-level encryption;
    for local dev they are stored as plain JSON.
    """
    __tablename__ = "google_calendar_tokens"

    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token         = Column(Text, nullable=False)          # JSON: access_token, refresh_token, expiry
    calendar_id   = Column(String(255), nullable=True, default="primary")
    connected_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user          = relationship("User")
