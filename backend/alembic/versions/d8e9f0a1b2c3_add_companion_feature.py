"""add_companion_feature

Revision ID: d8e9f0a1b2c3
Revises: 03bf584131c8
Create Date: 2026-06-22 00:00:00.000000

Adds the two tables unique to "Your Companion" (internal: "Your Friend"):
  - companion_mood_entries  (daily mood check-ins / reflection journal)
  - companion_milestones    (personal wins shown on the journey timeline)

Conversations/messages reuse the existing conversations/messages tables
(context_type='emotional', already allowed by ck_conv_context_type), and
long-term facts reuse counsellor_memory — no schema change needed for those.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, None] = '03bf584131c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'companion_mood_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mood', sa.String(20), nullable=False),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("mood IN ('great','good','okay','low','struggling')", name='ck_companion_mood_value'),
    )
    op.create_index('ix_companion_mood_entries_user_id', 'companion_mood_entries', ['user_id'])

    op.create_table(
        'companion_milestones',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('source', sa.String(20), nullable=False, server_default='user'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("source IN ('user','ai')", name='ck_companion_milestone_source'),
    )
    op.create_index('ix_companion_milestones_user_id', 'companion_milestones', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_companion_milestones_user_id', table_name='companion_milestones')
    op.drop_table('companion_milestones')
    op.drop_index('ix_companion_mood_entries_user_id', table_name='companion_mood_entries')
    op.drop_table('companion_mood_entries')
