"""Interview: background grading state and model_runs cost log.

Adds interview_sessions.grading_status / grading_started_at so finishing an
interview no longer blocks on grading, and a model_runs table that records
tokens and latency for every LLM call made for an interview.

Existing completed sessions keep grading_status NULL (their feedback was
produced inline, so they are treated as done).

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "z5a6b7c8d9e0"
down_revision = "y4z5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("grading_status", sa.String(12), nullable=True))
    op.add_column("interview_sessions", sa.Column("grading_started_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "model_runs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "interview_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("interview_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("purpose", sa.String(40), nullable=False),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("error", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_model_runs_interview_id", "model_runs", ["interview_id"])
    op.create_index("ix_model_runs_purpose", "model_runs", ["purpose"])
    op.create_index("ix_model_runs_created_at", "model_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_model_runs_created_at", table_name="model_runs")
    op.drop_index("ix_model_runs_purpose", table_name="model_runs")
    op.drop_index("ix_model_runs_interview_id", table_name="model_runs")
    op.drop_table("model_runs")
    op.drop_column("interview_sessions", "grading_started_at")
    op.drop_column("interview_sessions", "grading_status")
