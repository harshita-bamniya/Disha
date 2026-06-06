"""job_postings: add employment_type and expires_at

Revision ID: h7c8d9e0f1g2
Revises: g6b7c8d9e0f1
Create Date: 2026-05-13
"""
from alembic import op

revision = 'h7c8d9e0f1g2'
down_revision = 'g6b7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE job_postings
        ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30),
        ADD COLUMN IF NOT EXISTS expires_at DATE
    """)


def downgrade():
    op.execute("""
        ALTER TABLE job_postings
        DROP COLUMN IF EXISTS employment_type,
        DROP COLUMN IF EXISTS expires_at
    """)
