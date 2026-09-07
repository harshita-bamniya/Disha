"""Add is_fallback flag to mock_interview_feedback so AI-failure placeholder
scores are distinguishable from real AI-scored feedback.

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa

revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mock_interview_feedback",
        sa.Column("is_fallback", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("mock_interview_feedback", "is_fallback")
