"""Add aspirant_profiles.avatar_id — curated icon avatar chosen in the Profile
page, replacing a required uploaded profile photo. Null keeps the initials
fallback already used everywhere Avatar is rendered.

Revision ID: w1x2y3z4a5b6
Revises: t1p2a3y4m5n6
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = "w1x2y3z4a5b6"
down_revision = "t1p2a3y4m5n6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("avatar_id", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "avatar_id")
