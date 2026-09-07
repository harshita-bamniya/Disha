from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CompanyProfileResponse(BaseModel):
    id: str
    name: str
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    cover_banner_url: Optional[str] = None
    headquarters: Optional[str] = None
    founded_year: Optional[int] = None
    social_links: Optional[dict] = None
    description: Optional[str] = None
    verification_status: str
    created_at: datetime


class CompanyProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    cover_banner_url: Optional[str] = None
    headquarters: Optional[str] = None
    founded_year: Optional[int] = None
    social_links: Optional[dict] = None
    description: Optional[str] = None


class EmployerProfileUpdateRequest(BaseModel):
    """Recruiter-side fields — post-login setup wizard.
    full_name/email are saved to the users row; the rest to EmployerProfile."""
    full_name: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    city: Optional[str] = None
    gst_number: Optional[str] = None


class EmployerProfileSelfResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    city: Optional[str] = None
    gst_number: Optional[str] = None


class CompanyAssetUploadResponse(BaseModel):
    url: str


TEAM_ROLE_NAMES = ("hr_manager", "recruiter", "interviewer")


class TeamMemberEntry(BaseModel):
    user_id: str
    employer_profile_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    role_name: str
    is_owner: bool
    is_active: bool
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime


class TeamInviteRequest(BaseModel):
    email: str
    contact_person: str = Field(..., min_length=1, max_length=150)
    role_name: str = Field(..., pattern="^(hr_manager|recruiter|interviewer|hiring_manager)$")
    # Optional: assign the new member directly to a department at invite time.
    # Company-wide roles (hr_manager) should leave this null.
    department_id: Optional[str] = None
    # If provided, set as the user's login password immediately so they can sign in
    # without going through the forgot-password flow.
    password: Optional[str] = Field(None, min_length=6, max_length=128)


class AssignDepartmentRequest(BaseModel):
    """Reassign a team member to a different department (or clear to company-wide)."""
    department_id: Optional[str] = None


class TransferOwnershipRequest(BaseModel):
    new_owner_employer_profile_id: str


class MessageResponse(BaseModel):
    message: str


# ── Subscriptions ──────────────────────────────────────────────────────────────

class SubscriptionPlanEntry(BaseModel):
    id: str
    name: str
    price_monthly: int
    max_active_jobs: Optional[int] = None
    max_recruiter_seats: Optional[int] = None
    resume_access: bool
    candidate_search_limit: Optional[int] = None
    is_active: bool


class CompanySubscriptionResponse(BaseModel):
    plan: SubscriptionPlanEntry
    status: str
    current_period_start: datetime
    current_period_end: datetime


class SubscriptionUsageResponse(BaseModel):
    active_jobs_used: int
    active_jobs_limit: Optional[int] = None
    recruiter_seats_used: int
    recruiter_seats_limit: Optional[int] = None


class SubscriptionUpgradeRequest(BaseModel):
    plan_id: str


# ── Offices & departments (master data) ────────────────────────────────────────

class OfficeCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    city: str = Field(..., min_length=1, max_length=100)
    state: Optional[str] = None
    is_headquarters: bool = False


class OfficeOut(BaseModel):
    id: str
    name: str
    city: str
    state: Optional[str] = None
    is_headquarters: bool


class DepartmentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    head_employer_id: Optional[str] = None  # EmployerProfile.id of the dept head


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    head_employer_id: Optional[str] = None


class DepartmentOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    head_employer_id: Optional[str] = None
    head_name: Optional[str] = None         # contact_person of the head EmployerProfile
    # Computed stats — populated by the service layer
    member_count: int = 0                   # recruiters/HMs assigned to this dept
    total_job_count: int = 0                # all jobs (draft + published + closed)
    active_job_count: int = 0              # published / is_active=True only
    total_applicant_count: int = 0
    created_at: Optional[datetime] = None


class DepartmentOverviewOut(BaseModel):
    """Richer overview for the DepartmentDetailPage — includes pipeline funnel,
    interview/offer counts, and avg time-to-hire beyond the basic DepartmentOut stats."""
    id: str
    name: str
    description: Optional[str] = None
    head_employer_id: Optional[str] = None
    head_name: Optional[str] = None
    member_count: int = 0
    total_job_count: int = 0
    active_job_count: int = 0
    total_applicant_count: int = 0
    # Pipeline funnel counts
    pipeline_funnel: dict = {}              # {"applied": N, "shortlisted": N, ...}
    # Cross-cutting counts
    scheduled_interviews_count: int = 0    # interviews with status='scheduled'
    pending_offers_count: int = 0          # offer letters with status='sent'
    avg_days_to_hire: Optional[float] = None  # mean days from applied → hired
    created_at: Optional[datetime] = None
