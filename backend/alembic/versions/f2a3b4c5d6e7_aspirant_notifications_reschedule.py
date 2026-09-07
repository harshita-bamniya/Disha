"""Extend notifications to aspirant-side types; add interview reschedule-request fields.

The notifications table was employer-only by type (new_application,
interview_scheduled, candidate_saved). Adding aspirant-side event types so the
same inbox infrastructure serves both sides. Also adds self-serve reschedule
request fields on candidate_interview_feedback — previously a candidate had no
way to flag a scheduling conflict short of emailing outside the product.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None

OLD_TYPES = ("new_application", "interview_scheduled", "candidate_saved")
NEW_TYPES = OLD_TYPES + (
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
)


def upgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", f"type IN {NEW_TYPES}")

    op.add_column("candidate_interview_feedback", sa.Column("reschedule_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_interview_feedback", sa.Column("reschedule_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidate_interview_feedback", "reschedule_note")
    op.drop_column("candidate_interview_feedback", "reschedule_requested_at")

    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", f"type IN {OLD_TYPES}")
