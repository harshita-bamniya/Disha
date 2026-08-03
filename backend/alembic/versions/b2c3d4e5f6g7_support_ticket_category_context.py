"""Add category, context_job_id, context_application_id to support_tickets.

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b2c3d4e5f6g7"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "support_tickets",
        sa.Column("category", sa.String(40), nullable=False, server_default="general"),
    )
    op.add_column(
        "support_tickets",
        sa.Column(
            "context_job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "support_tickets",
        sa.Column(
            "context_application_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("applications.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("support_tickets", "context_application_id")
    op.drop_column("support_tickets", "context_job_id")
    op.drop_column("support_tickets", "category")
