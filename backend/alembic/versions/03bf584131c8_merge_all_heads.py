"""merge_all_heads

Revision ID: 03bf584131c8
Revises: a7b8c9d0e1f2, e6f7a8b9c0d1, z1a2b3c4d5e6_scalable_rbac
Create Date: 2026-06-20 21:42:37.233809

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '03bf584131c8'
down_revision: Union[str, None] = ('a7b8c9d0e1f2', 'e6f7a8b9c0d1', 'z1a2b3c4d5e6_scalable_rbac')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
