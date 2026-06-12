from datetime import datetime
from typing import Optional
from pydantic import BaseModel


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
    industry: str
    company_size: str
    website: Optional[str] = None
    gst_number: Optional[str] = None
    contact_person: str
    designation: Optional[str] = None
    city: str
    description: Optional[str] = None
    phone: str
    phone_verified: bool
    is_approved: bool
    rejection_reason: Optional[str] = None
    registered_at: datetime
    job_count: int = 0
    application_count: int = 0


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
