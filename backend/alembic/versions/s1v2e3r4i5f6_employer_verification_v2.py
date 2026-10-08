"""Employer verification v2: draft/needs_info statuses, structured details, auto-checks, reason codes.

Revision ID: s1v2e3r4i5f6
Revises: r9e5f0b3d7a4
Create Date: 2026-10-08
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "s1v2e3r4i5f6"
down_revision = "r9e5f0b3d7a4"
branch_labels = None
depends_on = None

NEW_STATUSES = ("draft", "requested", "under_review", "needs_info", "approved", "rejected")
OLD_STATUSES = ("requested", "under_review", "approved", "rejected")
NEW_DOC_TYPES = (
    "gst_certificate", "pan_card", "company_registration", "business_email",
    "udyam_certificate", "shops_establishment", "partnership_deed", "ngo_registration",
    "tax_exemption_12a", "signatory_authorisation", "address_proof", "other",
)
OLD_DOC_TYPES = ("gst_certificate", "pan_card", "company_registration", "business_email")


def upgrade() -> None:
    op.add_column("employer_verifications", sa.Column("entity_type", sa.String(40), nullable=True))
    op.add_column("employer_verifications", sa.Column("details", postgresql.JSONB, nullable=True))
    op.add_column("employer_verifications", sa.Column("auto_checks", postgresql.JSONB, nullable=True))
    op.add_column("employer_verifications", sa.Column("reason_code", sa.String(40), nullable=True))
    op.add_column("employer_verifications", sa.Column("info_request", sa.Text, nullable=True))
    op.add_column("employer_verifications", sa.Column("attempt_no", sa.Integer, nullable=False, server_default="1"))

    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint("ck_emp_verif_status", "employer_verifications", f"status IN {NEW_STATUSES}")
    op.drop_constraint("ck_emp_verif_doc_type", "employer_verification_documents", type_="check")
    op.create_check_constraint("ck_emp_verif_doc_type", "employer_verification_documents", f"doc_type IN {NEW_DOC_TYPES}")

    op.add_column("companies", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))

    # Backfill the company-level status from the existing per-profile approvals / cases so the
    # mirror column is truthful from day one.
    op.execute("""
        UPDATE companies c SET verification_status = 'verified', verified_at = COALESCE(
            (SELECT MAX(ep.approved_at) FROM employer_profiles ep WHERE ep.company_id = c.id), now())
        WHERE EXISTS (SELECT 1 FROM employer_profiles ep WHERE ep.company_id = c.id AND ep.is_approved)
    """)
    op.execute("""
        UPDATE companies c SET verification_status = 'pending'
        WHERE c.verification_status = 'unverified' AND EXISTS (
            SELECT 1 FROM employer_verifications v JOIN employer_profiles ep ON ep.id = v.employer_id
            WHERE ep.company_id = c.id AND v.status IN ('requested', 'under_review'))
    """)
    # Approval belongs to the company: bring every profile of an already-verified company in line.
    op.execute("""
        UPDATE employer_profiles ep SET is_approved = true
        FROM companies c WHERE ep.company_id = c.id AND c.verification_status = 'verified'
    """)


def downgrade() -> None:
    op.drop_column("companies", "verified_at")
    op.execute("UPDATE employer_verifications SET status = 'requested' WHERE status IN ('draft', 'needs_info')")
    op.execute(f"DELETE FROM employer_verification_documents WHERE doc_type NOT IN {OLD_DOC_TYPES}")
    op.drop_constraint("ck_emp_verif_doc_type", "employer_verification_documents", type_="check")
    op.create_check_constraint("ck_emp_verif_doc_type", "employer_verification_documents", f"doc_type IN {OLD_DOC_TYPES}")
    op.drop_constraint("ck_emp_verif_status", "employer_verifications", type_="check")
    op.create_check_constraint("ck_emp_verif_status", "employer_verifications", f"status IN {OLD_STATUSES}")
    for col in ("attempt_no", "info_request", "reason_code", "auto_checks", "details", "entity_type"):
        op.drop_column("employer_verifications", col)
