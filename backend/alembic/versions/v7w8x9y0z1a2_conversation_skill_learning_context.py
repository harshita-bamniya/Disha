"""Add skill_focus and job_context to conversations; allow skill_learning context type

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-06-09

Changes:
- conversations.skill_focus (VARCHAR 200) — the specific skill being taught
- conversations.job_context (JSONB) — {job_id, job_title, company, sector}
- Drop old context_type CHECK constraint, add new one including 'skill_learning'
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'v7w8x9y0z1a2'
down_revision = 'u6v7w8x9y0z1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('skill_focus', sa.String(200), nullable=True))
    op.add_column('conversations', sa.Column('job_context', postgresql.JSONB(), nullable=True))

    # Replace the old context_type CHECK constraint to include 'skill_learning'
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general','skill_learning')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general')",
    )
    op.drop_column('conversations', 'job_context')
    op.drop_column('conversations', 'skill_focus')
