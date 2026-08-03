"""Simplify employer verification statuses to new flow.

Old flow: draft → pending → under_review → approved | rejected | resubmitted
New flow: requested → under_review → approved | rejected

Revision ID: l7m8n9o0p1q2
Revises: k1l2m3n4o5p6
Create Date: 2026-07-16
"""
from alembic import op

revision = "l7m8n9o0p1q2"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None

OLD_STATUSES = ("draft", "pending", "under_review", "approved", "rejected", "resubmitted")
NEW_STATUSES = ("requested", "under_review", "approved", "rejected")


def upgrade() -> None:
    # Migrate existing rows to new statuses before changing the constraint
    op.execute("""
        UPDATE employer_verifications
        SET status = 'requested'
        WHERE status IN ('draft', 'pending', 'resubmitted')
    """)
    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint(
        "ck_emp_verif_status", "employer_verifications",
        f"status IN {NEW_STATUSES}",
    )


def downgrade() -> None:
    op.execute("""
        UPDATE employer_verifications
        SET status = 'pending'
        WHERE status = 'requested'
    """)
    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint(
        "ck_emp_verif_status", "employer_verifications",
        f"status IN {OLD_STATUSES}",
    )
