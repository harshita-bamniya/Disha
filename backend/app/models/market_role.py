"""Reference catalogue of roles that organisations hire UPSC aspirants for.

These are NOT job postings. A row says "this company has this kind of role and here is what the role
involves", taken from a research dataset. Nothing here is an open vacancy, nothing can be applied to,
and no employer account exists behind it. Live jobs stay in `job_postings`, posted by real employers.

The catalogue grounds role blueprints and gives candidates realistic role information. Every column
of the source record is kept, plus parsed forms (lists, numeric salary ranges) and an assembled
description built only from the record's own fields.
"""
from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class MarketRole(Base):
    __tablename__ = "market_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # where the record came from, so an import can be repeated or traced back
    source = Column(String(80), nullable=False)
    source_row = Column(Integer, nullable=True)

    # ── company ──────────────────────────────────────────────────────────────
    company_name = Column(String(200), nullable=False)
    industry = Column(String(120), nullable=False)
    sub_industry = Column(String(160), nullable=True)
    company_type = Column(String(120), nullable=True)
    headquarters = Column(String(160), nullable=True)
    hiring_locations = Column(Text, nullable=True)                       # as written in the source
    hiring_locations_list = Column(JSONB, nullable=False, default=list)
    website_raw = Column(String(200), nullable=True)                     # as written, e.g. "deloitte.com/in"
    website_url = Column(String(300), nullable=True)                     # https:// form of the same

    # ── role ─────────────────────────────────────────────────────────────────
    department = Column(String(200), nullable=True)
    job_role = Column(String(200), nullable=False)
    job_description = Column(Text, nullable=True)                        # the source's one-line description
    key_responsibilities = Column(Text, nullable=True)
    responsibilities_list = Column(JSONB, nullable=False, default=list)

    # ── skills ───────────────────────────────────────────────────────────────
    required_skills = Column(JSONB, nullable=False, default=list)
    preferred_skills = Column(JSONB, nullable=False, default=list)
    transferable_upsc_skills = Column(JSONB, nullable=False, default=list)
    upsc_skill_mapping = Column(Text, nullable=True)

    # ── candidate fit (research estimates, 0-100) ────────────────────────────
    suitable_candidate_categories = Column(JSONB, nullable=False, default=list)
    candidate_fit_score = Column(Integer, nullable=True)
    employability_score = Column(Integer, nullable=True)
    hiring_suitability_score = Column(Integer, nullable=True)

    # ── salary benchmarks, INR lakh per annum ────────────────────────────────
    entry_salary_text = Column(String(160), nullable=True)
    entry_salary_min = Column(Numeric(6, 1), nullable=True)
    entry_salary_max = Column(Numeric(6, 1), nullable=True)
    mid_salary_text = Column(String(160), nullable=True)
    mid_salary_min = Column(Numeric(6, 1), nullable=True)
    mid_salary_max = Column(Numeric(6, 1), nullable=True)
    senior_salary_text = Column(String(160), nullable=True)
    senior_salary_min = Column(Numeric(6, 1), nullable=True)
    senior_salary_max = Column(Numeric(6, 1), nullable=True)
    # qualifiers written in brackets in the source, e.g. {"entry": "Stipend", "mid": "Post-fellowship"}
    salary_notes = Column(JSONB, nullable=False, default=dict)

    # ── career ───────────────────────────────────────────────────────────────
    career_path = Column(Text, nullable=True)
    career_path_steps = Column(JSONB, nullable=False, default=list)
    future_growth = Column(Text, nullable=True)
    why_suitable = Column(Text, nullable=True)
    additional_notes = Column(Text, nullable=True)

    # Assembled only from the fields above (no added facts). What a person reads as the role description.
    full_description = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("source", "company_name", "job_role", name="uq_market_roles_source_company_role"),
        CheckConstraint("candidate_fit_score IS NULL OR candidate_fit_score BETWEEN 0 AND 100", name="ck_market_role_fit"),
        CheckConstraint("employability_score IS NULL OR employability_score BETWEEN 0 AND 100", name="ck_market_role_employ"),
        CheckConstraint("hiring_suitability_score IS NULL OR hiring_suitability_score BETWEEN 0 AND 100", name="ck_market_role_hire"),
        Index("ix_market_roles_industry", "industry"),
        Index("ix_market_roles_company", "company_name"),
    )
