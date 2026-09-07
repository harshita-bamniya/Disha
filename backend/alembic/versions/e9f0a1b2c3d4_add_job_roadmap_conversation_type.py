"""add_job_roadmap_conversation_type

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-06-22 01:00:00.000000

Adds 'job_roadmap' to the conversations.context_type check constraint — a
conversational (non-Socratic) AI Counsellor thread docked into the Roadmap
page, scoped to a single job's prep instead of teaching one named skill.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e9f0a1b2c3d4'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_CONSTRAINT = "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview')"
NEW_CONSTRAINT = "context_type IN ('career','emotional','learning','resume','general','skill_learning','mock_interview','job_roadmap')"


def upgrade() -> None:
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint('ck_conv_context_type', 'conversations', NEW_CONSTRAINT)


def downgrade() -> None:
    op.drop_constraint('ck_conv_context_type', 'conversations', type_='check')
    op.create_check_constraint('ck_conv_context_type', 'conversations', OLD_CONSTRAINT)
