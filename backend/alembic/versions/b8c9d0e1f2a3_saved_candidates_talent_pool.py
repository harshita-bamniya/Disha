"""Add saved_candidates table — talent pool / bookmarked candidates.

Recruiters previously had no way to keep a good candidate once the req they
applied to closed. This lets a recruiter bookmark an aspirant directly
(independent of any one application); shared company-wide via the same
employer_id-list scoping pattern used for jobs/applications.

Revision ID: b8c9d0e1f2a3
Revises: f7a8b9c0d1e2
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b8c9d0e1f2a3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aspirant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("saved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("employer_id", "aspirant_id", name="uq_saved_candidate_employer_aspirant"),
    )
    op.create_index("ix_saved_candidates_employer_id", "saved_candidates", ["employer_id"])
    op.create_index("ix_saved_candidates_aspirant_id", "saved_candidates", ["aspirant_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_candidates_aspirant_id", table_name="saved_candidates")
    op.drop_index("ix_saved_candidates_employer_id", table_name="saved_candidates")
    op.drop_table("saved_candidates")
