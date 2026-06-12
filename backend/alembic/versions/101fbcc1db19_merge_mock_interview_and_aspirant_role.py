"""merge_mock_interview_and_aspirant_role

Revision ID: 101fbcc1db19
Revises: w8x9y0z1a2b3, x9y0z1a2b3c4
Create Date: 2026-06-10 19:21:12.875255

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '101fbcc1db19'
down_revision: Union[str, None] = ('w8x9y0z1a2b3', 'x9y0z1a2b3c4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
