"""Add target_skills to learning_paths; add skill_extraction_status to job_postings

Revision ID: s4t5u6v7w8x9
Revises: q2s3t4u5v6w7
Create Date: 2026-06-09

Changes:
- learning_paths.target_skills (JSONB) — master-list skills each path develops; used for gap-driven recommendations
- job_postings.skill_extraction_status (VARCHAR) — tracks async Claude skill extraction ('pending','done','failed')
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 's4t5u6v7w8x9'
down_revision = 'r3s4t5u6v7w8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'learning_paths',
        sa.Column('target_skills', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        'job_postings',
        sa.Column(
            'skill_extraction_status',
            sa.String(20),
            nullable=False,
            server_default='pending',
        ),
    )


def downgrade() -> None:
    op.drop_column('job_postings', 'skill_extraction_status')
    op.drop_column('learning_paths', 'target_skills')
