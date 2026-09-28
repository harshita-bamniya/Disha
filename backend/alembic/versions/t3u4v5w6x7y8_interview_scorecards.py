"""Structured interview scorecards + submission nudges.

Replaces the single recommendation+free-text feedback with an optional
multi-criteria rubric (communication, structured thinking, business sense,
ownership, culture fit — each rated 1-5), alongside the existing
recommendation/feedback fields rather than instead of them.

Adds nudge_2h_sent_at / nudge_24h_sent_at dedupe stamps so a Celery beat
sweep can remind the assigned interviewer to submit their scorecard without
double-sending.

Revision ID: t3u4v5w6x7y8
Revises: s7t8u9v0w1x2
Create Date: 2026-09-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "t3u4v5w6x7y8"
down_revision = "s7t8u9v0w1x2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidate_interview_feedback",
        sa.Column("scorecard_ratings", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("candidate_interview_feedback",
        sa.Column("nudge_2h_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_interview_feedback",
        sa.Column("nudge_24h_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("candidate_interview_feedback", "nudge_24h_sent_at")
    op.drop_column("candidate_interview_feedback", "nudge_2h_sent_at")
    op.drop_column("candidate_interview_feedback", "scorecard_ratings")
