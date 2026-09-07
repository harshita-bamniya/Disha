"""Add XP system tables and career_coaching conversation type.

Revision ID: z2a3b4c5d6e7
Revises: y1z2a3b4c5d6
Create Date: 2026-06-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'z2a3b4c5d6e7'
down_revision = 'y1z2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user_xp: one row per user, total XP accumulator ──────────────────────
    op.create_table(
        'user_xp',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('xp_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('xp_this_week', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),
    )
    op.create_index('ix_user_xp_user_id', 'user_xp', ['user_id'])

    # ── xp_transactions: event log ────────────────────────────────────────────
    op.create_table(
        'xp_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('xp_delta', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('ref_id', sa.String(255), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint(
            "event_type IN ('lesson_complete','exercise_score_80','stage_complete','ticket_approved','interview_complete','job_offer','narrative_score_80','daily_mission')",
            name='ck_xp_event_type',
        ),
    )
    op.create_index('ix_xp_transactions_user_id', 'xp_transactions', ['user_id'])
    op.create_index('ix_xp_transactions_created_at', 'xp_transactions', ['created_at'])

    # ── Alter Conversation check constraint to add career_coaching ────────────
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview','career_coaching')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview')",
    )
    op.drop_index('ix_xp_transactions_created_at', table_name='xp_transactions')
    op.drop_index('ix_xp_transactions_user_id', table_name='xp_transactions')
    op.drop_table('xp_transactions')
    op.drop_index('ix_user_xp_user_id', table_name='user_xp')
    op.drop_table('user_xp')
