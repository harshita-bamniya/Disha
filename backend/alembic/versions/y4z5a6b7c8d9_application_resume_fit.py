"""Applications: resume fit status and employer-safe snapshot.

match_score on an application now holds the resume-fit score instead of the profile score.

Existing rows hold the old profile-based number, which employers must no longer see, so it is cleared:
rows with a resume become 'pending' (re-scored by `python -m app.scripts.backfill_resume_fit`) and rows
without one become 'no_resume'. The downgrade drops the new columns but cannot restore the old numbers.

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-09-30
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "y4z5a6b7c8d9"
down_revision = "x3y4z5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("resume_fit_status", sa.String(12), nullable=True))
    op.add_column("applications", sa.Column("resume_fit", postgresql.JSONB(), nullable=True))
    op.execute(
        "UPDATE applications SET match_score = NULL, "
        "resume_fit_status = CASE WHEN resume_id IS NULL THEN 'no_resume' ELSE 'pending' END"
    )


def downgrade() -> None:
    op.drop_column("applications", "resume_fit")
    op.drop_column("applications", "resume_fit_status")
