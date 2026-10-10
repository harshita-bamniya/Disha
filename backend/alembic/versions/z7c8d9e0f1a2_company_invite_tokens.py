"""company invites become real invitations: token, expiry, department

Revision ID: z7c8d9e0f1a2
Revises: z6b7c8d9e0f1
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "z7c8d9e0f1a2"
down_revision = "z6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_invites", sa.Column("token_hash", sa.String(length=64), nullable=True))
    op.add_column("company_invites", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("company_invites", sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("company_invites", sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_company_invites_department", "company_invites", "company_departments", ["department_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_company_invites_token_hash", "company_invites", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_company_invites_token_hash", table_name="company_invites")
    op.drop_constraint("fk_company_invites_department", "company_invites", type_="foreignkey")
    for c in ("department_id", "last_sent_at", "expires_at", "token_hash"):
        op.drop_column("company_invites", c)
