"""SQLAlchemy ORM models for employer matching / ATS pipeline (Module 09)."""
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
from sqlalchemy.dialects.postgresql import UUID
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

    # ── ATS Phase 1 additions ────────────────────────────────────────────────
    # Human-readable reference number: DISHA-{YYYY}-{6 random uppercase chars}
    reference_number    = Column(String(30), nullable=True, unique=True, index=True)
    # The resume file selected for this application (candidate_resume_files.id)
    resume_id           = Column(UUID(as_uuid=True), ForeignKey("candidate_resume_files.id", ondelete="SET NULL"), nullable=True)
    # ID of the published ApplicationForm version used at submission time
    form_version_id     = Column(UUID(as_uuid=True), ForeignKey("ats_application_forms.id", ondelete="SET NULL"), nullable=True)
    # True when at least one knockout rule was triggered at submission
    knockout_triggered  = Column(Boolean, nullable=False, default=False)
    # Knockout action taken (mirrors KnockoutRule.action) — null if no knockout
    knockout_action     = Column(String(20), nullable=True)
    # AI-computed application quality score (0–100), set post-submission
    application_score   = Column(Integer, nullable=True)
    # ────────────────────────────────────────────────────────────────────────

    # Current status — single source of truth (denormalized for fast reads)
    status          = Column(String(30), nullable=False, default="applied", index=True)

    # Custom pipeline stage for this application — FK to the per-job stage config.
    # NULL means the application is in the default stage for its status.
    pipeline_stage_id = Column(UUID(as_uuid=True), ForeignKey("job_pipeline_stages.id", ondelete="SET NULL"), nullable=True, index=True)

    # Employer shortlist / rejection note (visible to aspirant)
    employer_note   = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    aspirant        = relationship("User", foreign_keys=[aspirant_id])
    job             = relationship("JobPosting", back_populates="applications")
    status_history  = relationship("ApplicationStatusHistory", back_populates="application",
                                   order_by="ApplicationStatusHistory.created_at", cascade="all, delete-orphan")

    @property
    def job_title(self) -> str:
        return self.job.title if self.job else ""

    @property
    def company_name(self) -> str:
        if self.job and self.job.employer:
            return self.job.employer.company_name or ""
        return ""

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
    changed_by      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    note            = Column(Text, nullable=True)
    is_automated    = Column(Boolean, nullable=False, default=False)   # True for knockout/system actions
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
    author_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
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

    Distinct from InterviewFeedback (models/interview.py), which scores the AI
    mock-interview practice feature — this table is recruiter-scheduled interviews
    with real candidates.
    Lifecycle: scheduled -> completed (feedback added) | canceled.
    """
    __tablename__ = "candidate_interview_feedback"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewer_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
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
