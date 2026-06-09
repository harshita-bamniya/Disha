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
    match_score: Optional[int]           # null when user has no KRS yet
    skill_overlap_pct: Optional[int]     # % of required skills user already has
    semantic_score: Optional[int] = None  # cosine similarity score (0-100); null when embeddings not yet computed
    expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class JobDetail(JobListItem):
    description: str
    growth_outlook: Optional[str]
    match_summary: Optional[str]         # AI-generated match narrative (Phase 3)


# ── Application ───────────────────────────────────────────────────────────────

class ApplyRequest(BaseModel):
    cover_note: Optional[str] = Field(None, max_length=1000)


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

class CandidateOut(BaseModel):
    application_id: str
    aspirant_id: str
    full_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    upsc_attempts: Optional[int]
    highest_stage_cleared: Optional[str]
    skills: list[str]
    k_score: Optional[int]
    r_score: Optional[int]
    s_score: Optional[int]
    composite: Optional[int]
    match_score: Optional[int]
    status: str
    cover_note: Optional[str]
    applied_at: datetime

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
