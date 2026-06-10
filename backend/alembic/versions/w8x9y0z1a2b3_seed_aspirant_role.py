"""Seed aspirant role

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-06-10

The 'aspirant' role was never seeded in any previous migration, only 'employer'
and 'admin' were. This caused a 500 on /api/auth/register because the service
raises when the role row is missing.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'w8x9y0z1a2b3'
down_revision: Union[str, None] = 'v7w8x9y0z1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO roles (id, name, description)
        VALUES (gen_random_uuid(), 'aspirant', 'UPSC aspirant seeking career relaunch guidance')
        ON CONFLICT (name) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE name = 'aspirant';")
