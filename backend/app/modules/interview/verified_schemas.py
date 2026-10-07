from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

REASON_CODES = (
    "strong_evidence", "needs_more_information", "skills_gap", "role_filled", "better_fit_elsewhere", "other",
)


def _uuid_or_none(value: Optional[str]) -> Optional[str]:
    if value in (None, ""):
        return None
    try:
        return str(UUID(str(value)))
    except ValueError:
        raise ValueError("must be a valid UUID")


class CompetencyIn(BaseModel):
    skill: str = Field(min_length=2, max_length=100)
    weight: float = Field(gt=0, le=100)
    must_have: bool = False


class TemplateIn(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    role: str = Field(min_length=2, max_length=150)
    language: Literal["en", "hi", "hinglish"] = "en"
    duration_minutes: int = Field(default=15, ge=10, le=20)
    job_id: Optional[str] = None
    competencies: list[CompetencyIn] = Field(min_length=1, max_length=8)
    # Checked by the compliance filter, which explains any rejection.
    custom_questions: list[str] = Field(default_factory=list, max_length=10)

    _check_job = field_validator("job_id")(_uuid_or_none)


class DraftRequest(BaseModel):
    role: str = Field(min_length=2, max_length=150)
    language: Literal["en", "hi", "hinglish"] = "en"


class InviteIn(BaseModel):
    template_id: str
    application_id: str
    expires_in_days: int = Field(default=7, ge=1, le=30)

    _check_ids = field_validator("template_id", "application_id")(_uuid_or_none)


class DecisionIn(BaseModel):
    decision: Literal["shortlist", "hold", "decline"]
    reason_code: Literal[
        "strong_evidence", "needs_more_information", "skills_gap", "role_filled", "better_fit_elsewhere", "other"
    ]
    note: Optional[str] = Field(default=None, max_length=1000)


class StartInvitationIn(BaseModel):
    consents: list[Literal["ai_processing", "own_effort", "improve_product", "media", "employer_share"]] = []


class AppealIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class IntegrityEventIn(BaseModel):
    kind: Literal["tab_hidden", "window_blur", "face_missing", "multiple_faces"]
    started_ms: int = Field(ge=0, le=6 * 3600 * 1000)
    ended_ms: Optional[int] = Field(default=None, ge=0, le=6 * 3600 * 1000)


class IntegrityEventsIn(BaseModel):
    events: list[IntegrityEventIn] = Field(max_length=50)


class ResolveAppealIn(BaseModel):
    note: str = Field(min_length=3, max_length=2000)
