"""Enterprise ATS Application Flow — Phase 1: all new entities and Application extensions.

Creates:
  ats_application_forms, ats_form_sections, ats_questions, ats_question_bank,
  ats_knockout_rules, ats_conditional_rules, ats_form_templates,
  candidate_resume_files, application_drafts,
  application_responses, application_documents.

Alters:
  applications — adds reference_number, resume_id, form_version_id,
                  knockout_triggered, knockout_action, application_score.
  application_status_history — adds is_automated.

Revision ID: n1o2p3q4r5s6
Revises: m1n2o3p4q5r6
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "n1o2p3q4r5s6"
down_revision = "m1n2o3p4q5r6"
branch_labels = None
depends_on = None


# ─── shared constant tuples (mirrors ats.py) ──────────────────────────────────

_FORM_STATUSES    = "('draft','published','archived')"
_QUESTION_TYPES   = (
    "('short_text','long_text','number','email','phone','date',"
    "'dropdown','multi_select','checkbox','radio','yes_no',"
    "'file_upload','url','linkedin_url','github_url','portfolio_url',"
    "'experience_years','salary_expectation','notice_period',"
    "'work_authorization','visa_sponsorship','relocation',"
    "'remote_preference','availability')"
)
_KNOCKOUT_ACTIONS = "('auto_reject','auto_tag','auto_advance','alert','label')"
_COND_OPS         = (
    "('equals','not_equals','contains','not_contains',"
    "'greater_than','less_than','is_answered','is_not_answered')"
)
_DOC_TYPES        = "('cover_letter','portfolio','certificate','transcript','work_sample','other')"
_RESUME_SOURCES   = "('uploaded','builder','optimizer')"
_OWNER_TYPES      = "('company','department','platform')"


def upgrade() -> None:
    # ── 1. candidate_resume_files (no FKs to new tables) ─────────────────────
    op.create_table(
        "candidate_resume_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False, unique=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="uploaded"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("format IN ('pdf','docx','doc','rtf')", name="ck_resume_file_format"),
        sa.CheckConstraint(f"source IN {_RESUME_SOURCES}", name="ck_resume_file_source"),
    )
    op.create_index("ix_candidate_resume_files_candidate_id", "candidate_resume_files", ["candidate_id"])
    op.create_index("ix_candidate_resume_files_candidate_active",
                    "candidate_resume_files", ["candidate_id", "is_deleted"])

    # ── 2. ats_question_bank (no FKs to new tables) ───────────────────────────
    op.create_table(
        "ats_question_bank",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_type", sa.String(20), nullable=False, server_default="platform"),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("hint_text", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("options_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("validation_json", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="{}"),
        sa.Column("is_platform_template", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_compliance_protected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"question_type IN {_QUESTION_TYPES}", name="ck_ats_bank_question_type"),
        sa.CheckConstraint(f"owner_type IN {_OWNER_TYPES}", name="ck_ats_bank_owner_type"),
    )

    # ── 3. ats_form_templates (no FKs to new tables) ─────────────────────────
    op.create_table(
        "ats_form_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_type", sa.String(20), nullable=False, server_default="company"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("form_snapshot_json", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="{}"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"owner_type IN {_OWNER_TYPES}", name="ck_form_template_owner_type"),
    )

    # ── 4. ats_application_forms (FKs to job_postings, users) ────────────────
    op.create_table(
        "ats_application_forms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("settings_json", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="{}"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"status IN {_FORM_STATUSES}", name="ck_ats_form_status"),
    )
    op.create_index("ix_ats_application_forms_job_id", "ats_application_forms", ["job_id"])
    op.create_index("ix_ats_application_forms_status", "ats_application_forms", ["status"])

    # ── 5. ats_form_sections ──────────────────────────────────────────────────
    op.create_table(
        "ats_form_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_application_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("section_type", sa.String(30), nullable=False, server_default="questions"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ats_form_sections_form_id", "ats_form_sections", ["form_id"])

    # ── 6. ats_questions (FKs to ats_form_sections, ats_question_bank) ───────
    op.create_table(
        "ats_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_form_sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_bank_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_question_bank.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("hint_text", sa.Text(), nullable=True),
        sa.Column("placeholder", sa.String(500), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_compliance_protected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("character_limit", sa.Integer(), nullable=True),
        sa.Column("validation_json", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="{}"),
        sa.Column("options_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"question_type IN {_QUESTION_TYPES}", name="ck_ats_question_type"),
    )
    op.create_index("ix_ats_questions_section_id", "ats_questions", ["section_id"])

    # ── 7. ats_knockout_rules (FKs to ats_application_forms, ats_questions) ──
    op.create_table(
        "ats_knockout_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_application_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_questions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("operator", sa.String(20), nullable=False),
        sa.Column("threshold_value", sa.Text(), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("tag_name", sa.String(100), nullable=True),
        sa.Column("advance_stage_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_pipeline_stages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email_template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"action IN {_KNOCKOUT_ACTIONS}", name="ck_knockout_action"),
    )
    op.create_index("ix_ats_knockout_rules_form_id", "ats_knockout_rules", ["form_id"])

    # ── 8. ats_conditional_rules ──────────────────────────────────────────────
    op.create_table(
        "ats_conditional_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_application_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("operator", sa.String(20), nullable=False),
        sa.Column("trigger_value", sa.Text(), nullable=True),
        sa.Column("target_entity_type", sa.String(10), nullable=False),
        sa.Column("target_entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(5), nullable=False, server_default="show"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"operator IN {_COND_OPS}", name="ck_cond_operator"),
        sa.CheckConstraint("target_entity_type IN ('question','section')", name="ck_cond_target_type"),
        sa.CheckConstraint("action IN ('show','hide')", name="ck_cond_action"),
    )
    op.create_index("ix_ats_conditional_rules_form_id", "ats_conditional_rules", ["form_id"])

    # ── 9. application_drafts ─────────────────────────────────────────────────
    op.create_table(
        "application_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("responses_json", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="{}"),
        sa.Column("selected_resume_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_resume_files.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_draft_job_candidate"),
    )
    op.create_index("ix_application_drafts_job_id", "application_drafts", ["job_id"])
    op.create_index("ix_application_drafts_candidate_id", "application_drafts", ["candidate_id"])

    # ── 10. Alter applications — add ATS columns ──────────────────────────────
    op.add_column("applications",
        sa.Column("reference_number", sa.String(30), nullable=True, unique=True))
    op.add_column("applications",
        sa.Column("resume_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_resume_files.id", ondelete="SET NULL"), nullable=True))
    op.add_column("applications",
        sa.Column("form_version_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_application_forms.id", ondelete="SET NULL"), nullable=True))
    op.add_column("applications",
        sa.Column("knockout_triggered", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("applications",
        sa.Column("knockout_action", sa.String(20), nullable=True))
    op.add_column("applications",
        sa.Column("application_score", sa.Integer(), nullable=True))
    op.create_index("ix_applications_reference_number", "applications", ["reference_number"])

    # ── 11. Alter application_status_history — add is_automated ──────────────
    op.add_column("application_status_history",
        sa.Column("is_automated", sa.Boolean(), nullable=False, server_default="false"))

    # ── 12. application_responses (FK to applications, ats_questions) ─────────
    op.create_table(
        "application_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("ats_questions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("question_label", sa.Text(), nullable=False),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("number_value", sa.Integer(), nullable=True),
        sa.Column("date_value", sa.DateTime(timezone=True), nullable=True),
        sa.Column("option_values_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("file_attachment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_resume_files.id", ondelete="SET NULL"), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_application_responses_app", "application_responses", ["application_id"])

    # ── 13. application_documents ─────────────────────────────────────────────
    op.create_table(
        "application_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(30), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(f"doc_type IN {_DOC_TYPES}", name="ck_app_doc_type"),
    )
    op.create_index("ix_application_documents_app_id", "application_documents", ["application_id"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("application_documents")
    op.drop_index("ix_application_responses_app", table_name="application_responses")
    op.drop_table("application_responses")

    op.drop_column("application_status_history", "is_automated")

    op.drop_index("ix_applications_reference_number", table_name="applications")
    op.drop_column("applications", "application_score")
    op.drop_column("applications", "knockout_action")
    op.drop_column("applications", "knockout_triggered")
    op.drop_column("applications", "form_version_id")
    op.drop_column("applications", "resume_id")
    op.drop_column("applications", "reference_number")

    op.drop_index("ix_application_drafts_candidate_id", table_name="application_drafts")
    op.drop_index("ix_application_drafts_job_id", table_name="application_drafts")
    op.drop_table("application_drafts")

    op.drop_index("ix_ats_conditional_rules_form_id", table_name="ats_conditional_rules")
    op.drop_table("ats_conditional_rules")

    op.drop_index("ix_ats_knockout_rules_form_id", table_name="ats_knockout_rules")
    op.drop_table("ats_knockout_rules")

    op.drop_index("ix_ats_questions_section_id", table_name="ats_questions")
    op.drop_table("ats_questions")

    op.drop_index("ix_ats_form_sections_form_id", table_name="ats_form_sections")
    op.drop_table("ats_form_sections")

    op.drop_index("ix_ats_application_forms_status", table_name="ats_application_forms")
    op.drop_index("ix_ats_application_forms_job_id", table_name="ats_application_forms")
    op.drop_table("ats_application_forms")

    op.drop_table("ats_form_templates")
    op.drop_table("ats_question_bank")

    op.drop_index("ix_candidate_resume_files_candidate_active", table_name="candidate_resume_files")
    op.drop_index("ix_candidate_resume_files_candidate_id", table_name="candidate_resume_files")
    op.drop_table("candidate_resume_files")
