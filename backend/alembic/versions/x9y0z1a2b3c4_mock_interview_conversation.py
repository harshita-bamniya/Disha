"""Add interview_config to conversations; allow mock_interview context type

Revision ID: x9y0z1a2b3c4
Revises: v7w8x9y0z1a2
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'x9y0z1a2b3c4'
down_revision = 'v7w8x9y0z1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('interview_config', postgresql.JSONB(), nullable=True))

    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint(
        'ck_conv_context_type',
        'conversations',
        "context_type IN ('career','emotional','learning','resume','general','skill_learning')",
    )
    op.drop_column('conversations', 'interview_config')
