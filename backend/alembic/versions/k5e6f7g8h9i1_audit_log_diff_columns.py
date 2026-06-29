"""Audit log diff columns: previous_value / new_value on audit_logs.

Revision ID: k5e6f7g8h9i1
Revises: j4d5e6f7g8h0
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 5.
Additive only — enables before/after diffs on admin moderation actions
(user suspend/ban, employer verification review, role permission changes).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'k5e6f7g8h9i1'
down_revision: Union[str, None] = 'j4d5e6f7g8h0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("previous_value", postgresql.JSONB(), nullable=True))
    op.add_column("audit_logs", sa.Column("new_value", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "new_value")
    op.drop_column("audit_logs", "previous_value")
