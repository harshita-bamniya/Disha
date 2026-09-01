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

# Grouped for display (Step 5 renders one section per category). jobs/schemas.py
# keeps its own flat VALID_SKILLS in sync with the union of these — see the
# note there. compute_k_score/compute_r_score/compute_s_score don't care about
# category, only the flat set below, derived once at import time.
SKILL_CATEGORIES: dict[str, list[str]] = {
    "Analytical & Research": [
        "Analytical Reasoning", "Research & Analysis", "Data Interpretation",
        "Data Analysis", "Policy Research",
    ],
    "Communication": [
        "Report Writing", "Essay Writing", "Public Speaking", "Communication",
    ],
    "Leadership & Operations": [
        "Leadership", "Management", "Project Management", "Strategic Planning",
    ],
    "Domain Knowledge": [
        "Economics", "Public Administration", "Polity & Governance",
        "Ethics & Integrity", "International Relations", "Law & Legal Knowledge",
        "Stakeholder Engagement",
    ],
    "Proficiency": [
        "English Proficiency", "Hindi Proficiency", "Computer Skills",
    ],
    "UPSC Subject Knowledge": [
        "Science & Technology", "Current Affairs", "History", "Geography", "Environment",
    ],
    "Sector-Specific": [
        "Teaching & Training", "Budget & Finance",
    ],
}

VALID_SKILLS: set[str] = {s for skills in SKILL_CATEGORIES.values() for s in skills}

VALID_SECTORS = {
    "Government & Civil Services", "Public Sector Undertakings (PSU)",
    "Management Consulting", "Education & Training", "NGO & Social Sector",
    "Banking & Finance", "Legal", "Research & Analytics", "Media & Journalism",
    "Healthcare & Public Health", "IT & Technology", "Defence & Security",
    "International Organizations", "Think Tanks & Policy", "Entrepreneurship",
}


# ── Step 1: Personal ─────────────────────────────────────────────────────────

class PersonalInfoRequest(BaseModel):
    """Quick-start step — only these 3 fields are required to unlock the
    dashboard. date_of_birth/gender/state are deferred to a later, skippable
    'complete your profile' pass and may be filled in by re-submitting this
    same endpoint."""
    full_name: str
    current_status: Literal["student", "fresher", "experienced"]
    city: str
    date_of_birth: str | None = None          # YYYY-MM-DD
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    state: str | None = None

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
    def validate_dob(cls, v: str | None) -> str | None:
        if v is None:
            return v
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
        # Case-insensitive lookup so a custom entry that happens to match a
        # canonical skill (different casing) collapses onto the canonical
        # spelling instead of creating a near-duplicate.
        canonical_by_lower = {s.lower(): s for s in VALID_SKILLS}
        cleaned: list[str] = []
        seen_lower: set[str] = set()
        for skill in v:
            s = skill.strip()
            lower = s.lower()
            if lower in canonical_by_lower:
                s = canonical_by_lower[lower]
            else:
                # Custom skill, not in the curated list — gap/S-score matching
                # already works on arbitrary skill text via embeddings
                # (krs/skill_gap.py, krs/scoring.py), so this is safe to accept.
                if not (2 <= len(s) <= 60):
                    raise ValueError(f"'{s}' must be between 2 and 60 characters")
                if not re.search(r"[A-Za-z]", s):
                    raise ValueError(f"'{s}' must contain at least one letter")
            if lower in seen_lower:
                continue
            seen_lower.add(lower)
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


# ── Learning setup (one-time, asked before first roadmap/plan generation) ────

class LearningSetupRequest(BaseModel):
    # Each level uses a named option; the service converts to numeric scores
    burnout_level: Literal["fresh", "somewhat_tired", "exhausted", "burnt_out"]
    confidence_level: Literal["very_confident", "reasonably_confident", "somewhat_unsure", "very_anxious"]
    weekly_study_hours: int
    target_completion_date: str | None = None  # YYYY-MM-DD
    skill_proficiency: dict[str, Literal["beginner", "intermediate", "advanced"]] = {}
    # Both change the actual generated plan — see plan_generator.py's PLAN_PROMPT.
    preferred_learning_format: Literal["video", "reading", "hands_on", "mixed"]
    learning_challenge: Literal["motivation", "understanding_concepts", "getting_started", "applying_practically"]

    @field_validator("weekly_study_hours")
    @classmethod
    def validate_weekly_hours(cls, v: int) -> int:
        if v < 1 or v > 80:
            raise ValueError("Weekly study hours must be between 1 and 80")
        return v

    @field_validator("target_completion_date")
    @classmethod
    def validate_target_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Target completion date must be in YYYY-MM-DD format")
        return v


# ── Skill validation (custom entries not already in skill_taxonomy) ──────────

class SkillValidateRequest(BaseModel):
    skill: str


class SkillValidateResponse(BaseModel):
    valid: bool
    canonical_name: str | None = None


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
    current_status: str | None = None
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
    disha_insight: str | None = None

    # Learning setup — one-time, asked before first roadmap/plan generation
    # (read-only here; re-takes go through PUT /onboarding/learning-setup)
    has_learning_setup: bool = False
    weekly_study_hours: int | None = None
    target_completion_date: str | None = None
    skill_proficiency: dict[str, str] = {}
    preferred_learning_format: str | None = None
    learning_challenge: str | None = None
