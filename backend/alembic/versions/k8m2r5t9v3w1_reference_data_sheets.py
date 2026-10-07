"""Research reference tables from UPSC_Master_Database_v2.xlsx (skill framework, salaries, industries, segments, ecosystem).

Revision ID: k8m2r5t9v3w1
Revises: f3a4b5c6d7e8
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "k8m2r5t9v3w1"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

JB = postgresql.JSONB()


def _base() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("source_row", sa.Integer, nullable=True),
    ]


def _stamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    ]


def _lakh(name: str) -> sa.Column:
    return sa.Column(name, sa.Numeric(6, 1), nullable=False)


def upgrade() -> None:
    op.create_table(
        "upsc_skill_framework", *_base(),
        sa.Column("skill_category", sa.String(60), nullable=False),
        sa.Column("upsc_activity", sa.String(300), nullable=False),
        sa.Column("skill_developed", sa.String(400), nullable=False),
        sa.Column("skill_developed_list", JB, nullable=False),
        sa.Column("corporate_translation", sa.Text, nullable=False),
        sa.Column("corporate_translation_list", JB, nullable=False),
        sa.Column("relevant_job_roles", sa.Text, nullable=False),
        sa.Column("relevant_job_roles_list", JB, nullable=False),
        sa.Column("skill_depth", sa.Integer, nullable=False),
        sa.Column("industry_applicability", sa.Text, nullable=True),
        *_stamps(),
        sa.UniqueConstraint("source", "skill_category", "upsc_activity", name="uq_upsc_skill_framework_key"),
        sa.CheckConstraint("skill_depth BETWEEN 1 AND 10", name="ck_upsc_skill_depth"),
    )
    op.create_table(
        "salary_benchmarks", *_base(),
        sa.Column("role_category", sa.String(160), nullable=False),
        sa.Column("specific_role", sa.String(300), nullable=False),
        sa.Column("entry_text", sa.String(80), nullable=False), _lakh("entry_min"), _lakh("entry_max"),
        sa.Column("mid_text", sa.String(80), nullable=False), _lakh("mid_min"), _lakh("mid_max"),
        sa.Column("senior_text", sa.String(80), nullable=False), _lakh("senior_min"), _lakh("senior_max"),
        sa.Column("notes", sa.Text, nullable=True),
        *_stamps(),
        sa.UniqueConstraint("source", "role_category", "specific_role", name="uq_salary_benchmarks_key"),
    )
    op.create_table(
        "industry_analysis", *_base(),
        sa.Column("rank_no", sa.Integer, nullable=False),
        sa.Column("industry", sa.String(200), nullable=False),
        sa.Column("why_upsc_fit", sa.Text, nullable=False),
        sa.Column("top_roles", sa.Text, nullable=False),
        sa.Column("top_roles_list", JB, nullable=False),
        sa.Column("hiring_potential", sa.String(40), nullable=False),
        sa.Column("growth_trajectory", sa.Text, nullable=False),
        sa.Column("primary_upsc_skills", sa.Text, nullable=False),
        sa.Column("primary_upsc_skills_list", JB, nullable=False),
        sa.Column("overall_fit_score", sa.Integer, nullable=False),
        *_stamps(),
        sa.UniqueConstraint("source", "industry", name="uq_industry_analysis_key"),
        sa.CheckConstraint("overall_fit_score BETWEEN 0 AND 100", name="ck_industry_fit"),
    )
    op.create_table(
        "candidate_segments", *_base(),
        sa.Column("category_no", sa.Integer, nullable=False),
        sa.Column("category_name", sa.String(200), nullable=False),
        *[sa.Column(c, sa.Text, nullable=False) for c in (
            "knowledge_depth", "analytical_ability", "research_capability", "communication",
            "strategic_thinking", "problem_solving", "leadership_traits")],
        sa.Column("professional_maturity", sa.Text, nullable=True),
        sa.Column("employability_strengths", sa.Text, nullable=False),
        sa.Column("employability_limitations", sa.Text, nullable=False),
        sa.Column("overall_score", sa.Integer, nullable=False),
        *_stamps(),
        sa.UniqueConstraint("source", "category_no", name="uq_candidate_segments_key"),
        sa.CheckConstraint("overall_score BETWEEN 0 AND 100", name="ck_segment_score"),
    )
    op.create_table(
        "upsc_ecosystem_entries", *_base(),
        sa.Column("section", sa.String(1), nullable=False),
        sa.Column("section_title", sa.String(200), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("label", sa.String(300), nullable=False),
        sa.Column("data", JB, nullable=False),
        *_stamps(),
        sa.UniqueConstraint("source", "section", "position", name="uq_upsc_ecosystem_key"),
        sa.CheckConstraint("section IN ('A','B','C','D','E')", name="ck_upsc_ecosystem_section"),
    )


def downgrade() -> None:
    for t in ("upsc_ecosystem_entries", "candidate_segments", "industry_analysis", "salary_benchmarks", "upsc_skill_framework"):
        op.drop_table(t)
