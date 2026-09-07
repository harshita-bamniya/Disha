"""Add users.full_name — used for admin/sub-admin display (aspirants keep using
AspirantProfile.full_name; this is for accounts without a profile table).

Revision ID: m7g8h9i1j2k3
Revises: l6f7g8h9i1j2
Create Date: 2026-06-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'm7g8h9i1j2k3'
down_revision: Union[str, None] = 'l6f7g8h9i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "full_name")
