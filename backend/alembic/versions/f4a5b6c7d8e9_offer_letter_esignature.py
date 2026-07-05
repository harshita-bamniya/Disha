"""Add offer_letters table — persisted offer letters with self-serve e-signature.

"Offer management" was previously just application.status == 'offer_sent', a
pipeline flag with no actual document and no way for a candidate to respond
in-product. This adds a real, persisted offer-letter record per application
(one per application) with a lightweight "typed name + IP/timestamp" e-signature
flow. A full third-party e-sign integration (DocuSign/SignWell) needs a vendor
contract this session can't provide — see docs/ENTERPRISE_AUDIT_ROADMAP.md M2.

Revision ID: f4a5b6c7d8e9
Revises: b95b0f0e0c54
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f4a5b6c7d8e9"
down_revision = "b95b0f0e0c54"
branch_labels = None
depends_on = None

OLD_NOTIFICATION_TYPES = (
    "new_application", "interview_scheduled", "candidate_saved",
    "application_status_changed", "job_match_digest", "deadline_reminder",
    "interview_reschedule_requested",
)
NEW_NOTIFICATION_TYPES = OLD_NOTIFICATION_TYPES + ("offer_accepted", "offer_declined")


def upgrade() -> None:
    op.create_table(
        "offer_letters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role_title", sa.String(200), nullable=False),
        sa.Column("company_address", sa.String(300), nullable=True),
        sa.Column("hiring_manager_name", sa.String(150), nullable=False),
        sa.Column("hiring_manager_designation", sa.String(150), nullable=False),
        sa.Column("salary_ctc", sa.String(100), nullable=False),
        sa.Column("start_date", sa.String(50), nullable=False),
        sa.Column("work_location", sa.String(200), nullable=False),
        sa.Column("employment_type", sa.String(50), nullable=False, server_default="Full-Time"),
        sa.Column("extra_clauses", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="sent"),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signature_name", sa.String(150), nullable=True),
        sa.Column("signature_ip", sa.String(64), nullable=True),
        sa.Column("signature_user_agent", sa.Text(), nullable=True),
        sa.Column("decline_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('sent', 'accepted', 'declined')", name="ck_offer_letter_status"),
    )
    op.create_index("ix_offer_letters_application_id", "offer_letters", ["application_id"], unique=True)

    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", f"type IN {NEW_NOTIFICATION_TYPES}")


def downgrade() -> None:
    op.drop_constraint("ck_notification_type", "notifications", type_="check")
    op.create_check_constraint("ck_notification_type", "notifications", f"type IN {OLD_NOTIFICATION_TYPES}")

    op.drop_index("ix_offer_letters_application_id", table_name="offer_letters")
    op.drop_table("offer_letters")
