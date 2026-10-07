"""Roadmap engine v2: role_blueprints and skill_resources.

Revision ID: v1w2x3y4z5a6
Revises: u9v0w1x2y3z4
Create Date: 2026-09-29
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "v1w2x3y4z5a6"
down_revision = "u9v0w1x2y3z4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "role_blueprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("review_status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("graph", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("embedding", postgresql.JSONB(), nullable=True),
        sa.Column("reviewed_by", sa.String(120), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_role_blueprints_slug", "role_blueprints", ["slug"])

    op.create_table(
        "skill_resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cache_key", sa.String(64), nullable=False),
        sa.Column("skill_name", sa.String(200), nullable=False),
        sa.Column("query", sa.String(300), nullable=False),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("level", sa.String(20), nullable=False, server_default="beginner"),
        sa.Column("videos", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(20), nullable=False, server_default="ytdlp"),
        sa.Column("candidates_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("cache_key", name="uq_skill_resources_cache_key"),
    )
    op.create_index("ix_skill_resources_cache_key", "skill_resources", ["cache_key"])


def downgrade() -> None:
    op.drop_index("ix_skill_resources_cache_key", table_name="skill_resources")
    op.drop_table("skill_resources")
    op.drop_index("ix_role_blueprints_slug", table_name="role_blueprints")
    op.drop_table("role_blueprints")
