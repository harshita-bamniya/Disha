"""Add is_followup to session_responses.

Audit finding (2026-08-24): the "stop probing after one follow-up" check
(already_probed in interview/service.py get_next_question) counted responses
sharing the same question_id — but a follow-up's own response is submitted
with question_id=NULL (it isn't a question_banks row), so that count can
never exceed 1 for a follow-up chain. Confirmed live: interviews were
chaining 3 consecutive follow-ups onto question 1, burning 50-60% of the
question budget on one topic. This column lets already_probed be computed
directly and correctly: "was the answer I'm now evaluating itself an answer
to a follow-up question."

Revision ID: u8v9w0x1y2z3
Revises: t7u8v9w0x1y2
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa

revision = "u8v9w0x1y2z3"
down_revision = "t7u8v9w0x1y2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "session_responses",
        sa.Column("is_followup", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("session_responses", "is_followup")
