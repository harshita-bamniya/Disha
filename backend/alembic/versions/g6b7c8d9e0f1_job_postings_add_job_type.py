"""job_postings: add job_type column (remote/hybrid/onsite)

Revision ID: g6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-05-13
"""
from alembic import op

revision = 'g6b7c8d9e0f1'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE job_postings
        ADD COLUMN IF NOT EXISTS job_type VARCHAR(20)
    """)


def downgrade():
    op.execute("ALTER TABLE job_postings DROP COLUMN IF EXISTS job_type")
