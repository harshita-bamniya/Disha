"""Resume-job match scoring: job_requirements.

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
Create Date: 2026-09-30
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("parser_version", sa.String(16), nullable=False),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_requirements_job_id", "job_requirements", ["job_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_job_requirements_job_id", table_name="job_requirements")
    op.drop_table("job_requirements")
