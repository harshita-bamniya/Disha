from pydantic import BaseModel
from datetime import datetime


class TrackSummaryResponse(BaseModel):
    """Lightweight card shown on the explore page."""
    id: str
    slug: str
    title: str
    sector: str
    salary_range: str | None
    growth_outlook: str | None
    match_score: int | None       # None when KRS not yet computed
    skill_overlap: int | None
    is_selected: bool

    model_config = {"from_attributes": True}


class TrackDetailResponse(BaseModel):
    """Full track detail including gap analysis."""
    id: str
    slug: str
    title: str
    description: str
    sector: str
    required_skills: list[str]
    min_k_score: int
    salary_range: str | None
    growth_outlook: str | None
    example_roles: list[str]
    # Personalised fields (None before KRS is computed)
    match_score: int | None
    skill_overlap: int | None
    skills_you_have: list[str]    # intersection of user skills & required
    skills_to_develop: list[str]  # required skills the user doesn't yet have
    is_selected: bool

    model_config = {"from_attributes": True}


class SelectionResponse(BaseModel):
    track_id: str
    is_selected: bool
    total_selections: int
    message: str


class MySelectionsResponse(BaseModel):
    selections: list[TrackSummaryResponse]
    total: int
