"""employer verification: document AI check result + proven business email

Revision ID: z6b7c8d9e0f1
Revises: t2c3a4r5e6e7
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "z6b7c8d9e0f1"
down_revision = "t2c3a4r5e6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employer_verification_documents", sa.Column("ai_check", postgresql.JSONB(), nullable=True))
    op.add_column("employer_verifications", sa.Column("business_email_verified", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("employer_verifications", "business_email_verified")
    op.drop_column("employer_verification_documents", "ai_check")
