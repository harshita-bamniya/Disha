"""add user_job_preparations table

Revision ID: l1h2i3j4k5l6
Revises: k0g1h2i3j4k5
Create Date: 2026-05-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'l1h2i3j4k5l6'
down_revision = 'k0g1h2i3j4k5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_job_preparations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
        ),
        sa.Column(
            "job_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("prepared_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "job_id", name="uq_job_preparation_user_job"),
    )


def downgrade() -> None:
    op.drop_table("user_job_preparations")
