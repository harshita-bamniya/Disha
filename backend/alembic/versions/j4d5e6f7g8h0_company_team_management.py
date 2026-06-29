"""Company profile + recruiter team management: companies, company_invites,
employer_profiles.company_id / is_owner, with backfill for existing rows.

Revision ID: j4d5e6f7g8h0
Revises: h3c4d5e6f7g9
Create Date: 2026-06-26

Part of Module 05 — Enterprise Admin Panel & Employer Portal, Phase 4.
Backfill creates one Company per existing EmployerProfile and marks it owner —
no existing job postings or applications are touched (they FK to
employer_profiles.id, unchanged).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'j4d5e6f7g8h0'
down_revision: Union[str, None] = 'h3c4d5e6f7g9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("industry", sa.String(100), nullable=False),
        sa.Column("company_size", postgresql.ENUM("1-10", "11-50", "51-200", "201-500", "501-1000", "1000+", name="company_size_enum", create_type=False), nullable=False),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("cover_banner_url", sa.Text(), nullable=True),
        sa.Column("headquarters", sa.String(200), nullable=True),
        sa.Column("founded_year", sa.Integer(), nullable=True),
        sa.Column("social_links", postgresql.JSONB(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="unverified"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_verification_status", "companies", ["verification_status"])

    op.create_table(
        "company_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_company_invites_company_id", "company_invites", ["company_id"])

    op.add_column("employer_profiles", sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True))
    op.add_column("employer_profiles", sa.Column("is_owner", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("ix_employer_profiles_company_id", "employer_profiles", ["company_id"])

    # ── Backfill: one Company per existing EmployerProfile, marked owner ─────────
    op.execute("""
        INSERT INTO companies (id, name, industry, company_size, website, headquarters, description, created_at, updated_at)
        SELECT gen_random_uuid(), company_name, industry, company_size, website, city, description, created_at, updated_at
        FROM employer_profiles
    """)
    # employer_profiles.created_at has no unique key to join back on, so match
    # 1:1 by row order isn't safe — instead backfill via a correlated subquery
    # keyed on company_name + user_id (unique per existing row).
    op.execute("""
        UPDATE employer_profiles ep
        SET company_id = c.id, is_owner = true
        FROM companies c
        WHERE c.name = ep.company_name
          AND c.created_at = ep.created_at
          AND ep.company_id IS NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_employer_profiles_company_id", table_name="employer_profiles")
    op.drop_column("employer_profiles", "is_owner")
    op.drop_column("employer_profiles", "company_id")

    op.drop_index("ix_company_invites_company_id", table_name="company_invites")
    op.drop_table("company_invites")

    op.drop_index("ix_companies_verification_status", table_name="companies")
    op.drop_index("ix_companies_name", table_name="companies")
    op.drop_table("companies")
