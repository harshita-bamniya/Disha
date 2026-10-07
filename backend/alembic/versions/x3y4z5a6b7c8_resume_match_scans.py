"""Resume-job match scoring: resume_match_scans.

Revision ID: x3y4z5a6b7c8
Revises: w2x3y4z5a6b7
Create Date: 2026-09-30
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "x3y4z5a6b7c8"
down_revision = "w2x3y4z5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_match_scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_source", sa.String(10), nullable=False),
        sa.Column("resume_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resume_label", sa.String(300), nullable=True),
        sa.Column("resume_hash", sa.String(64), nullable=False),
        sa.Column("job_source_hash", sa.String(64), nullable=False),
        sa.Column("scoring_version", sa.String(16), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("band", sa.String(10), nullable=False),
        sa.Column("must_haves_met", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("must_haves_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profile", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("report", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("previous_scan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("score_delta", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_resume_match_scans_user_id", "resume_match_scans", ["user_id"])
    op.create_index("ix_resume_match_scans_created_at", "resume_match_scans", ["created_at"])
    op.create_index("ix_resume_match_scans_user_job_created", "resume_match_scans", ["user_id", "job_id", "created_at"])
    op.create_index("ix_resume_match_scans_user_hash", "resume_match_scans", ["user_id", "resume_hash"])


def downgrade() -> None:
    op.drop_table("resume_match_scans")
