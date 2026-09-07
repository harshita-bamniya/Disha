"""Add 'draft' to employer_verifications.status CHECK constraint.

Fixes a real bug: uploading a document created a verification row with
status='pending' immediately — the same value used for "actually submitted,
awaiting review" — so the Submit button never disabled and clicking it
repeatedly spammed duplicate "Submitted for review" timeline events. 'draft'
now represents the upload-in-progress state distinctly from 'pending'.

Revision ID: w9x1y2z3a4b5
Revises: v8w9x1y2z3a4
Create Date: 2026-06-29
"""
from alembic import op

revision = "w9x1y2z3a4b5"
down_revision = "v8w9x1y2z3a4"
branch_labels = None
depends_on = None

OLD_STATUSES = ("pending", "under_review", "approved", "rejected", "resubmitted")
NEW_STATUSES = ("draft", "pending", "under_review", "approved", "rejected", "resubmitted")


def upgrade() -> None:
    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint(
        "ck_emp_verif_status", "employer_verifications",
        f"status IN {NEW_STATUSES}",
    )
    # No data backfill: submitted_at has a DB-level default of now() set at row
    # creation (a separate pre-existing quirk), so it can't reliably tell us
    # which existing 'pending' rows were truly submitted vs still drafts.
    # Existing rows keep their current status; only new rows get 'draft' correctly.


def downgrade() -> None:
    op.execute("UPDATE employer_verifications SET status = 'pending' WHERE status = 'draft'")
    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint(
        "ck_emp_verif_status", "employer_verifications",
        f"status IN {OLD_STATUSES}",
    )
