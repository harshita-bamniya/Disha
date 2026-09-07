"""Add job_hiring_team, job_pipeline_stages, company_pipeline_templates tables;
add company_id to job_postings; add pipeline_stage_id to applications.

These five changes were modelled but never migrated:
- job_hiring_team: per-job role assignments (hiring_manager, interviewer, etc.)
- job_pipeline_stages: per-job customisable pipeline stage config
- company_pipeline_templates: reusable stage-set templates per company
- job_postings.company_id: direct FK for company-level queries (avoids 2-hop join)
- applications.pipeline_stage_id: links an application to its custom stage

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None

CUSTOMISABLE_STAGE_KEYS = (
    "applied", "under_review", "screening", "shortlisted",
    "interview_scheduled", "interview_completed", "offer_sent", "hired",
    "rejected", "withdrawn", "on_hold",
)


def upgrade() -> None:
    # ── 1. company_pipeline_templates ────────────────────────────────────────
    op.create_table(
        "company_pipeline_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("stages", JSONB, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── 2. job_pipeline_stages ────────────────────────────────────────────────
    op.create_table(
        "job_pipeline_stages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("stage_key", sa.String(30), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6B7280"),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_visible", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("job_id", "stage_key", name="uq_job_pipeline_stage_key"),
        sa.CheckConstraint(
            f"stage_key IN {CUSTOMISABLE_STAGE_KEYS}",
            name="ck_pipeline_stage_key",
        ),
    )

    # ── 3. job_hiring_team ────────────────────────────────────────────────────
    op.create_table(
        "job_hiring_team",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("employer_profile_id", UUID(as_uuid=True), sa.ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("job_role", sa.String(30), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("job_id", "employer_profile_id", name="uq_job_hiring_team_member"),
    )

    # ── 4. job_postings.company_id ────────────────────────────────────────────
    op.add_column(
        "job_postings",
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    # Backfill: set company_id from the posting employer's company
    op.execute("""
        UPDATE job_postings jp
        SET company_id = ep.company_id
        FROM employer_profiles ep
        WHERE jp.employer_id = ep.id
          AND ep.company_id IS NOT NULL
          AND jp.company_id IS NULL
    """)

    # ── 5. applications.pipeline_stage_id ────────────────────────────────────
    op.add_column(
        "applications",
        sa.Column(
            "pipeline_stage_id",
            UUID(as_uuid=True),
            sa.ForeignKey("job_pipeline_stages.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("applications", "pipeline_stage_id")
    op.drop_column("job_postings", "company_id")
    op.drop_table("job_hiring_team")
    op.drop_table("job_pipeline_stages")
    op.drop_table("company_pipeline_templates")
