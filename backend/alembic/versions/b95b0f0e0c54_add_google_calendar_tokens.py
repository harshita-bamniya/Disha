"""add_google_calendar_tokens

Revision ID: b95b0f0e0c54
Revises: f2a3b4c5d6e7
Create Date: 2026-06-30 19:14:11.025011

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b95b0f0e0c54'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'google_calendar_tokens',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token', sa.Text(), nullable=False),
        sa.Column('calendar_id', sa.String(length=255), nullable=True),
        sa.Column('connected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('google_calendar_tokens')
