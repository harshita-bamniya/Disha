"""Add evidence_quote to mock_interview_feedback; retire the unused
'mock_interview' conversation context_type (its frontend entry point was
already removed) and add the missing 'career_coaching' type (its own
dedicated endpoint has been unable to create a row since that type was
never added to this constraint).

Revision ID: r5s6t7u8v9w0
Revises: q3r4s5t6u7v8
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa

revision = "r5s6t7u8v9w0"
down_revision = "q3r4s5t6u7v8"
branch_labels = None
depends_on = None

OLD_CONSTRAINT = "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview','job_roadmap')"
NEW_CONSTRAINT = "context_type IN ('career','emotional','learning','resume','general','skill_learning','job_roadmap','career_coaching')"


def upgrade() -> None:
    op.add_column(
        "mock_interview_feedback",
        sa.Column("evidence_quote", sa.Text(), nullable=True),
    )
    op.drop_constraint("ck_conv_context_type", "conversations", type_="check")
    op.create_check_constraint("ck_conv_context_type", "conversations", NEW_CONSTRAINT)


def downgrade() -> None:
    op.drop_constraint("ck_conv_context_type", "conversations", type_="check")
    op.create_check_constraint("ck_conv_context_type", "conversations", OLD_CONSTRAINT)
    op.drop_column("mock_interview_feedback", "evidence_quote")
