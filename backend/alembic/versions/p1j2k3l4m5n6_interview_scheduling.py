"""Interview scheduling: add status + meeting_link to candidate_interview_feedback,
turning it into a full scheduled -> completed/canceled interview lifecycle.

Revision ID: p1j2k3l4m5n6
Revises: o9i1j2k3l4m5
Create Date: 2026-06-27

Part of Module 05 — Employer Dashboard Audit, Phase 9 (Interview Module).
Existing rows (feedback-only, no real scheduling flow existed before this)
are backfilled to 'completed' since they already have feedback text.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'p1j2k3l4m5n6'
down_revision: Union[str, None] = 'o9i1j2k3l4m5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidate_interview_feedback", sa.Column("meeting_link", sa.Text(), nullable=True))
    op.add_column("candidate_interview_feedback", sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"))
    op.create_check_constraint(
        "ck_interview_feedback_status", "candidate_interview_feedback",
        "status IN ('scheduled','completed','canceled')",
    )
    op.execute("UPDATE candidate_interview_feedback SET status = 'completed' WHERE feedback IS NOT NULL")


def downgrade() -> None:
    op.drop_constraint("ck_interview_feedback_status", "candidate_interview_feedback", type_="check")
    op.drop_column("candidate_interview_feedback", "status")
    op.drop_column("candidate_interview_feedback", "meeting_link")
