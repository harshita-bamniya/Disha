"""Rename aspirant_profiles.disha_insight to beginablai_insight.

Follow-up to the Disha -> BeginablAI product rename: the ORM model attribute
and prior migration source were renamed to beginablai_insight, but that only
affects fresh databases. Any database that had already run migration
x0y1z2a3b4c5 still has the physical column named disha_insight, which broke
every endpoint touching AspirantProfile (onboarding status, dashboard, job
matching, etc.) with UndefinedColumn errors. This renames the live column in
place — no data loss, no new column.

Revision ID: r7s8t9u0v1w2
Revises: a4b5c6d7e8f9
Create Date: 2026-09-04
"""
from alembic import op

revision = "r7s8t9u0v1w2"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE aspirant_profiles
        RENAME COLUMN disha_insight TO beginablai_insight
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE aspirant_profiles
        RENAME COLUMN beginablai_insight TO disha_insight
        """
    )
