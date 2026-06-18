"""Add generation_detail JSONB column to job_learning_plans.

Carries live, real progress counters (resources_done/total, current_skill,
last_found title) while a plan is generating — so the frontend can show
genuine progress instead of a static canned message.

Revision ID: a7b8c9d0e1f2
Revises: f2a9b1c3d5e7
Create Date: 2026-06-17
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'a7b8c9d0e1f2'
down_revision = 'f2a9b1c3d5e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'job_learning_plans',
        sa.Column('generation_detail', JSONB, nullable=False, server_default='{}'),
    )


def downgrade() -> None:
    op.drop_column('job_learning_plans', 'generation_detail')
