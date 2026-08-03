from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from datetime import date, datetime

VALID_SKILLS = {
    # Was missing 9 skills the job-posting form actually lets employers pick
    # (Data Analysis, Policy Research, Report Writing, Public Speaking, Project
    # Management, Strategic Planning, Stakeholder Engagement, Teaching &
    # Training, Budget & Finance) — selecting any of them would fail submit
    # validation. Now matches the taxonomy in onboarding/schemas.py exactly.
    "Analytical Reasoning", "Research & Analysis", "Data Interpretation",
    "Data Analysis", "Policy Research",
    "Report Writing", "Essay Writing", "Public Speaking",
    "Leadership", "Management", "Project Management", "Strategic Planning",
    "Economics", "Public Administration", "Polity & Governance",
    "Ethics & Integrity", "International Relations", "Law & Legal Knowledge",
    "Stakeholder Engagement",
    "Communication", "English Proficiency", "Hindi Proficiency", "Computer Skills",
    "Science & Technology", "Current Affairs", "History", "Geography", "Environment",
    "Teaching & Training", "Budget & Finance",
}

VALID_SECTORS = {
    "Government & Civil Services", "Public Sector Undertakings (PSU)",
    "Management Consulting", "Education & Training", "NGO & Social Sector",
    "Banking & Finance", "Legal", "Research & Analytics", "Media & Journalism",
    "Healthcare & Public Health", "IT & Technology", "Defence & Security",
    "International Organizations", "Think Tanks & Policy", "Entrepreneurship",
    "Corporate Affairs", "Government & Policy", "Consulting",
}


class JobPostingRequest(BaseModel):
    title: str
    description: str
    sector: str
    required_skills: list[str]
    min_k_score: int = 0
    # Salary stored as integers (LPA); both optional but max must be ≥ min
    salary_min: int | None = None
    salary_max: int | None = None
    growth_outlook: Literal["high", "medium", "low"] | None = None
    # Work arrangement type — required
    job_type: Literal["remote", "pan_india", "hybrid", "onsite"]
    # City / cities — required for hybrid/onsite; "Remote"/"Pan India" for others
    location: str
    # Employment type — required
    employment_type: Literal["full_time", "part_time", "internship", "contract", "freelance"]
    # When the posting closes — required, must be a future date. An open-ended
    # posting invites stale/zombie listings that never get cleaned up.
    expires_at: date
    # If True, the job goes live immediately (status=published); if False (default),
    # it's saved as a draft — visible only to the employer, not to aspirants.
    publish: bool = False
    # Department this job belongs to. Required for dept-scoped recruiters (auto-filled
    # from their profile); optional for company admins who post cross-dept jobs.
    department_id: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters")
        if len(v) > 200:
            raise ValueError("Title must be under 200 characters")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Description must be at least 20 characters")
        if len(v) > 5000:
            raise ValueError("Description must be under 5000 characters")
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Location is required. Enter a city or 'Pan India'.")
        if len(v) > 200:
            raise ValueError("Location must be under 200 characters")
        return v

    @field_validator("sector")
    @classmethod
    def validate_sector(cls, v: str) -> str:
        if v not in VALID_SECTORS:
            raise ValueError("Invalid sector. Must be one of the valid options.")
        return v

    @field_validator("required_skills")
    @classmethod
    def validate_skills(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Select at least 1 required skill")
        if len(v) > 12:
            raise ValueError("Select at most 12 required skills")
        for skill in v:
            if skill not in VALID_SKILLS:
                raise ValueError(f"'{skill}' is not a valid skill")
        return v

    @field_validator("min_k_score")
    @classmethod
    def validate_k_score(cls, v: int) -> int:
        if v < 0 or v > 100:
            raise ValueError("min_k_score must be between 0 and 100")
        return v

    @field_validator("expires_at")
    @classmethod
    def validate_expiry(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("Expiry date must be in the future")
        return v

    @field_validator("salary_max")
    @classmethod
    def validate_salary(cls, v: int | None, info) -> int | None:
        salary_min = info.data.get("salary_min")
        if v is not None and salary_min is not None:
            if v < salary_min:
                raise ValueError("Max salary must be ≥ min salary")
            if v > 500:
                raise ValueError("Salary must be in LPA (max 500)")
        return v


class SuggestSkillsRequest(BaseModel):
    title: str
    description: str

    @field_validator("description")
    @classmethod
    def validate_description_for_suggest(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Description must be at least 20 characters before suggesting skills")
        return v


class SuggestSkillsResponse(BaseModel):
    suggested_skills: list[str]


class GenerateDescriptionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    sector: str = Field(..., min_length=2, max_length=100)
    key_points: str = Field("", max_length=1000)   # optional bullet points the employer already has


class GenerateDescriptionResponse(BaseModel):
    description: str


class HiringTeamMemberOut(BaseModel):
    id: str
    employer_profile_id: str
    contact_person: str
    email: Optional[str] = None
    job_role: str
    added_at: datetime


class HiringTeamAddRequest(BaseModel):
    employer_profile_id: str
    job_role: Literal["hiring_manager", "interviewer", "coordinator", "recruiter"]


class BulkImportRowError(BaseModel):
    row: int             # 1-based, matches the row number an employer sees in their spreadsheet
    error: str


class BulkImportResponse(BaseModel):
    created: int
    failed: list[BulkImportRowError]


class JobTemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10)
    sector: str = Field(..., min_length=2, max_length=100)
    required_skills: list[str] = []
    job_type: Literal["remote", "pan_india", "hybrid", "onsite"] | None = None
    employment_type: Literal["full_time", "part_time", "internship", "contract", "freelance"] | None = None
    min_k_score: int = 0


class JobTemplateOut(BaseModel):
    id: str
    name: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    job_type: str | None = None
    employment_type: str | None = None
    min_k_score: int
    created_at: datetime


class JobPostingResponse(BaseModel):
    id: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    min_k_score: int
    salary_min: int | None
    salary_max: int | None
    growth_outlook: str | None
    job_type: str | None
    location: str | None
    employment_type: str | None
    expires_at: date | None
    is_active: bool
    status: str
    department_id: str | None = None
    department_name: str | None = None
    created_at: datetime
    updated_at: datetime
    applicant_count: int = 0

    model_config = {"from_attributes": True}


class EmployerDashboardResponse(BaseModel):
    company_name: str
    is_approved: bool
    total_jobs: int
    active_jobs: int
    jobs: list[JobPostingResponse]


class MessageResponse(BaseModel):
    message: str


class EmployerPermissionsResponse(BaseModel):
    role_name: str
    permissions: list[str]   # "resource:action" strings
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    is_company_wide: bool = True


# ── Employer KYC verification (self-service submission) ─────────────────────

class VerificationDocumentOut(BaseModel):
    id: str
    doc_type: str
    file_url: str
    original_filename: str | None = None
    status: str
    uploaded_at: datetime


class VerificationEventOut(BaseModel):
    id: str
    from_status: str | None = None
    to_status: str
    note: str | None = None
    created_at: datetime


class VerificationStatusResponse(BaseModel):
    id: str | None = None
    status: str = "not_submitted"   # not_submitted | pending | under_review | approved | rejected | resubmitted
    rejection_reason: str | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    documents: list[VerificationDocumentOut] = []
    events: list[VerificationEventOut] = []
