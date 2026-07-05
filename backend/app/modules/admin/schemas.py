from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ── Aspirant detail (full profile modal) ─────────────────────────────────────

class AspirantEducation(BaseModel):
    highest_qualification: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[int] = None


class AspirantUpscJourney(BaseModel):
    upsc_exam: Optional[str] = None
    years_preparing: Optional[int] = None
    upsc_attempts: Optional[int] = None
    highest_stage_cleared: Optional[str] = None
    optional_subject: Optional[str] = None


class AspirantWorkExperience(BaseModel):
    has_work_experience: Optional[bool] = None
    work_experience_years: Optional[int] = None
    work_experience_domain: Optional[str] = None
    last_designation: Optional[str] = None


class AspirantCareerPreferences(BaseModel):
    preferred_sectors: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    open_to_relocation: Optional[bool] = None
    expected_salary_min: Optional[int] = None
    expected_salary_max: Optional[int] = None


class AspirantPsychProfile(BaseModel):
    burnout_score: int
    confidence_index: int
    financial_pressure_score: int
    risk_tolerance: str
    motivation_type: str
    identity_attachment: str
    support_system: str
    disha_insight: Optional[str] = None


class AspirantKrsDetail(BaseModel):
    k_score: int
    r_score: int
    s_score: int
    composite: int
    computed_at: datetime


class AspirantSelectedTrack(BaseModel):
    track_id: str
    title: str
    sector: str
    selected_at: datetime


class AspirantDetailResponse(BaseModel):
    """Full profile for the admin user detail modal."""
    # Identity
    user_id: str
    phone: str
    email: Optional[str] = None
    is_active: bool
    registered_at: datetime
    last_login_at: Optional[datetime] = None

    # Personal
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    # Onboarding status
    is_completed: bool
    current_step: int

    # Sub-sections (None when not yet filled)
    education: Optional[AspirantEducation] = None
    upsc_journey: Optional[AspirantUpscJourney] = None
    work_experience: Optional[AspirantWorkExperience] = None
    skills: Optional[list[str]] = None
    career_preferences: Optional[AspirantCareerPreferences] = None
    psychological_profile: Optional[AspirantPsychProfile] = None
    krs: Optional[AspirantKrsDetail] = None
    selected_tracks: list[AspirantSelectedTrack] = []

    # Application stats
    total_applications: int = 0


class AspirantUserEntry(BaseModel):
    """One row in the admin aspirant list."""
    user_id: str
    phone: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_completed: bool
    current_step: int
    is_active: bool = True
    krs_composite: Optional[int] = None
    k_score: Optional[int] = None
    r_score: Optional[int] = None
    s_score: Optional[int] = None
    registered_at: datetime
    application_count: int = 0


