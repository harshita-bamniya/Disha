"""Auto-shortlist thresholds on job postings.

Adds two nullable per-job settings that drive automatic (non-manual)
resume-based shortlisting:
  auto_shortlist_threshold — match_score at/above which an application is
    shortlisted automatically at submission time (no HR click).
  shortlist_review_floor   — match_score at/above which (but below the
    auto threshold) an application is held in a "needs review" band for
    HR to approve/reject by hand, instead of being silently skipped.

Both default to NULL — existing jobs keep today's fully-manual shortlisting
behavior until an employer opts in by setting these on a job.

Revision ID: r1s2t3u4v5w6
Revises: d94ac2fe1001
Create Date: 2026-09-29
"""
from alembic import op
import sqlalchemy as sa

revision = "r1s2t3u4v5w6"
down_revision = "d94ac2fe1001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_postings",
        sa.Column("auto_shortlist_threshold", sa.Integer(), nullable=True))
    op.add_column("job_postings",
        sa.Column("shortlist_review_floor", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_postings", "shortlist_review_floor")
    op.drop_column("job_postings", "auto_shortlist_threshold")
