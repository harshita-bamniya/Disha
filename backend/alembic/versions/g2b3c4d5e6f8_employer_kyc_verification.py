"""Employer KYC verification workflow: employer_verifications,
employer_verification_documents, employer_verification_events.

Revision ID: g2b3c4d5e6f8
Revises: f1a2b3c4d5e7
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 2.
Purely additive — no existing tables touched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'g2b3c4d5e6f8'
down_revision: Union[str, None] = 'f1a2b3c4d5e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "employer_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employer_verifications_employer_id", "employer_verifications", ["employer_id"])
    op.create_index("ix_employer_verifications_status", "employer_verifications", ["status"])
    op.create_check_constraint(
        "ck_emp_verif_status", "employer_verifications",
        "status IN ('pending','under_review','approved','rejected','resubmitted')",
    )

    op.create_table(
        "employer_verification_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("verification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(40), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_employer_verification_documents_verification_id", "employer_verification_documents", ["verification_id"])
    op.create_check_constraint(
        "ck_emp_verif_doc_type", "employer_verification_documents",
        "doc_type IN ('gst_certificate','pan_card','company_registration','business_email')",
    )
    op.create_check_constraint(
        "ck_emp_verif_doc_status", "employer_verification_documents",
        "status IN ('pending','verified','rejected')",
    )

    op.create_table(
        "employer_verification_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("verification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employer_verifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_employer_verification_events_verification_id", "employer_verification_events", ["verification_id"])

    # Permission for verification officers / admins to review verifications already
    # exists as companies:verify (seeded in f1a2b3c4d5e7) — no new permission rows needed.


def downgrade() -> None:
    op.drop_index("ix_employer_verification_events_verification_id", table_name="employer_verification_events")
    op.drop_table("employer_verification_events")

    op.drop_index("ix_employer_verification_documents_verification_id", table_name="employer_verification_documents")
    op.drop_table("employer_verification_documents")

    op.drop_index("ix_employer_verifications_status", table_name="employer_verifications")
    op.drop_index("ix_employer_verifications_employer_id", table_name="employer_verifications")
    op.drop_table("employer_verifications")
