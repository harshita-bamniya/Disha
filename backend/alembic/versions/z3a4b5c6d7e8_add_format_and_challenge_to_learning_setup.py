"""Add preferred_learning_format + learning_challenge to the learning setup.

Both are read by jobs/plan_generator.py's PLAN_PROMPT to change the actual
generated plan (video/article resource split, project_deliverable framing,
resource ordering) — not just stored as decorative profile fields.

Revision ID: z3a4b5c6d7e8
Revises: y2z3a4b5c6d7
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "z3a4b5c6d7e8"
down_revision = "y2z3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("preferred_learning_format", sa.String(20), nullable=True))
    op.add_column("aspirant_profiles", sa.Column("learning_challenge", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "learning_challenge")
    op.drop_column("aspirant_profiles", "preferred_learning_format")
