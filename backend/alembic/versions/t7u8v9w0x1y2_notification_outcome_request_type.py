"""Add 'interview_outcome_request' to the notifications.type CHECK constraint.

Audit finding (2026-08-24): the Phase 7 predictive-validity flywheel's daily
Celery task (send_interview_outcome_requests) inserts a Notification with
type='interview_outcome_request', but that value was never added to
ck_notification_type — every insert violates the constraint, the task's broad
except/rollback swallows it silently, and the task has never successfully
sent a single notification since it was written.

Revision ID: t7u8v9w0x1y2
Revises: s6t7u8v9w0x1
Create Date: 2026-08-24
"""
from alembic import op

revision = "t7u8v9w0x1y2"
down_revision = "s6t7u8v9w0x1"
branch_labels = None
depends_on = None

OLD_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
    "offer_accepted", "offer_declined",
    "announcement",
)
NEW_TYPES = OLD_TYPES + ("interview_outcome_request",)


def _constraint_sql(types: tuple[str, ...]) -> str:
    return "type IN (" + ", ".join(f"'{t}'" for t in types) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _constraint_sql(NEW_TYPES))


def downgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _constraint_sql(OLD_TYPES))
