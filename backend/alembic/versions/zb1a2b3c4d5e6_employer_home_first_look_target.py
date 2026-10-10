"""Employer dashboard: the 'applications waiting for a first look' target as an editable setting.

Revision ID: zb1a2b3c4d5e6
Revises: za0f1a2b3c4d5
"""
import sqlalchemy as sa

from alembic import op

revision = "zb1a2b3c4d5e6"
down_revision = "za0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "INSERT INTO platform_settings (id, key, value, description) "
        "SELECT gen_random_uuid(), 'application_first_look_days', CAST('3' AS jsonb), "
        "'Applications still in the Applied stage after this many days count as overdue on the employer dashboard.' "
        "WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'application_first_look_days')"
    ))


def downgrade() -> None:
    op.execute("DELETE FROM platform_settings WHERE key = 'application_first_look_days'")
