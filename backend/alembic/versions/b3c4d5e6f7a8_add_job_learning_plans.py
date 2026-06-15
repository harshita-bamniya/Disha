"""Add job_learning_plans table.

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = 'b3c4d5e6f7a8'
down_revision = 'z2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'job_learning_plans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('job_id', UUID(as_uuid=True), sa.ForeignKey('job_postings.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('plan', JSONB, nullable=False, server_default='{}'),
        sa.Column('progress', JSONB, nullable=False, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False, server_default='generating'),
        sa.Column('error_msg', sa.Text, nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_job_learning_plans_user_job', 'job_learning_plans', ['user_id', 'job_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_job_learning_plans_user_job', table_name='job_learning_plans')
    op.drop_table('job_learning_plans')
