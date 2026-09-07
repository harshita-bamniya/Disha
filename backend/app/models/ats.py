"""SQLAlchemy ORM models for the Enterprise ATS Application Flow.

Entities (all new — distinct from existing mvp2/mvp3 models):
  ApplicationForm, FormSection, AtsQuestion, AtsQuestionBank,
  KnockoutRule, ConditionalRule, FormTemplate,
  CandidateResumeFile, ApplicationDraft,
  ApplicationResponse, ApplicationDocument.

Existing models extended in this phase (via migration):
  Application  — adds reference_number, resume_id, knockout_triggered,
                  form_version_id, application_score.
  ApplicationStatusHistory — adds is_automated, reason alias already
                  covered by existing `note` column.

Naming notes:
  - CandidateResumeFile  vs  ResumeVersion (mvp2): mvp2 stores JSON snapshots
    of Resume Builder content; this table stores uploaded PDF/DOCX files.
  - AtsQuestionBank  vs  QuestionBank (mvp2): mvp2 holds interview-practice
    questions; this table is the employer's application-form question library.
  - AtsQuestion is the per-form question; AtsQuestionBank is the reusable
    shared library entry it may reference.
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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


# ─── constants ────────────────────────────────────────────────────────────────

FORM_STATUSES = ("draft", "published", "archived")

QUESTION_TYPES = (
    "short_text", "long_text", "number", "email", "phone", "date",
    "dropdown", "multi_select", "checkbox", "radio", "yes_no",
    "file_upload", "url", "linkedin_url", "github_url", "portfolio_url",
    "experience_years", "salary_expectation", "notice_period",
    "work_authorization", "visa_sponsorship", "relocation",
    "remote_preference", "availability",
)

KNOCKOUT_ACTIONS = ("auto_reject", "auto_tag", "auto_advance", "alert", "label")

CONDITIONAL_OPERATORS = (
    "equals", "not_equals", "contains", "not_contains",
    "greater_than", "less_than", "is_answered", "is_not_answered",
)

DOCUMENT_TYPES = (
    "cover_letter", "portfolio", "certificate",
    "transcript", "work_sample", "other",
)

RESUME_FILE_SOURCES = ("uploaded", "builder", "optimizer")


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATION FORM — per-job form configuration
# ═══════════════════════════════════════════════════════════════════════════════

class ApplicationForm(Base):
    """One configurable form per job posting.

    status:  draft → published → archived.
    A published form can still be edited; a new published_at is stamped.
    version increments on each publish.
    settings_json captures global toggles: resume_config, require_cover_letter,
    require_portfolio, require_work_authorization, etc.
    """
    __tablename__ = "ats_application_forms"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    job_id          = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"),
                             nullable=False, unique=True, index=True)
    status          = Column(String(20), nullable=False, default="draft", index=True)
    version         = Column(Integer, nullable=False, default=1)
    settings_json   = Column(JSONB, nullable=False, server_default="{}")
    created_by      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_published_at = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sections        = relationship("FormSection", back_populates="form",
                                   order_by="FormSection.order_index",
                                   cascade="all, delete-orphan")
    knockout_rules  = relationship("KnockoutRule", back_populates="form",
                                   cascade="all, delete-orphan")
    conditional_rules = relationship("ConditionalRule", back_populates="form",
                                     cascade="all, delete-orphan")
    creator         = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint(f"status IN {FORM_STATUSES}", name="ck_ats_form_status"),
    )


class FormSection(Base):
    """A named grouping of questions within an ApplicationForm.

    is_locked: True means job-level editors cannot delete this section
    (set by department/company admins).
    section_type distinguishes platform-managed sections (resume, compliance)
    from employer custom sections.
    """
    __tablename__ = "ats_form_sections"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    form_id         = Column(UUID(as_uuid=True), ForeignKey("ats_application_forms.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    title           = Column(String(200), nullable=False)
    description     = Column(Text, nullable=True)
    order_index     = Column(Integer, nullable=False, default=0)
    is_locked       = Column(Boolean, nullable=False, default=False)
    is_visible      = Column(Boolean, nullable=False, default=True)
    # resume | cover_letter | portfolio | documents | questions | compliance | custom
    section_type    = Column(String(30), nullable=False, default="questions")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    form            = relationship("ApplicationForm", back_populates="sections")
    questions       = relationship("AtsQuestion", back_populates="section",
                                   order_by="AtsQuestion.order_index",
                                   cascade="all, delete-orphan")


class AtsQuestion(Base):
    """A single question within a FormSection.

    question_bank_id is set when this question was sourced from AtsQuestionBank
    and records the bank entry at time of form creation (so edits to the bank
    don't silently change live forms).
    validation_json: type-specific rules (min_length, max_length, min_value,
    max_value, regex, file_types, max_file_size_mb, …).
    options_json: answer choices for dropdown / multi_select / radio.
    """
    __tablename__ = "ats_questions"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    section_id          = Column(UUID(as_uuid=True), ForeignKey("ats_form_sections.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    question_bank_id    = Column(UUID(as_uuid=True), ForeignKey("ats_question_bank.id", ondelete="SET NULL"),
                                 nullable=True)
    question_type       = Column(String(30), nullable=False)
    label               = Column(Text, nullable=False)
    hint_text           = Column(Text, nullable=True)
    placeholder         = Column(String(500), nullable=True)
    is_required         = Column(Boolean, nullable=False, default=False)
    is_compliance_protected = Column(Boolean, nullable=False, default=False)
    order_index         = Column(Integer, nullable=False, default=0)
    character_limit     = Column(Integer, nullable=True)
    validation_json     = Column(JSONB, nullable=False, server_default="{}")
    options_json        = Column(JSONB, nullable=True)   # [{value, label}]
    version             = Column(Integer, nullable=False, default=1)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    section             = relationship("FormSection", back_populates="questions")
    bank_entry          = relationship("AtsQuestionBank", foreign_keys=[question_bank_id])
    knockout_rule       = relationship("KnockoutRule", back_populates="question",
                                       uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(f"question_type IN {QUESTION_TYPES}", name="ck_ats_question_type"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# QUESTION BANK — reusable question library
# ═══════════════════════════════════════════════════════════════════════════════

class AtsQuestionBank(Base):
    """Shared library of reusable application-form questions.

    owner_id is NULL for platform-provided templates.
    owner_type: 'company' | 'department' | 'platform'.
    is_compliance_protected prevents these questions from being used
    as knockout triggers (work_authorization, EEO, etc.).
    """
    __tablename__ = "ats_question_bank"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    owner_id                = Column(UUID(as_uuid=True), nullable=True)   # company or dept UUID
    owner_type              = Column(String(20), nullable=False, default="platform")
    question_type           = Column(String(30), nullable=False)
    label                   = Column(Text, nullable=False)
    hint_text               = Column(Text, nullable=True)
    category                = Column(String(100), nullable=True)   # "Work Authorization", "Experience", …
    options_json            = Column(JSONB, nullable=True)
    validation_json         = Column(JSONB, nullable=False, server_default="{}")
    is_platform_template    = Column(Boolean, nullable=False, default=False)
    is_compliance_protected = Column(Boolean, nullable=False, default=False)
    version                 = Column(Integer, nullable=False, default=1)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(f"question_type IN {QUESTION_TYPES}", name="ck_ats_bank_question_type"),
        CheckConstraint("owner_type IN ('company','department','platform')", name="ck_ats_bank_owner_type"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# KNOCKOUT RULES
# ═══════════════════════════════════════════════════════════════════════════════

class KnockoutRule(Base):
    """Screening rule on a single AtsQuestion.

    Evaluated at submission time (not during form fill — prevents gaming).
    action priority: auto_reject > auto_tag > alert > label > auto_advance.
    advance_stage_id references job_pipeline_stages.id (SET NULL on delete).
    tag_name is stored for auto_tag and label actions.
    email_template_id is a future FK to a notification/email template table.
    """
    __tablename__ = "ats_knockout_rules"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    form_id             = Column(UUID(as_uuid=True), ForeignKey("ats_application_forms.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    question_id         = Column(UUID(as_uuid=True), ForeignKey("ats_questions.id", ondelete="CASCADE"),
                                 nullable=False, unique=True)
    operator            = Column(String(20), nullable=False)   # equals | not_equals | greater_than | less_than
    threshold_value     = Column(Text, nullable=False)         # the ideal or disqualifying answer value
    action              = Column(String(20), nullable=False)
    tag_name            = Column(String(100), nullable=True)
    advance_stage_id    = Column(UUID(as_uuid=True), ForeignKey("job_pipeline_stages.id", ondelete="SET NULL"),
                                 nullable=True)
    priority            = Column(Integer, nullable=False, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    form                = relationship("ApplicationForm", back_populates="knockout_rules")
    question            = relationship("AtsQuestion", back_populates="knockout_rule")

    __table_args__ = (
        CheckConstraint(f"action IN {KNOCKOUT_ACTIONS}", name="ck_knockout_action"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CONDITIONAL RULES — show/hide logic
# ═══════════════════════════════════════════════════════════════════════════════

class ConditionalRule(Base):
    """Show or hide a question/section based on a prior answer.

    target_entity_type: 'question' | 'section'.
    action: 'show' | 'hide'.
    Multiple rules targeting the same entity are combined with AND logic
    (all must be true to trigger the action).
    """
    __tablename__ = "ats_conditional_rules"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    form_id             = Column(UUID(as_uuid=True), ForeignKey("ats_application_forms.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    trigger_question_id = Column(UUID(as_uuid=True), ForeignKey("ats_questions.id", ondelete="CASCADE"),
                                 nullable=False)
    operator            = Column(String(20), nullable=False)
    trigger_value       = Column(Text, nullable=True)
    target_entity_type  = Column(String(10), nullable=False)   # question | section
    target_entity_id    = Column(UUID(as_uuid=True), nullable=False)
    action              = Column(String(5), nullable=False, default="show")   # show | hide
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    form                = relationship("ApplicationForm", back_populates="conditional_rules")
    trigger_question    = relationship("AtsQuestion", foreign_keys=[trigger_question_id])

    __table_args__ = (
        CheckConstraint(f"operator IN {CONDITIONAL_OPERATORS}", name="ck_cond_operator"),
        CheckConstraint("target_entity_type IN ('question','section')", name="ck_cond_target_type"),
        CheckConstraint("action IN ('show','hide')", name="ck_cond_action"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# FORM TEMPLATES — reusable form snapshots
# ═══════════════════════════════════════════════════════════════════════════════

class FormTemplate(Base):
    """Snapshot of a full form configuration, saved for reuse.

    owner_id/owner_type mirror AtsQuestionBank ownership.
    form_snapshot_json stores the full serialised form (sections + questions)
    so templates are self-contained and don't break when the source form changes.
    """
    __tablename__ = "ats_form_templates"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    owner_id            = Column(UUID(as_uuid=True), nullable=True)
    owner_type          = Column(String(20), nullable=False, default="company")
    name                = Column(String(200), nullable=False)
    description         = Column(Text, nullable=True)
    form_snapshot_json  = Column(JSONB, nullable=False, server_default="{}")
    used_count          = Column(Integer, nullable=False, default=0)
    created_by          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator             = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("owner_type IN ('company','department','platform')", name="ck_form_template_owner_type"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CANDIDATE RESUME FILE LIBRARY
# ═══════════════════════════════════════════════════════════════════════════════

class CandidateResumeFile(Base):
    """An uploaded resume file in a candidate's personal resume library.

    Distinct from mvp2.ResumeVersion, which stores JSON snapshots of
    Resume Builder content. This table holds uploaded binary files
    (PDF, DOCX, DOC, RTF) stored in S3.

    storage_key: S3 object key — pattern resumes/{candidate_id}/{uuid}.{ext}
    is_deleted: soft-delete (blocked if resume is attached to an active application).
    source: 'uploaded' (manual upload) | 'builder' (exported from Resume Builder)
            | 'optimizer' (AI-tailored version).
    """
    __tablename__ = "candidate_resume_files"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    candidate_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    filename        = Column(String(500), nullable=False)
    storage_key     = Column(Text, nullable=False, unique=True)
    file_size_bytes = Column(Integer, nullable=False)
    format          = Column(String(10), nullable=False)   # pdf | docx | doc | rtf
    label           = Column(String(200), nullable=True)   # user-given name, e.g. "Engineering v2"
    source          = Column(String(20), nullable=False, default="uploaded")
    last_used_at    = Column(DateTime(timezone=True), nullable=True)
    is_deleted      = Column(Boolean, nullable=False, default=False, index=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    candidate       = relationship("User", foreign_keys=[candidate_id])

    __table_args__ = (
        CheckConstraint("format IN ('pdf','docx','doc','rtf')", name="ck_resume_file_format"),
        CheckConstraint(f"source IN {RESUME_FILE_SOURCES}", name="ck_resume_file_source"),
        Index("ix_candidate_resume_files_candidate_active", "candidate_id", "is_deleted"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATION DRAFT — in-progress unsaved application
# ═══════════════════════════════════════════════════════════════════════════════

class ApplicationDraft(Base):
    """In-progress application, written by auto-save every 300 ms.

    Expires 30 days after creation. One active draft per (job, candidate).
    current_step tracks which wizard step the candidate was on when they left.
    responses_json is the full answer payload keyed by question_id.
    selected_resume_id references candidate_resume_files.id.
    """
    __tablename__ = "application_drafts"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    job_id              = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    candidate_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    current_step        = Column(Integer, nullable=False, default=1)
    responses_json      = Column(JSONB, nullable=False, server_default="{}")
    selected_resume_id  = Column(UUID(as_uuid=True), ForeignKey("candidate_resume_files.id", ondelete="SET NULL"),
                                 nullable=True)
    last_saved_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    expires_at          = Column(DateTime(timezone=True), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    candidate           = relationship("User", foreign_keys=[candidate_id])
    selected_resume     = relationship("CandidateResumeFile", foreign_keys=[selected_resume_id])

    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_draft_job_candidate"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATION RESPONSE — one record per question answered on a submitted app
# ═══════════════════════════════════════════════════════════════════════════════

class ApplicationResponse(Base):
    """Stores each answer to a form question for a submitted Application.

    question_version is snapshotted at submission time so historical accuracy
    is preserved even if the question label/options are later edited.
    Only one of the value columns is populated depending on question_type.
    file_attachment_id references candidate_resume_files for file-upload questions.
    """
    __tablename__ = "application_responses"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id      = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    question_id         = Column(UUID(as_uuid=True), ForeignKey("ats_questions.id", ondelete="SET NULL"),
                                 nullable=True)
    question_version    = Column(Integer, nullable=False, default=1)
    question_label      = Column(Text, nullable=False)   # snapshotted label
    question_type       = Column(String(30), nullable=False)
    text_value          = Column(Text, nullable=True)
    number_value        = Column(Integer, nullable=True)
    date_value          = Column(DateTime(timezone=True), nullable=True)
    option_values_json  = Column(JSONB, nullable=True)   # for dropdown / multi_select
    file_attachment_id  = Column(UUID(as_uuid=True), ForeignKey("candidate_resume_files.id", ondelete="SET NULL"),
                                 nullable=True)
    answered_at         = Column(DateTime(timezone=True), server_default=func.now())

    question            = relationship("AtsQuestion", foreign_keys=[question_id])
    file_attachment     = relationship("CandidateResumeFile", foreign_keys=[file_attachment_id])

    __table_args__ = (
        Index("ix_application_responses_app", "application_id"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATION DOCUMENT — non-resume documents attached to a submitted application
# ═══════════════════════════════════════════════════════════════════════════════

class ApplicationDocument(Base):
    """A non-resume document submitted as part of an Application.

    cover_letter, portfolio, certificate, transcript, work_sample, other.
    Files are stored in S3; storage_key follows the pattern:
      app-docs/{application_id}/{doc_type}/{uuid}.{ext}
    """
    __tablename__ = "application_documents"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    application_id  = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    doc_type        = Column(String(30), nullable=False)
    filename        = Column(String(500), nullable=False)
    storage_key     = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    format          = Column(String(10), nullable=False)
    uploaded_at     = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(f"doc_type IN {DOCUMENT_TYPES}", name="ck_app_doc_type"),
    )
