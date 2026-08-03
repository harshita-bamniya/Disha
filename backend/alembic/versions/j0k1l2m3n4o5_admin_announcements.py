"""Admin broadcast announcements table.

Revision ID: j0k1l2m3n4o5
Revises: h1i2j3k4l5m6
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j0k1l2m3n4o5"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_announcements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="info"),
        sa.Column("target", sa.String(30), nullable=False, server_default="all"),
        sa.Column("channel", sa.String(20), nullable=False, server_default="in_app"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("type IN ('info', 'warning', 'success', 'alert')", name="ck_announcement_type"),
        sa.CheckConstraint("target IN ('all', 'aspirants', 'employers')", name="ck_announcement_target"),
        sa.CheckConstraint("channel IN ('in_app', 'email', 'both')", name="ck_announcement_channel"),
    )
    op.create_index("ix_admin_announcements_published_at", "admin_announcements", ["published_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_announcements_published_at", table_name="admin_announcements")
    op.drop_table("admin_announcements")
