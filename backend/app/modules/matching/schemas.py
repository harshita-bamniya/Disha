"""Pydantic schemas for Phase 3 employer matching module."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Job listing (aspirant-facing) ─────────────────────────────────────────────

class JobListItem(BaseModel):
    id: str
    title: str
    sector: str
    company_name: str
    location: Optional[str]
    job_type: Optional[str]
    employment_type: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    required_skills: list[str]
    min_k_score: int
    match_score: Optional[int]
    skill_overlap_pct: Optional[int]
    semantic_score: Optional[int] = None
    expires_at: Optional[datetime]
    created_at: datetime
    # v2.0 additions
    is_stretch_goal: bool = False
    stretch_goal_message: Optional[str] = None
    match_quality: str = "exploratory"
    match_reasons: list[str] = []

    model_config = {"from_attributes": True}


class JobDetail(JobListItem):
    description: str
    growth_outlook: Optional[str]
    match_summary: Optional[str]         # AI-generated match narrative (Phase 3)


# ── Application ───────────────────────────────────────────────────────────────

class ApplyRequest(BaseModel):
    cover_note: Optional[str] = Field(None, max_length=1000)


class WithdrawRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = Field(None, max_length=500)


class ApplicationOut(BaseModel):
    id: str
    job_id: str
    job_title: str
    company_name: str
    status: str
    match_score: Optional[int]
    cover_note: Optional[str]
    employer_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApplicationStatusHistoryItem(BaseModel):
    from_status: Optional[str]
    to_status: str
    note: Optional[str]
    created_at: datetime


class ApplicationDetailOut(ApplicationOut):
    status_history: list[ApplicationStatusHistoryItem]


# ── Employer-facing: candidate pipeline ───────────────────────────────────────

class CandidatePsychProfile(BaseModel):
    burnout_score: Optional[int] = None
    confidence_index: Optional[int] = None
    financial_pressure_score: Optional[int] = None
    risk_tolerance: Optional[str] = None
    motivation_type: Optional[str] = None


class CandidateOut(BaseModel):
    application_id: str
    aspirant_id: str
    # Personal
    full_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    gender: Optional[str] = None
    # Education
    highest_qualification: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[int] = None
    # UPSC Journey
    upsc_attempts: Optional[int]
    highest_stage_cleared: Optional[str]
    years_preparing: Optional[int] = None
    optional_subject: Optional[str] = None
    # Work Experience
    has_work_experience: Optional[bool] = None
    work_experience_years: Optional[int] = None
    work_experience_domain: Optional[str] = None
    last_designation: Optional[str] = None
    # Skills
    skills: list[str]
    # KRS scores
    k_score: Optional[int]
    r_score: Optional[int]
    s_score: Optional[int]
    composite: Optional[int]
    # Psychological profile
    psych: Optional[CandidatePsychProfile] = None
    # Salary expectations
    expected_salary_min: Optional[int] = None
    expected_salary_max: Optional[int] = None
    open_to_relocation: Optional[bool] = None
    preferred_locations: Optional[list[str]] = None
    # Application info
    match_score: Optional[int]
    status: str
    cover_note: Optional[str]
    employer_note: Optional[str] = None
    applied_at: datetime
    days_ago: int = 0
    status_history: list[ApplicationStatusHistoryItem] = []

    model_config = {"from_attributes": True}


class UpdateApplicationStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(under_review|shortlisted|rejected|hired)$")
    note: Optional[str] = Field(None, max_length=500)


class JobCandidatePipeline(BaseModel):
    job_id: str
    job_title: str
    total_applications: int
    by_status: dict[str, int]
    candidates: list[CandidateOut]


# ── Job recommendation response ───────────────────────────────────────────────

class JobRecommendationsResponse(BaseModel):
    total: int
    jobs: list[JobListItem]
