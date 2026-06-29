"""Add aspirant_profiles.current_status — supports the shrunk quick-start
onboarding step (full_name + current_status + city only).

Revision ID: v8w9x1y2z3a4
Revises: u7v8w9x1y2z3
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "v8w9x1y2z3a4"
down_revision = "u7v8w9x1y2z3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("current_status", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "current_status")
