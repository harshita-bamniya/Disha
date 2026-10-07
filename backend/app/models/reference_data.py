"""Research reference tables imported from UPSC_Master_Database_v2.xlsx (besides the role catalogue).

Read-only research data, not live jobs and not user data. Every source cell is kept as written; lists and
numbers are parsed copies. Scores and salaries are the dataset's estimates, unverified by us.
"""
from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class _Stamp:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UpscSkillFramework(_Stamp, Base):
    """UPSC activity -> the corporate skill it builds (depth 1-10)."""
    __tablename__ = "upsc_skill_framework"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)
    skill_category = Column(String(60), nullable=False)
    upsc_activity = Column(String(300), nullable=False)
    skill_developed = Column(String(400), nullable=False)
    skill_developed_list = Column(JSONB, nullable=False, default=list)
    corporate_translation = Column(Text, nullable=False)
    corporate_translation_list = Column(JSONB, nullable=False, default=list)
    relevant_job_roles = Column(Text, nullable=False)
    relevant_job_roles_list = Column(JSONB, nullable=False, default=list)
    skill_depth = Column(Integer, nullable=False)
    industry_applicability = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("source", "skill_category", "upsc_activity", name="uq_upsc_skill_framework_key"),
        CheckConstraint("skill_depth BETWEEN 1 AND 10", name="ck_upsc_skill_depth"),
    )


class SalaryBenchmark(_Stamp, Base):
    """Salary ranges by role category, INR lakh per annum (research estimates)."""
    __tablename__ = "salary_benchmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)
    role_category = Column(String(160), nullable=False)
    specific_role = Column(String(300), nullable=False)
    entry_text = Column(String(80), nullable=False)
    entry_min = Column(Numeric(6, 1), nullable=False)
    entry_max = Column(Numeric(6, 1), nullable=False)
    mid_text = Column(String(80), nullable=False)
    mid_min = Column(Numeric(6, 1), nullable=False)
    mid_max = Column(Numeric(6, 1), nullable=False)
    senior_text = Column(String(80), nullable=False)
    senior_min = Column(Numeric(6, 1), nullable=False)
    senior_max = Column(Numeric(6, 1), nullable=False)
    notes = Column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("source", "role_category", "specific_role", name="uq_salary_benchmarks_key"),)


class IndustryAnalysis(_Stamp, Base):
    __tablename__ = "industry_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)
    rank_no = Column(Integer, nullable=False)
    industry = Column(String(200), nullable=False)
    why_upsc_fit = Column(Text, nullable=False)
    top_roles = Column(Text, nullable=False)
    top_roles_list = Column(JSONB, nullable=False, default=list)
    hiring_potential = Column(String(40), nullable=False)
    growth_trajectory = Column(Text, nullable=False)
    primary_upsc_skills = Column(Text, nullable=False)
    primary_upsc_skills_list = Column(JSONB, nullable=False, default=list)
    overall_fit_score = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("source", "industry", name="uq_industry_analysis_key"),
        CheckConstraint("overall_fit_score BETWEEN 0 AND 100", name="ck_industry_fit"),
    )


class CandidateSegment(_Stamp, Base):
    """The nine candidate categories that market_roles.suitable_candidate_categories refers to."""
    __tablename__ = "candidate_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)
    category_no = Column(Integer, nullable=False)
    category_name = Column(String(200), nullable=False)
    knowledge_depth = Column(Text, nullable=False)
    analytical_ability = Column(Text, nullable=False)
    research_capability = Column(Text, nullable=False)
    communication = Column(Text, nullable=False)
    strategic_thinking = Column(Text, nullable=False)
    problem_solving = Column(Text, nullable=False)
    leadership_traits = Column(Text, nullable=False)
    # Missing in the source for some categories (the cell is absent, not blank): kept NULL, never guessed.
    professional_maturity = Column(Text, nullable=True)
    employability_strengths = Column(Text, nullable=False)
    employability_limitations = Column(Text, nullable=False)
    overall_score = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("source", "category_no", name="uq_candidate_segments_key"),
        CheckConstraint("overall_score BETWEEN 0 AND 100", name="ck_segment_score"),
    )


class UpscEcosystemEntry(_Stamp, Base):
    """Rows of the 'UPSC Ecosystem & Skills' sheet. Five differently shaped sections share one table:
    `section` is A-E, `data` holds each column under its source header."""
    __tablename__ = "upsc_ecosystem_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)
    section = Column(String(1), nullable=False)
    section_title = Column(String(200), nullable=False)
    position = Column(Integer, nullable=False)
    label = Column(String(300), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "section", "position", name="uq_upsc_ecosystem_key"),
        CheckConstraint("section IN ('A','B','C','D','E')", name="ck_upsc_ecosystem_section"),
    )
