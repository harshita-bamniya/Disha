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
    match_score: int
    skill_overlap: int
    semantic_score: int | None = None
    employer_website: str | None = None
    is_prepared: bool = False
    skills_you_have: list[str] = []
    skills_to_develop: list[str] = []
    # v2.0 additions
    is_stretch_goal: bool = False          # user is missing only 1-2 required skills
    stretch_goal_message: str | None = None  # "Learn X to qualify" nudge
    match_quality: str = "exploratory"    # perfect | strong | potential | skill_gap | exploratory
    match_reasons: list[str] = []         # human-readable explanation of why this job was recommended


class PrepareJobResponse(BaseModel):
    job_id: str
    is_prepared: bool
    message: str


class JobFitAnalysisRequest(BaseModel):
    job_title: str
    company_name: str
    description: str | None = None
    required_skills: list[str] = []
    skills_you_have: list[str] = []
    skills_to_develop: list[str] = []
    min_k_score: int = 0
    k_score: int = 0


class JobFitAnalysisResponse(BaseModel):
    summary: str


class ActivePrepJobContext(BaseModel):
    """Full context returned when a user has an active prep job set."""
    job_id: str
    job_title: str
    company_name: str
    sector: str
    location: str | None
    required_skills: list[str]
    skills_you_have: list[str]
    skills_to_develop: list[str]
    skill_gap_pct: int          # % of required skills still missing
    matched_track_id: str | None
    matched_track_title: str | None
    matched_track_slug: str | None
    match_score: int
