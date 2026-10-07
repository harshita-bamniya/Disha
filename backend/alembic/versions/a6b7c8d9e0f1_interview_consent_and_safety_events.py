"""Interview: consent ledger and safety events.

interview_consents records what a candidate agreed to before an interview
(AI processing, own effort, optional product improvement) and which wording
version they saw. interview_safety_events records crisis signals that halted
an interview; it stores the matched phrase only, never the answer text.

Revision ID: a6b7c8d9e0f1
Revises: z5a6b7c8d9e0
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a6b7c8d9e0f1"
down_revision = "z5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("text_version", sa.String(20), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IN ('ai_processing','own_effort','improve_product')", name="ck_interview_consent_kind"),
    )
    op.create_index("ix_interview_consents_user_id", "interview_consents", ["user_id"])
    op.create_index("ix_interview_consents_session_id", "interview_consents", ["session_id"])

    op.create_table(
        "interview_safety_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("triggered_by", sa.String(200), nullable=True),
        sa.Column("action_taken", sa.String(50), nullable=False, server_default="session_halted"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_interview_safety_events_session_id", "interview_safety_events", ["session_id"])
    op.create_index("ix_interview_safety_events_user_id", "interview_safety_events", ["user_id"])
    op.create_index("ix_interview_safety_events_created_at", "interview_safety_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("interview_safety_events")
    op.drop_table("interview_consents")
