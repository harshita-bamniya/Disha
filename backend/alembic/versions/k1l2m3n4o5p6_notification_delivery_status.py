"""Add delivery_status columns to notifications and add 'announcement' type (S5).

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-07-10

NOTE: alembic upgrade head is broken project-wide (cycle in 03bf584131c8).
Apply via psql + manual alembic_version insert:

    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'pending';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_failed_reason TEXT;
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS ck_notification_type;
    ALTER TABLE notifications ADD CONSTRAINT ck_notification_type CHECK (
        type IN (
            'new_application','interview_scheduled','candidate_saved',
            'application_status_changed','job_match_digest','deadline_reminder',
            'interview_reschedule_requested','offer_accepted','offer_declined',
            'announcement'
        )
    );
    INSERT INTO alembic_version (version_num) VALUES ('k1l2m3n4o5p6')
    ON CONFLICT DO NOTHING;
"""
from alembic import op
import sqlalchemy as sa

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None

_ALL_NOTIFICATION_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested", "offer_accepted", "offer_declined",
    "announcement",
)
_TYPE_CHECK = "type IN ({})".format(", ".join(f"'{t}'" for t in _ALL_NOTIFICATION_TYPES))


def upgrade() -> None:
    op.add_column("notifications", sa.Column("delivery_status", sa.String(20), nullable=True, server_default="pending"))
    op.add_column("notifications", sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notifications", sa.Column("email_failed_reason", sa.Text(), nullable=True))

    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _TYPE_CHECK)


def downgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    _OLD = (
        "type IN ('new_application','interview_scheduled','candidate_saved',"
        "'application_status_changed','job_match_digest','deadline_reminder',"
        "'interview_reschedule_requested','offer_accepted','offer_declined')"
    )
    op.create_check_constraint("ck_notification_type", "notifications", _OLD)

    op.drop_column("notifications", "email_failed_reason")
    op.drop_column("notifications", "email_sent_at")
    op.drop_column("notifications", "delivery_status")
