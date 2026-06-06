from pydantic import BaseModel, field_validator, model_validator
from typing import Literal
import re

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

VALID_SKILLS = {
    # Core analytical / research
    "Analytical Reasoning", "Research & Analysis", "Data Interpretation",
    "Data Analysis", "Policy Research",
    # Communication & delivery
    "Report Writing", "Essay Writing", "Public Speaking",
    # Leadership & operations
    "Leadership", "Management", "Project Management", "Strategic Planning",
    # Domain knowledge
    "Economics", "Public Administration", "Polity & Governance",
    "Ethics & Integrity", "International Relations", "Law & Legal Knowledge",
    "Stakeholder Engagement",
    # Proficiency
    "Communication", "English Proficiency", "Hindi Proficiency", "Computer Skills",
    # UPSC subject knowledge
    "Science & Technology", "Current Affairs", "History", "Geography", "Environment",
    # Sector-specific
    "Teaching & Training", "Budget & Finance",
}

VALID_SECTORS = {
    "Government & Civil Services", "Public Sector Undertakings (PSU)",
    "Management Consulting", "Education & Training", "NGO & Social Sector",
    "Banking & Finance", "Legal", "Research & Analytics", "Media & Journalism",
    "Healthcare & Public Health", "IT & Technology", "Defence & Security",
    "International Organizations", "Think Tanks & Policy", "Entrepreneurship",
}


# ── Step 1: Personal ─────────────────────────────────────────────────────────

class PersonalInfoRequest(BaseModel):
    full_name: str
    date_of_birth: str          # YYYY-MM-DD
    gender: Literal["male", "female", "other", "prefer_not_to_say"]
    city: str
    state: str

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        if len(v) > 150:
            raise ValueError("Name must be under 150 characters")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Date of birth must be in YYYY-MM-DD format")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("City is required")
        return v

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        if v not in INDIAN_STATES:
            raise ValueError(f"Invalid state. Must be one of the valid Indian states/UTs.")
        return v


# ── Step 2: Education ────────────────────────────────────────────────────────

class EducationRequest(BaseModel):
    highest_qualification: Literal["graduate", "post_graduate", "doctorate", "diploma", "other"]
    degree: str
    field_of_study: str
    institution: str
    graduation_year: int

    @field_validator("degree", "field_of_study", "institution")
    @classmethod
    def non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be blank")
        return v

    @field_validator("graduation_year")
    @classmethod
    def validate_year(cls, v: int) -> int:
        if v < 1970 or v > 2030:
            raise ValueError("Graduation year must be between 1970 and 2030")
        return v


# ── Step 3: UPSC Journey ─────────────────────────────────────────────────────

class UpscJourneyRequest(BaseModel):
    upsc_exam: Literal["cse", "capf", "cds", "ies", "cms", "state_pcs", "other"]
    years_preparing: int
    upsc_attempts: int
    highest_stage_cleared: Literal["none", "prelims", "mains", "interview"]
    optional_subject: str | None = None

    @field_validator("years_preparing")
    @classmethod
    def validate_years(cls, v: int) -> int:
        if v < 0 or v > 30:
            raise ValueError("Years preparing must be between 0 and 30")
        return v

    @field_validator("upsc_attempts")
    @classmethod
    def validate_attempts(cls, v: int) -> int:
        if v < 0 or v > 20:
            raise ValueError("Attempts must be between 0 and 20")
        return v


# ── Step 4: Work Experience ──────────────────────────────────────────────────

class WorkExperienceRequest(BaseModel):
    has_work_experience: bool
    work_experience_years: int | None = None
    work_experience_domain: str | None = None
    last_designation: str | None = None

    @field_validator("work_experience_years")
    @classmethod
    def validate_exp_years(cls, v: int | None) -> int | None:
        if v is not None and (v < 0 or v > 50):
            raise ValueError("Work experience years must be between 0 and 50")
        return v


# ── Step 5: Skills ───────────────────────────────────────────────────────────

