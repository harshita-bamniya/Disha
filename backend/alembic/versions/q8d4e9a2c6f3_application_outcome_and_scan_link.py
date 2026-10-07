"""Candidate-reported application outcome, and the resume-match scan behind an application's fit score.

Revision ID: q8d4e9a2c6f3
Revises: p6c3d8f1a5b2
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "q8d4e9a2c6f3"
down_revision = "p6c3d8f1a5b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("candidate_outcome", sa.String(20), nullable=True))
    op.add_column("applications", sa.Column("candidate_outcome_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("resume_match_scan_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_applications_resume_match_scan", "applications", "resume_match_scans",
                          ["resume_match_scan_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_applications_resume_match_scan", "applications", type_="foreignkey")
    op.drop_column("applications", "resume_match_scan_id")
    op.drop_column("applications", "candidate_outcome_at")
    op.drop_column("applications", "candidate_outcome")
