"""Consent timestamp for resume-vs-job scans.

Revision ID: p6c3d8f1a5b2
Revises: m4p7s2w6y9a3
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op

revision = "p6c3d8f1a5b2"
down_revision = "m4p7s2w6y9a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aspirant_profiles", sa.Column("resume_scan_consent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("aspirant_profiles", "resume_scan_consent_at")
