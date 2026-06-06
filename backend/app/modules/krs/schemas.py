from pydantic import BaseModel
from datetime import date, datetime


class KrsScoreResponse(BaseModel):
    k_score: int
    r_score: int
    s_score: int
    composite: int

    model_config = {"from_attributes": True}


class CareerTrackResponse(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    salary_range: str | None
    growth_outlook: str | None
    example_roles: list[str] | None

    model_config = {"from_attributes": True}


class CareerMatchResponse(BaseModel):
    track: CareerTrackResponse
    match_score: int
    skill_overlap: int
    skills_to_develop: list[str] = []  # required skills the user doesn't yet have


class KrsDashboardResponse(BaseModel):
    krs: KrsScoreResponse
    matches: list[CareerMatchResponse]
    missing_skills: list[str]          # skill gaps — from selected tracks if any, else top match
    profile_complete: bool
    selected_tracks: list[CareerMatchResponse] = []   # user's manually chosen career paths (0-2)
    full_name: str | None = None       # aspirant's name — for personalised greeting
    skills: list[str] = []             # aspirant's skills — for job card skill-gap preview


class LiveJobResponse(BaseModel):
    id: str
    company_name: str
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
    posted_at: datetime
    match_score: int       # combined score (semantic + skill + krs)
    skill_overlap: int     # % of required skills user already has
    semantic_score: int | None = None  # cosine similarity to user profile (0-100), null if no embeddings yet
    employer_website: str | None = None  # employer's website — shown in Apply modal
    is_prepared: bool = False          # whether the user has clicked "Prepare for this Job"
    skills_you_have: list[str] = []    # required skills the user already has
    skills_to_develop: list[str] = []  # required skills the user lacks


class PrepareJobResponse(BaseModel):
    job_id: str
    is_prepared: bool
    message: str
