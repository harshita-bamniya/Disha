"""Widen applications.status / application_status_history.to_status check
constraints to cover every status the application actually uses.

Found via manual QA of the auto-shortlist/comparison-screen features: the
DB constraint was last widened in h3c4d5e6f7g9 (2026-06-26) to a 10-value
set, but several statuses already accepted by the API layer since then were
never added at the DB layer — assessment, hr_interview, technical_interview,
manager_interview, offer_declined, and now hold. Any transition into one of
these (including a candidate declining an offer, which sets offer_declined)
would raise a 500 IntegrityError instead of the update it looks like it
should be. This widens both constraints to the full set actually in use.

Revision ID: u9v0w1x2y3z4
Revises: t3u4v5w6x7y8
Create Date: 2026-09-29
"""
from alembic import op

revision = "u9v0w1x2y3z4"
down_revision = "t3u4v5w6x7y8"
branch_labels = None
depends_on = None

OLD_STATUSES = (
    "applied", "under_review", "screening", "shortlisted", "interview_scheduled",
    "interview_completed", "offer_sent", "hired", "rejected", "withdrawn",
)
NEW_STATUSES = OLD_STATUSES + (
    "assessment", "hr_interview", "technical_interview", "manager_interview",
    "hold", "offer_declined",
)
NEW_LIST_SQL = "(" + ",".join(f"'{s}'" for s in NEW_STATUSES) + ")"
OLD_LIST_SQL = "(" + ",".join(f"'{s}'" for s in OLD_STATUSES) + ")"


def upgrade() -> None:
    op.drop_constraint("ck_application_status", "applications", type_="check")
    op.create_check_constraint("ck_application_status", "applications", f"status IN {NEW_LIST_SQL}")

    op.drop_constraint("ck_hist_to_status", "application_status_history", type_="check")
    op.create_check_constraint("ck_hist_to_status", "application_status_history", f"to_status IN {NEW_LIST_SQL}")


def downgrade() -> None:
    op.drop_constraint("ck_hist_to_status", "application_status_history", type_="check")
    op.create_check_constraint("ck_hist_to_status", "application_status_history", f"to_status IN {OLD_LIST_SQL}")

    op.drop_constraint("ck_application_status", "applications", type_="check")
    op.create_check_constraint("ck_application_status", "applications", f"status IN {OLD_LIST_SQL}")
