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
    department_id: Optional[str] = None
    department_name: Optional[str] = None
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


_VALID_ATS_STATUSES = (
    "^(screening|shortlisted|assessment|hr_interview|technical_interview|manager_interview"
    "|interview_scheduled|interview_completed|offer_sent|offer_declined|rejected|hired)$"
)


class UpdateApplicationStatusRequest(BaseModel):
    status: str = Field(..., pattern=_VALID_ATS_STATUSES)
    note: Optional[str] = Field(None, max_length=500)


class BulkStatusUpdateRequest(BaseModel):
    application_ids: list[str]
    status: str = Field(..., pattern=_VALID_ATS_STATUSES)
    note: Optional[str] = Field(None, max_length=500)


class SendCandidateEmailRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1, max_length=10_000)


class BulkEmailRequest(BaseModel):
    application_ids: list[str] = Field(..., min_length=1, max_length=100)
    subject: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1, max_length=10_000)


class BulkEmailResponse(BaseModel):
    sent: int
    skipped: int


class OfferLetterRequest(BaseModel):
    role_title: str = Field(..., min_length=1, max_length=200)
    salary_ctc: str = Field(..., min_length=1, max_length=100, description="e.g. '₹12,00,000 per annum'")
    start_date: str = Field(..., min_length=1, max_length=50, description="e.g. '01 August 2026'")
    work_location: str = Field(..., min_length=1, max_length=200)
    employment_type: str = Field("Full-Time", max_length=50)
    company_address: Optional[str] = Field(None, max_length=300)
    hiring_manager_name: str = Field(..., min_length=1, max_length=150)
    hiring_manager_designation: str = Field(..., min_length=1, max_length=150)
    extra_clauses: Optional[str] = Field(None, max_length=2000)


class OfferLetterOut(BaseModel):
    id: str
    application_id: str
    status: str  # sent | accepted | declined
    role_title: str
    salary_ctc: str
    start_date: str
    work_location: str
    employment_type: str
    company_address: Optional[str] = None
    hiring_manager_name: str
    hiring_manager_designation: str
    extra_clauses: Optional[str] = None
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    signature_name: Optional[str] = None
    decline_reason: Optional[str] = None
    created_at: datetime


class OfferLetterAcceptRequest(BaseModel):
    signature_name: str = Field(..., min_length=2, max_length=150, description="Typed full legal name, used as the e-signature")
    confirm: bool = Field(..., description="Must be true — confirms the candidate has read and agrees to the offer terms")


class OfferLetterDeclineRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class CandidateEmailLogOut(BaseModel):
    id: str
    sender_name: Optional[str] = None
    recipient_email: str
    subject: str
    body: str
    created_at: datetime


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
    reschedule_requested_at: Optional[datetime] = None
    reschedule_note: Optional[str] = None


class RequestRescheduleRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=500)


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


class RecruiterPerformanceEntry(BaseModel):
    user_id: str
    name: Optional[str] = None
    applications_moved: int      # status_history rows this recruiter authored
    interviews_conducted: int    # CandidateInterviewFeedback rows where they were interviewer
    notes_added: int             # CandidateNote rows they authored
    hires_closed: int            # applications they moved to 'hired'
    avg_days_to_hire: Optional[float] = None   # for hires they closed, applied_at -> hired_at


class RecruiterPerformanceResponse(BaseModel):
    recruiters: list[RecruiterPerformanceEntry]


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
    rejected_count: int = 0
    response_rate_pct: float
    avg_time_to_hire_days: Optional[float] = None


class ApplicationTrendPoint(BaseModel):
    date: str
    count: int


class ApplicationTrendResponse(BaseModel):
    days: int
    series: list[ApplicationTrendPoint]