class SkillsRequest(BaseModel):
    skills: list[str]

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, v: list[str]) -> list[str]:
        if len(v) == 0:
            raise ValueError("Select at least 1 skill")
        if len(v) > 10:
            raise ValueError("Select at most 10 skills")
        cleaned = []
        for skill in v:
            s = skill.strip()
            if s not in VALID_SKILLS:
                raise ValueError(f"'{s}' is not a valid skill option")
            cleaned.append(s)
        return cleaned


# ── Step 6: Career Preferences ───────────────────────────────────────────────

class PreferencesRequest(BaseModel):
    preferred_sectors: list[str]
    preferred_locations: list[str]
    open_to_relocation: bool
    expected_salary_min: int
    expected_salary_max: int

    @field_validator("preferred_sectors")
    @classmethod
    def validate_sectors(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Select at least 1 sector")
        for s in v:
            if s not in VALID_SECTORS:
                raise ValueError(f"'{s}' is not a valid sector")
        return v

    @field_validator("preferred_locations")
    @classmethod
    def validate_locations(cls, v: list[str]) -> list[str]:
        return [loc.strip() for loc in v if loc.strip()]

    @model_validator(mode="after")
    def validate_locations_required(self) -> "PreferencesRequest":
        # Only require locations when NOT open to relocation
        if not self.open_to_relocation and not self.preferred_locations:
            raise ValueError("Select at least 1 preferred location when not open to relocation")
        return self

    @field_validator("expected_salary_min", "expected_salary_max")
    @classmethod
    def validate_salary(cls, v: int) -> int:
        if v < 0 or v > 500:
            raise ValueError("Salary must be between 0 and 500 LPA")
        return v


# ── Step 7: Psychological Assessment ─────────────────────────────────────────

class PsychologicalAssessmentRequest(BaseModel):
    # Each field uses a named option; the service converts to numeric scores
    burnout_level: Literal["fresh", "somewhat_tired", "exhausted", "burnt_out"]
    confidence_level: Literal["very_confident", "reasonably_confident", "somewhat_unsure", "very_anxious"]
    financial_pressure: Literal["no_rush", "some_pressure", "significant_pressure", "urgent"]
    risk_tolerance: Literal["low", "medium", "high"]
    motivation_type: Literal["intrinsic", "extrinsic", "mixed"]
    identity_attachment: Literal["low", "medium", "high"]
    support_system: Literal["strong", "moderate", "weak"]


# ── Response schemas ─────────────────────────────────────────────────────────

class OnboardingStatusResponse(BaseModel):
    current_step: int
    is_completed: bool
    profile: dict | None = None


class StepSavedResponse(BaseModel):
    message: str
    current_step: int
    is_completed: bool
    disha_insight: str | None = None


class ProfileResponse(BaseModel):
    """Full aspirant profile — returned by GET /onboarding/profile for pre-filling edit forms."""
    # Personal
    full_name: str | None = None
    date_of_birth: str | None = None      # YYYY-MM-DD string
    gender: str | None = None
    city: str | None = None
    state: str | None = None

    # Education
    highest_qualification: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    institution: str | None = None
    graduation_year: int | None = None

    # UPSC Journey
    upsc_exam: str | None = None
    years_preparing: int | None = None
    upsc_attempts: int | None = None
    highest_stage_cleared: str | None = None
    optional_subject: str | None = None

    # Work Experience
    has_work_experience: bool | None = None
    work_experience_years: int | None = None
    work_experience_domain: str | None = None
    last_designation: str | None = None

    # Skills
    skills: list[str] = []

    # Preferences
    preferred_sectors: list[str] = []
    preferred_locations: list[str] = []
    open_to_relocation: bool | None = None
    expected_salary_min: int | None = None
    expected_salary_max: int | None = None

    # Psychology (read-only — re-takes go through /onboarding/psychology)
    motivation_type: str | None = None
    risk_tolerance: str | None = None
    support_system: str | None = None
    disha_insight: str | None = None