class CareerTrackAdminEntry(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    min_k_score: int
    salary_range: Optional[str] = None
    growth_outlook: Optional[str] = None
    example_roles: list[str]
    created_at: datetime
    aspirant_count: int = 0


class CareerTrackCreateRequest(BaseModel):
    slug: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    min_k_score: int = 0
    salary_range: Optional[str] = None
    growth_outlook: Optional[str] = None
    example_roles: list[str] = []


class CareerTrackUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sector: Optional[str] = None
    required_skills: Optional[list[str]] = None
    min_k_score: Optional[int] = None
    salary_range: Optional[str] = None
    growth_outlook: Optional[str] = None
    example_roles: Optional[list[str]] = None


class PendingEmployerResponse(BaseModel):
    id: str                     # employer_profiles.id
    user_id: str
    company_name: str
    # Industry/size/contact/city are filled in later via the post-login setup
    # wizard now — null at registration time, so these can't be required.
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    gst_number: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    phone: str
    phone_verified: bool
    is_approved: bool
    rejection_reason: Optional[str] = None
    registered_at: datetime
    job_count: int = 0
    application_count: int = 0


class GlobalSearchResult(BaseModel):
    type: str            # "user" | "employer" | "job" | "application"
    id: str
    title: str
    subtitle: Optional[str] = None
    section: str         # admin dashboard Section value to navigate to


class GlobalSearchResponse(BaseModel):
    query: str
    results: list[GlobalSearchResult]


class AdminStatsResponse(BaseModel):
    total_aspirants: int
    completed_onboarding: int
    total_employers: int
    pending_employers: int
    approved_employers: int
    total_job_postings: int
    active_job_postings: int
    # New
    total_applications: int = 0
    new_users_last_7d: int = 0
    new_jobs_last_7d: int = 0
    avg_krs_composite: Optional[float] = None
    hired_count: int = 0


class AdminJobEntry(BaseModel):
    id: str
    title: str
    company_name: str
    employer_id: str
    sector: str
    location: Optional[str] = None
    employment_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    is_active: bool
    applicant_count: int = 0
    created_at: datetime
    expires_at: Optional[datetime] = None


class AdminApplicationEntry(BaseModel):
    id: str
    aspirant_name: Optional[str] = None
    aspirant_phone: str
    aspirant_id: str
    job_title: str
    company_name: str
    job_id: str
    status: str
    match_score: Optional[int] = None
    applied_at: datetime


class AdminActivityItem(BaseModel):
    type: str          # 'signup' | 'application' | 'job_posted' | 'employer_approved'
    title: str
    subtitle: Optional[str] = None
    timestamp: datetime


class RejectRequest(BaseModel):
    reason: str


class MessageResponse(BaseModel):
    message: str


# ── RBAC: Roles & Permissions ─────────────────────────────────────────────────

class PermissionEntry(BaseModel):
    id: str
    resource: str
    action: str
    description: Optional[str] = None


class RoleEntry(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    permissions: list[str] = []   # "resource:action" strings
    user_count: int = 0


class RolePermissionsUpdateRequest(BaseModel):
    permission_ids: list[str]   # full replacement set for this role


# ── Sub-admin management ──────────────────────────────────────────────────────

PLATFORM_ROLE_NAMES = {
    "super_admin", "admin", "moderator",
    "verification_officer", "finance_manager", "support_executive",
}


class SubAdminEntry(BaseModel):
    user_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    role_id: str
    role_name: str
    status: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


class SubAdminCreateRequest(BaseModel):
    email: str
    phone: Optional[str] = None
    role_id: str
    full_name: Optional[str] = None


class SubAdminRoleUpdateRequest(BaseModel):
    role_id: str


# ── User management: status, login history, sessions ─────────────────────────

class UserStatusUpdateRequest(BaseModel):
    status: Literal["active", "suspended", "banned"]
    reason: Optional[str] = Field(None, max_length=500)


class LoginHistoryEntry(BaseModel):
    id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_label: Optional[str] = None
    success: bool
    failure_reason: Optional[str] = None
    created_at: datetime


class DeviceSessionEntry(BaseModel):
    id: str
    device_label: Optional[str] = None
    ip_address: Optional[str] = None
    last_seen_at: datetime
    is_current: bool = False
    created_at: datetime


# ── Employer KYC verification ─────────────────────────────────────────────────

class VerificationDocumentEntry(BaseModel):
    id: str
    doc_type: str
    file_url: str
    original_filename: Optional[str] = None
    status: str
    notes: Optional[str] = None
    uploaded_at: datetime


class VerificationEventEntry(BaseModel):
    id: str
    actor_name: Optional[str] = None
    from_status: Optional[str] = None
    to_status: str
    note: Optional[str] = None
    created_at: datetime


class EmployerVerificationEntry(BaseModel):
    id: str
    employer_id: str
    company_name: str
    status: str
    rejection_reason: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    document_count: int = 0


class EmployerVerificationDetail(EmployerVerificationEntry):
    reviewer_notes: Optional[str] = None
    documents: list[VerificationDocumentEntry] = []
    events: list[VerificationEventEntry] = []


class VerificationReviewRequest(BaseModel):
    action: Literal["under_review", "approve", "reject"]
    notes: Optional[str] = Field(None, max_length=1000)
    rejection_reason: Optional[str] = Field(None, max_length=500)


class UserManagementEntry(BaseModel):
    user_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role_name: Optional[str] = None
    full_name: Optional[str] = None
    status: str
    is_active: bool
    failed_login_attempts: int = 0
    last_login_at: Optional[datetime] = None
    registered_at: datetime


# ── Audit log ──────────────────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    id: str
    actor_email: Optional[str] = None
    actor_phone: Optional[str] = None
    action: str
    resource: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    previous_value: Optional[dict] = None
    new_value: Optional[dict] = None
    created_at: datetime


class AuditLogPage(BaseModel):
    total: int
    items: list[AuditLogEntry]


# ── Subscription plans (super_admin/finance_manager) ──────────────────────────

class SubscriptionPlanAdminEntry(BaseModel):
    id: str
    name: str
    price_monthly: int
    max_active_jobs: Optional[int] = None
    max_recruiter_seats: Optional[int] = None
    resume_access: bool
    candidate_search_limit: Optional[int] = None
    is_active: bool


class SubscriptionPlanUpdateRequest(BaseModel):
    price_monthly: Optional[int] = None
    max_active_jobs: Optional[int] = None
    max_recruiter_seats: Optional[int] = None
    resume_access: Optional[bool] = None
    candidate_search_limit: Optional[int] = None
    is_active: Optional[bool] = None


class PlanRevenueEntry(BaseModel):
    plan_id: str
    plan_name: str
    price_monthly: int          # paise
    company_count: int
    mrr: int                    # paise — price_monthly * company_count, active subs only


class RevenueTrendPoint(BaseModel):
    month: str                  # "2026-06"
    new_subscriptions: int      # derived from CompanySubscription.created_at — real data


class BillingOverviewResponse(BaseModel):
    mrr: int                    # paise, sum over active subscriptions
    arpa: int                   # paise, mrr / active_company_count (0 if none)
    active_subscriptions: int
    past_due_subscriptions: int
    canceled_subscriptions: int
    new_subscriptions_30d: int
    plan_distribution: list[PlanRevenueEntry]
    trend: list[RevenueTrendPoint]   # last 6 months, new subscriptions only —
    # there's no cancellation timestamp in the data model yet (CompanySubscription
    # has no canceled_at), so a churn-over-time trend would be fabricated. Once a
    # real cancel flow exists, add canceled_at and extend this honestly.
