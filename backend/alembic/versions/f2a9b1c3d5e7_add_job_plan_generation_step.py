"""Add generation_step column to job_learning_plans.

Tracks fine-grained progress while a plan is generating: agenda -> resources
-> finalizing -> (status flips to ready/failed). Lets the frontend show a
real step-by-step progress UI instead of a generic spinner.

Revision ID: f2a9b1c3d5e7
Revises: c4d5e6f7a8b9
Create Date: 2026-06-17
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = 'f2a9b1c3d5e7'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'job_learning_plans',
        sa.Column('generation_step', sa.String(20), nullable=False, server_default='agenda'),
    )


def downgrade() -> None:
    op.drop_column('job_learning_plans', 'generation_step')
