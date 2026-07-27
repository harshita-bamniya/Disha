from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class ResumeSectionContent(BaseModel):
    """Free-form JSONB — we accept any dict."""
    class Config:
        extra = "allow"


class ResumeSectionOut(BaseModel):
    id: str
    section_type: str
    title: Optional[str]
    content: dict[str, Any]
    sort_order: int
    ai_improved: bool

    class Config:
        from_attributes = True


class ResumeVersionOut(BaseModel):
    id: str
    version_num: int
    ai_generated: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ResumeTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    template_type: Optional[str]
    thumbnail_url: Optional[str]

    class Config:
        from_attributes = True


class ResumeSummary(BaseModel):
    id: str
    title: str
    is_primary: bool
    ats_score: Optional[int]
    score_breakdown: Optional[dict[str, Any]] = None
    career_track_name: Optional[str]
    template_name: Optional[str]
    section_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResumeDetail(ResumeSummary):
    sections: list[ResumeSectionOut]


class CreateResumeRequest(BaseModel):
    title: str = "My Resume"
    career_track_id: Optional[str] = None
    template_id: Optional[str] = None


class UpdateResumeRequest(BaseModel):
    title: Optional[str] = None
    career_track_id: Optional[str] = None
    template_id: Optional[str] = None
    is_primary: Optional[bool] = None


class UpsertSectionRequest(BaseModel):
    section_type: str
    title: Optional[str] = None
    content: dict[str, Any]
    sort_order: int = 0


class AIImproveSectionRequest(BaseModel):
    section_id: str
    career_context: Optional[str] = None


class AIImproveSectionResponse(BaseModel):
    section_id: str
    improved_content: dict[str, Any]
    original_content: dict[str, Any]


class AIGenerateResumeResponse(BaseModel):
    resume_id: str
    message: str
    sections_created: int
    ats_score: Optional[int]


class AIGenerateStreamRequest(BaseModel):
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    required_skills: Optional[list[str]] = None
    job_description: Optional[str] = None
    answers: dict[str, str] = {}


class SectionReorderItem(BaseModel):
    section_id: str
    sort_order: int


class ReorderSectionsRequest(BaseModel):
    sections: list[SectionReorderItem]


# ─── Resume import (upload + parse + confirm) ─────────────────────────────────

class ParsedPersonalInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None


class ParsedResumeData(BaseModel):
    """Parsed resume structure returned to frontend for confirmation before import."""
    personal_info: Optional[ParsedPersonalInfo] = None
    summary: Optional[str] = None
    experience: list[dict[str, Any]] = []
    education: list[dict[str, Any]] = []
    skills: dict[str, Any] = {}
    projects: list[dict[str, Any]] = []
    certifications: list[dict[str, Any]] = []
    achievements: list[str] = []
    languages: list[dict[str, Any]] = []


class ImportParsedRequest(BaseModel):
    """Confirmed parsed resume data + metadata for creating the DB records."""
    title: str = "Imported Resume"
    career_track_id: Optional[str] = None
    template_id: Optional[str] = None
    parsed_data: ParsedResumeData


# ─── Job target ───────────────────────────────────────────────────────────────

class SetJobTargetRequest(BaseModel):
    job_posting_id: Optional[str] = None
    job_description: Optional[str] = None


# ─── Score breakdown ─────────────────────────────────────────────────────────

class ScoreCriterion(BaseModel):
    score: int
    explanation: str


class ScoreBreakdownOut(BaseModel):
    ats_compatibility: ScoreCriterion
    keyword_coverage: ScoreCriterion
    impact: ScoreCriterion
    completeness: ScoreCriterion
    readability: ScoreCriterion
    formatting: ScoreCriterion
    overall: int


# ─── Version restore ──────────────────────────────────────────────────────────

class RestoreVersionResponse(BaseModel):
    message: str
    resume_id: str
