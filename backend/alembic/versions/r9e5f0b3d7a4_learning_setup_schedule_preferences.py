"""Learning setup: session length, study days, deadline reason and practice style.

Revision ID: r9e5f0b3d7a4
Revises: q8d4e9a2c6f3
Create Date: 2026-10-07
"""
import sqlalchemy as sa
from alembic import op

revision = "r9e5f0b3d7a4"
down_revision = "q8d4e9a2c6f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("session_length", sa.String(10), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("study_days", sa.String(12), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("deadline_reason", sa.String(12), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("practice_style", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "practice_style")
    op.drop_column("aspirant_profiles", "deadline_reason")
    op.drop_column("aspirant_profiles", "study_days")
    op.drop_column("aspirant_profiles", "session_length")
