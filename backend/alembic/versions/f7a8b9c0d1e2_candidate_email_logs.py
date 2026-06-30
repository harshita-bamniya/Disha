"""Add candidate_email_logs table — audit trail for recruiter-to-candidate emails.

Recruiters previously had no way to email a candidate from inside the product
at all. This table persists every email sent from the applicant pipeline so
there's a record of recruiter outreach (compliance + team visibility), even
though delivery itself goes through the existing app.core.email provider.

Revision ID: f7a8b9c0d1e2
Revises: w9x1y2z3a4b5
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f7a8b9c0d1e2"
down_revision = "w9x1y2z3a4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_email_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_candidate_email_logs_application_id", "candidate_email_logs", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_candidate_email_logs_application_id", table_name="candidate_email_logs")
    op.drop_table("candidate_email_logs")
