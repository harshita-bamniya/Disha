"""job_postings: replace salary_range with salary_min/max integers, location required

Revision ID: f5a6b7c8d9e0
Revises: e5f6a7b8c9d0
Create Date: 2025-01-01 00:00:00.000000

Changes:
- DROP salary_range (free text, un-comparable)
- ADD salary_min INT  (LPA, nullable — employer may not disclose)
- ADD salary_max INT  (LPA, nullable)
- DROP example_roles  (confusing on live postings; only meaningful on career tracks)
- location stays nullable in DB; validation is enforced in the API layer
"""
from alembic import op


revision = "f5a6b7c8d9e0"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE job_postings DROP COLUMN IF EXISTS salary_range")
    op.execute("ALTER TABLE job_postings DROP COLUMN IF EXISTS example_roles")
    op.execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS salary_min INTEGER")
    op.execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS salary_max INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE job_postings DROP COLUMN IF EXISTS salary_min")
    op.execute("ALTER TABLE job_postings DROP COLUMN IF EXISTS salary_max")
    op.execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS salary_range VARCHAR(50)")
    op.execute("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS example_roles JSONB")
