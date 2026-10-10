"""Allow the referral notification types in ck_notification_type.

The referral module inserts in-app notifications (type 'referral_*') for teammate referrers. Without this
the insert violates the check constraint (the same drift t7u8v9w0x1y2 fixed for outcome requests).

Revision ID: z9e0f1a2b3c4
Revises: z8d9e0f1a2b3
"""
from alembic import op

revision = "z9e0f1a2b3c4"
down_revision = "z8d9e0f1a2b3"
branch_labels = None
depends_on = None

OLD_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested", "offer_accepted", "offer_declined",
    "announcement", "interview_outcome_request",
    "verified_interview_invite", "verified_interview_done",
)
NEW_TYPES = OLD_TYPES + (
    "referral_applied", "referral_hired", "referral_reward_ready",
    "referral_reward_approved", "referral_reward_paid", "referral_reward_declined",
)


def _sql(types: tuple[str, ...]) -> str:
    return "type IN (" + ", ".join(f"'{t}'" for t in types) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _sql(NEW_TYPES))


def downgrade() -> None:
    op.execute(r"DELETE FROM notifications WHERE type LIKE 'referral%'")
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", _sql(OLD_TYPES))
