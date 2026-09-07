"""add dynamic interview fields

Revision ID: e6f7a8b9c0d1
Revises: y1z2a3b4c5d6
Create Date: 2026-06-15 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'e6f7a8b9c0d1'
down_revision = 'y1z2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('interview_sessions', sa.Column('job_role', sa.String(150), nullable=True))
    op.add_column('interview_sessions', sa.Column('experience_level', sa.String(50), nullable=True))
    op.add_column('interview_sessions', sa.Column('job_description', sa.Text(), nullable=True))
    op.add_column('interview_sessions', sa.Column('blueprint', JSONB(), nullable=True))
    op.add_column('interview_sessions', sa.Column('job_readiness_report', JSONB(), nullable=True))
    # Allow dynamic questions that aren't in question_bank
    op.alter_column('session_responses', 'question_id', nullable=True)
    op.add_column('session_responses', sa.Column('dynamic_question_text', sa.Text(), nullable=True))
    op.add_column('session_responses', sa.Column('dynamic_question_type', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('session_responses', 'dynamic_question_type')
    op.drop_column('session_responses', 'dynamic_question_text')
    op.alter_column('session_responses', 'question_id', nullable=False)
    op.drop_column('interview_sessions', 'job_readiness_report')
    op.drop_column('interview_sessions', 'blueprint')
    op.drop_column('interview_sessions', 'job_description')
    op.drop_column('interview_sessions', 'experience_level')
    op.drop_column('interview_sessions', 'job_role')
