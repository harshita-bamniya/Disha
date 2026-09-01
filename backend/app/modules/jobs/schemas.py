from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, field_validator

VALID_SKILLS = {
    "Essay Writing", "Current Affairs", "Polity & Governance", "History",
    "Geography", "Economics", "Science & Technology", "Environment",
    "Ethics & Integrity", "Law & Legal Knowledge", "Public Administration",
    "International Relations", "Analytical Reasoning", "Research & Analysis",
    "Data Interpretation", "Communication", "Leadership", "Management",
    "Hindi Proficiency", "English Proficiency", "Computer Skills",
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
    # When the posting closes — optional, must be a future date
    expires_at: date | None = None

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
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Location is required. Enter a city or 'Pan India'.")
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
    def validate_expiry(cls, v: date | None) -> date | None:
        if v is not None and v <= date.today():
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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployerDashboardResponse(BaseModel):
    company_name: str
    is_approved: bool
    total_jobs: int
    active_jobs: int
    jobs: list[JobPostingResponse]
