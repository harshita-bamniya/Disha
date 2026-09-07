"""Add job_templates table — reusable job-posting boilerplate.

Distinct from a draft JobPosting (a specific dated requisition): a template
has no expires_at/salary, just the reusable parts (title, description,
sector, skills, type) an employer reuses across multiple reqs.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("sector", sa.String(100), nullable=False),
        sa.Column("required_skills", postgresql.JSONB(), nullable=False),
        sa.Column("job_type", sa.String(20), nullable=True),
        sa.Column("employment_type", sa.String(30), nullable=True),
        sa.Column("min_k_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_templates_employer_id", "job_templates", ["employer_id"])


def downgrade() -> None:
    op.drop_index("ix_job_templates_employer_id", table_name="job_templates")
    op.drop_table("job_templates")
