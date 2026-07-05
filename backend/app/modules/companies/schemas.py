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
    """Recruiter-side fields that live on EmployerProfile, not Company —
    used by the post-login setup wizard's 'Recruiter information' step."""
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    city: Optional[str] = None
    gst_number: Optional[str] = None


class EmployerProfileSelfResponse(BaseModel):
    id: str
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
    contact_person: str
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
    active_job_count: int = 0
    total_applicant_count: int = 0
    created_at: Optional[datetime] = None
