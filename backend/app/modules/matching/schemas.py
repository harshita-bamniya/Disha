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
    notes: list["CandidateNoteOut"] = []
    avg_rating: Optional[float] = None
    interview_feedback: list["InterviewFeedbackOut"] = []

    model_config = {"from_attributes": True}


class UpdateApplicationStatusRequest(BaseModel):
    status: str = Field(
        ...,
        pattern="^(screening|shortlisted|interview_scheduled|interview_completed|offer_sent|rejected|hired)$",
    )
    note: Optional[str] = Field(None, max_length=500)


class BulkStatusUpdateRequest(BaseModel):
    application_ids: list[str]
    status: str = Field(
        ...,
        pattern="^(screening|shortlisted|interview_scheduled|interview_completed|offer_sent|rejected|hired)$",
    )
    note: Optional[str] = Field(None, max_length=500)


class CandidateNoteCreateRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)
    is_internal: bool = True


class CandidateNoteOut(BaseModel):
    id: str
    author_name: Optional[str] = None
    note: str
    is_internal: bool
    created_at: datetime


class CandidateRatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class ScheduleInterviewRequest(BaseModel):
    scheduled_at: datetime
    meeting_link: Optional[str] = Field(None, max_length=500)


class InterviewFeedbackSubmitRequest(BaseModel):
    recommendation: Optional[str] = Field(None, pattern="^(strong_yes|yes|no|strong_no)$")
    feedback: Optional[str] = Field(None, max_length=4000)


class InterviewFeedbackOut(BaseModel):
    id: str
    application_id: str
    interviewer_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    meeting_link: Optional[str] = None
    status: str
    recommendation: Optional[str] = None
    feedback: Optional[str] = None
    created_at: datetime


class UpcomingInterviewEntry(BaseModel):
    id: str
    application_id: str
    candidate_name: Optional[str] = None
    job_id: str
    job_title: str
    scheduled_at: datetime
    meeting_link: Optional[str] = None
    interviewer_name: Optional[str] = None


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


# ── Employer analytics (Module 05 Phase 5) ────────────────────────────────────

class EmployerFunnelStage(BaseModel):
    stage: str
    count: int
    pct_of_total: float


class EmployerFunnelResponse(BaseModel):
    total_applications: int
    stages: list[EmployerFunnelStage]


class JobPerformanceEntry(BaseModel):
    job_id: str
    title: str
    is_active: bool
    total_applications: int
    shortlisted: int
    interviewed: int
    hired: int
    rejected: int
    conversion_rate_pct: float   # hired / total_applications
    created_at: datetime


class JobPerformanceResponse(BaseModel):
    jobs: list[JobPerformanceEntry]


# ── Dashboard KPIs (Module 05 Phase 8) ─────────────────────────────────────────

class DashboardKpis(BaseModel):
    active_jobs: int
    draft_jobs: int
    paused_jobs: int
    closed_jobs: int
    archived_jobs: int
    applications_today: int
    total_applications: int
    interviews_scheduled: int
    offers_sent: int
    hires: int
    response_rate_pct: float          # % of applications moved past 'applied' by a recruiter
    avg_time_to_hire_days: Optional[float] = None   # null until at least one hire


class ApplicationTrendPoint(BaseModel):
    date: str
    count: int


class ApplicationTrendResponse(BaseModel):
    days: int
    series: list[ApplicationTrendPoint]
