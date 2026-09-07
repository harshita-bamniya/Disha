"""Make employer_profiles.industry/company_size/contact_person/city nullable.

Employer registration is shrinking to phone + password + company_name only —
the rest (industry, size, contact person, designation, city, GST, etc.) move
into a post-login skippable setup wizard. These columns can no longer be
NOT NULL at registration time.

Revision ID: t6u7v8w9x1y2
Revises: r3l4m5n6o7p8
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "t6u7v8w9x1y2"
down_revision = "r3l4m5n6o7p8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("employer_profiles", "industry", nullable=True)
    op.alter_column("employer_profiles", "company_size", nullable=True)
    op.alter_column("employer_profiles", "contact_person", nullable=True)
    op.alter_column("employer_profiles", "city", nullable=True)


def downgrade() -> None:
    op.alter_column("employer_profiles", "city", nullable=False)
    op.alter_column("employer_profiles", "contact_person", nullable=False)
    op.alter_column("employer_profiles", "company_size", nullable=False)
    op.alter_column("employer_profiles", "industry", nullable=False)
