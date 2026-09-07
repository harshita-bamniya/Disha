"""Job lifecycle: add status column (draft/published/paused/closed/archived)
to job_postings, backfilled from existing is_active.

Revision ID: o9i1j2k3l4m5
Revises: n8h9i1j2k3l4
Create Date: 2026-06-27

Part of Module 05 — Employer Dashboard Audit, Phase 7 (Job Lifecycle).
is_active is kept in sync with status == 'published' going forward — existing
aspirant-facing ranker queries and subscription active-job-limit checks both
filter on is_active and are left untouched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'o9i1j2k3l4m5'
down_revision: Union[str, None] = 'n8h9i1j2k3l4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("status", sa.String(20), nullable=False, server_default="draft"))
    op.create_index("ix_job_postings_status", "job_postings", ["status"])
    op.create_check_constraint(
        "ck_job_postings_status", "job_postings",
        "status IN ('draft','published','paused','closed','archived')",
    )

    # Backfill: existing active jobs become 'published', existing inactive
    # jobs (created via the old pause toggle) become 'paused' — neither is a
    # new draft, since they were already real, previously-live postings.
    op.execute("UPDATE job_postings SET status = 'published' WHERE is_active = true")
    op.execute("UPDATE job_postings SET status = 'paused' WHERE is_active = false")


def downgrade() -> None:
    op.drop_constraint("ck_job_postings_status", "job_postings", type_="check")
    op.drop_index("ix_job_postings_status", table_name="job_postings")
    op.drop_column("job_postings", "status")
