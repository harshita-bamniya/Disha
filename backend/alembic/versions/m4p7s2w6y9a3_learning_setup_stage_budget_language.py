"""Learning setup: stage, budget and preferred video language.

Revision ID: m4p7s2w6y9a3
Revises: k8m2r5t9v3w1
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op

revision = "m4p7s2w6y9a3"
down_revision = "k8m2r5t9v3w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("learning_stage", sa.String(20), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("learning_budget", sa.String(20), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("preferred_language", sa.String(5), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "preferred_language")
    op.drop_column("aspirant_profiles", "learning_budget")
    op.drop_column("aspirant_profiles", "learning_stage")
