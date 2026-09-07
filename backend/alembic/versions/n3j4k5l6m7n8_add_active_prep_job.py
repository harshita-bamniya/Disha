"""Add active_prep_job_id to aspirant_profiles

Revision ID: n3j4k5l6m7n8
Revises: m2i3j4k5l6m7
Create Date: 2026-06-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'n3j4k5l6m7n8'
down_revision = 'm2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "aspirant_profiles",
        sa.Column(
            "active_prep_job_id",
            UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "idx_aspirant_active_prep_job",
        "aspirant_profiles",
        ["active_prep_job_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_aspirant_active_prep_job", table_name="aspirant_profiles")
    op.drop_column("aspirant_profiles", "active_prep_job_id")
