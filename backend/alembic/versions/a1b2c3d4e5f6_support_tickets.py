"""Add support ticket tables: support_tickets, ticket_messages, ticket_attachments.

Revision ID: a3b4c5d6e7f8
Revises: z1a2b3c4d5e6_scalable_rbac
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a3b4c5d6e7f8"
down_revision = "z1a2b3c4d5e6_scalable_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── support_tickets ───────────────────────────────────────────────────────
    op.create_table(
        "support_tickets",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("subject",      sa.String(300), nullable=False),
        sa.Column("body",         sa.Text,        nullable=True),
        sa.Column("status",       sa.String(20),  nullable=False, server_default="open"),
        sa.Column("priority",     sa.String(10),  nullable=False, server_default="normal"),
        sa.Column("entity_type",  sa.String(20),  nullable=False, server_default="general"),
        sa.Column("entity_id",    postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reporter_id",  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to",  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sla_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at",    sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('open','pending','resolved','closed')",   name="ck_ticket_status"),
        sa.CheckConstraint("priority IN ('low','normal','high','urgent')",        name="ck_ticket_priority"),
        sa.CheckConstraint("entity_type IN ('employer','candidate','general')",   name="ck_ticket_entity_type"),
    )
    op.create_index("ix_support_tickets_status",   "support_tickets", ["status"])
    op.create_index("ix_support_tickets_priority", "support_tickets", ["priority"])
    op.create_index("ix_support_tickets_reporter", "support_tickets", ["reporter_id"])
    op.create_index("ix_support_tickets_assignee", "support_tickets", ["assigned_to"])

    # ── ticket_messages ───────────────────────────────────────────────────────
    op.create_table(
        "ticket_messages",
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body",        sa.Text,    nullable=False),
        sa.Column("is_internal", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ticket_messages_ticket", "ticket_messages", ["ticket_id"])

    # ── ticket_attachments ────────────────────────────────────────────────────
    op.create_table(
        "ticket_attachments",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by",  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_key",     sa.String(500), nullable=False),
        sa.Column("filename",     sa.String(300), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("size_bytes",   sa.Integer,     nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ticket_attachments_ticket", "ticket_attachments", ["ticket_id"])


def downgrade() -> None:
    op.drop_table("ticket_attachments")
    op.drop_table("ticket_messages")
    op.drop_table("support_tickets")
