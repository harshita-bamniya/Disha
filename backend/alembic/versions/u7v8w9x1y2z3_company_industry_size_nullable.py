"""Make companies.industry/company_size nullable — same reason as the
employer_profiles migration: registration no longer collects these upfront,
they're filled in later via the post-login setup wizard.

Revision ID: u7v8w9x1y2z3
Revises: t6u7v8w9x1y2
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "u7v8w9x1y2z3"
down_revision = "t6u7v8w9x1y2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("companies", "industry", nullable=True)
    op.alter_column("companies", "company_size", nullable=True)


def downgrade() -> None:
    op.alter_column("companies", "company_size", nullable=False)
    op.alter_column("companies", "industry", nullable=False)
