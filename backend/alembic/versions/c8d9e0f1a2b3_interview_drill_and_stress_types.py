"""Interview: drill and stress session types.

A drill is a single-question practice round scored with one cheap model call.
Stress is the opt-in advanced mode (unlocked after completed interviews).

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-10-02
"""
from alembic import op

revision = "c8d9e0f1a2b3"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_session_type", "interview_sessions", type_="check")
    op.create_check_constraint(
        "ck_session_type", "interview_sessions",
        "session_type IN ('practice','timed','full_mock','stress','drill')",
    )


def downgrade() -> None:
    op.execute("UPDATE interview_sessions SET session_type = 'practice' WHERE session_type IN ('stress','drill')")
    op.drop_constraint("ck_session_type", "interview_sessions", type_="check")
    op.create_check_constraint(
        "ck_session_type", "interview_sessions",
        "session_type IN ('practice','timed','full_mock')",
    )
