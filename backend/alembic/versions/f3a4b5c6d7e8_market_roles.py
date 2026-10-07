"""Reference catalogue of roles organisations hire UPSC aspirants for (not job postings).

Revision ID: f3a4b5c6d7e8
Revises: d9e0f1a2b3c4
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "f3a4b5c6d7e8"
down_revision = "d9e0f1a2b3c4"
branch_labels = None
depends_on = None


def _lakh(name: str) -> sa.Column:
    return sa.Column(name, sa.Numeric(6, 1), nullable=True)


def upgrade() -> None:
    jb = postgresql.JSONB()
    op.create_table(
        "market_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("source_row", sa.Integer(), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=False),
        sa.Column("industry", sa.String(120), nullable=False),
        sa.Column("sub_industry", sa.String(160), nullable=True),
        sa.Column("company_type", sa.String(120), nullable=True),
        sa.Column("headquarters", sa.String(160), nullable=True),
        sa.Column("hiring_locations", sa.Text(), nullable=True),
        sa.Column("hiring_locations_list", jb, nullable=False, server_default="[]"),
        sa.Column("website_raw", sa.String(200), nullable=True),
        sa.Column("website_url", sa.String(300), nullable=True),
        sa.Column("department", sa.String(200), nullable=True),
        sa.Column("job_role", sa.String(200), nullable=False),
        sa.Column("job_description", sa.Text(), nullable=True),
        sa.Column("key_responsibilities", sa.Text(), nullable=True),
        sa.Column("responsibilities_list", jb, nullable=False, server_default="[]"),
        sa.Column("required_skills", jb, nullable=False, server_default="[]"),
        sa.Column("preferred_skills", jb, nullable=False, server_default="[]"),
        sa.Column("transferable_upsc_skills", jb, nullable=False, server_default="[]"),
        sa.Column("upsc_skill_mapping", sa.Text(), nullable=True),
        sa.Column("suitable_candidate_categories", jb, nullable=False, server_default="[]"),
        sa.Column("candidate_fit_score", sa.Integer(), nullable=True),
        sa.Column("employability_score", sa.Integer(), nullable=True),
        sa.Column("hiring_suitability_score", sa.Integer(), nullable=True),
        sa.Column("entry_salary_text", sa.String(160), nullable=True), _lakh("entry_salary_min"), _lakh("entry_salary_max"),
        sa.Column("mid_salary_text", sa.String(160), nullable=True), _lakh("mid_salary_min"), _lakh("mid_salary_max"),
        sa.Column("senior_salary_text", sa.String(160), nullable=True), _lakh("senior_salary_min"), _lakh("senior_salary_max"),
        sa.Column("salary_notes", jb, nullable=False, server_default="{}"),
        sa.Column("career_path", sa.Text(), nullable=True),
        sa.Column("career_path_steps", jb, nullable=False, server_default="[]"),
        sa.Column("future_growth", sa.Text(), nullable=True),
        sa.Column("why_suitable", sa.Text(), nullable=True),
        sa.Column("additional_notes", sa.Text(), nullable=True),
        sa.Column("full_description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("source", "company_name", "job_role", name="uq_market_roles_source_company_role"),
        sa.CheckConstraint("candidate_fit_score IS NULL OR candidate_fit_score BETWEEN 0 AND 100", name="ck_market_role_fit"),
        sa.CheckConstraint("employability_score IS NULL OR employability_score BETWEEN 0 AND 100", name="ck_market_role_employ"),
        sa.CheckConstraint("hiring_suitability_score IS NULL OR hiring_suitability_score BETWEEN 0 AND 100", name="ck_market_role_hire"),
    )
    op.create_index("ix_market_roles_industry", "market_roles", ["industry"])
    op.create_index("ix_market_roles_company", "market_roles", ["company_name"])


def downgrade() -> None:
    op.drop_index("ix_market_roles_company", table_name="market_roles")
    op.drop_index("ix_market_roles_industry", table_name="market_roles")
    op.drop_table("market_roles")
