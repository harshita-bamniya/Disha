"""Phase 7 moonshots for the AI Interviewer: multi-judge scoring columns on
mock_interview_feedback, panelist assignment on question_banks, and two new
tables — interview_outcomes (predictive-validity flywheel) and
interview_human_reviews (human-calibration dashboard).

Revision ID: s6t7u8v9w0x1
Revises: r5s6t7u8v9w0
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s6t7u8v9w0x1"
down_revision = "r5s6t7u8v9w0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Multi-judge adversarial scoring ─────────────────────────────────────
    op.add_column(
        "mock_interview_feedback",
        sa.Column("judge_scores", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "mock_interview_feedback",
        sa.Column("judge_disagreement_note", sa.Text(), nullable=True),
    )

    # ── Panel simulation — which interviewer persona asked this question ───
    op.add_column(
        "question_banks",
        sa.Column("panelist_name", sa.String(60), nullable=True),
    )
    op.add_column(
        "question_banks",
        sa.Column("panelist_role", sa.String(60), nullable=True),
    )

    # ── Predictive-validity flywheel ────────────────────────────────────────
    op.add_column(
        "interview_sessions",
        sa.Column("outcome_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "interview_outcomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_interview_outcomes_user_id", "interview_outcomes", ["user_id"])
    op.create_check_constraint(
        "ck_interview_outcome",
        "interview_outcomes",
        "outcome IN ('interview_scheduled','offer_received','rejected','no_response','did_not_apply')",
    )

    # ── Human-calibration dashboard ─────────────────────────────────────────
    op.create_table(
        "interview_human_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("human_readiness_score", sa.Integer(), nullable=False),
        sa.Column("human_recommendation", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_interview_human_reviews_session_id", "interview_human_reviews", ["session_id"])
    op.create_check_constraint(
        "ck_human_review_recommendation",
        "interview_human_reviews",
        "human_recommendation IN ('Strong Hire','Hire','Maybe','No Hire')",
    )
    op.create_check_constraint(
        "ck_human_review_score_range",
        "interview_human_reviews",
        "human_readiness_score >= 0 AND human_readiness_score <= 100",
    )


def downgrade() -> None:
    op.drop_table("interview_human_reviews")
    op.drop_constraint("ck_interview_outcome", "interview_outcomes", type_="check")
    op.drop_index("ix_interview_outcomes_user_id", table_name="interview_outcomes")
    op.drop_table("interview_outcomes")
    op.drop_column("interview_sessions", "outcome_requested_at")
    op.drop_column("question_banks", "panelist_role")
    op.drop_column("question_banks", "panelist_name")
    op.drop_column("mock_interview_feedback", "judge_disagreement_note")
    op.drop_column("mock_interview_feedback", "judge_scores")
