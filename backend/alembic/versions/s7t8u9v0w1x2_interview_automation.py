"""Interview automation: reminders, candidate slot self-booking, no-shows.

Adds to candidate_interview_feedback:
  proposed_slots       — JSONB list of candidate time options an employer
                          offered, when using "Offer Slots" instead of picking
                          one fixed time. NULL for directly-scheduled interviews.
  reminder_24h_sent_at / reminder_1h_sent_at — dedupe stamps for the Celery
                          beat reminder sweep, so a periodic task can run
                          often without double-sending.
  stale_nudge_sent_at  — dedupe stamp for nudging the employer team about an
                          interview whose time has passed with no feedback
                          logged (does NOT auto-reject the candidate — see
                          mark_interview_no_show, a deliberate HR action).

Expands status to add 'no_show' (HR-confirmed, not auto-detected) and
'pending_booking' (slots offered, candidate hasn't picked one yet).

Revision ID: s7t8u9v0w1x2
Revises: r1s2t3u4v5w6
Create Date: 2026-09-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s7t8u9v0w1x2"
down_revision = "r1s2t3u4v5w6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidate_interview_feedback",
        sa.Column("proposed_slots", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("candidate_interview_feedback",
        sa.Column("reminder_24h_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_interview_feedback",
        sa.Column("reminder_1h_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_interview_feedback",
        sa.Column("stale_nudge_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.drop_constraint("ck_interview_feedback_status", "candidate_interview_feedback", type_="check")
    op.create_check_constraint(
        "ck_interview_feedback_status",
        "candidate_interview_feedback",
        "status IN ('scheduled','completed','canceled','no_show','pending_booking')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_interview_feedback_status", "candidate_interview_feedback", type_="check")
    op.create_check_constraint(
        "ck_interview_feedback_status",
        "candidate_interview_feedback",
        "status IN ('scheduled','completed','canceled')",
    )
    op.drop_column("candidate_interview_feedback", "stale_nudge_sent_at")
    op.drop_column("candidate_interview_feedback", "reminder_1h_sent_at")
    op.drop_column("candidate_interview_feedback", "reminder_24h_sent_at")
    op.drop_column("candidate_interview_feedback", "proposed_slots")
