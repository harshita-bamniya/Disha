"""Add company_offices + company_departments — multi-office/department master data.

A company with 3 hiring sites previously had nowhere to record that in the
data model. Master data only in this pass — job_postings.location stays
free-text; wiring a dropdown to these tables is a fast follow-up.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_offices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("is_headquarters", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_company_offices_company_id", "company_offices", ["company_id"])

    op.create_table(
        "company_departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "name", name="uq_company_department_name"),
    )
    op.create_index("ix_company_departments_company_id", "company_departments", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_company_departments_company_id", table_name="company_departments")
    op.drop_table("company_departments")
    op.drop_index("ix_company_offices_company_id", table_name="company_offices")
    op.drop_table("company_offices")
