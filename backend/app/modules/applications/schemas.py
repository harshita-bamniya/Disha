"""Pydantic schemas for the Application Submission flow (Phase 4)."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Optional
from pydantic import BaseModel, BeforeValidator, Field

UUIDStr = Annotated[str, BeforeValidator(str)]


# ── Eligibility ───────────────────────────────────────────────────────────────

class EligibilityOut(BaseModel):
    eligible: bool
    reason: Optional[str] = None   # "already_applied" | "job_closed" | "limit_reached"
    existing_application_id: Optional[UUIDStr] = None
    has_draft: bool = False
    draft_id: Optional[UUIDStr] = None


# ── Draft ─────────────────────────────────────────────────────────────────────

class DraftStartRequest(BaseModel):
    selected_resume_id: Optional[str] = None


class DraftSaveRequest(BaseModel):
    current_step: int = Field(1, ge=1)
    responses: dict[str, Any] = {}      # {question_id: answer_value}
    selected_resume_id: Optional[str] = None


class DraftOut(BaseModel):
    id: UUIDStr
    job_id: UUIDStr
    current_step: int
    responses_json: dict[str, Any]
    selected_resume_id: Optional[UUIDStr]
    last_saved_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


# ── Submission ────────────────────────────────────────────────────────────────

class AnswerIn(BaseModel):
    question_id: str
    text_value: Optional[str] = None
    number_value: Optional[int] = None
    date_value: Optional[datetime] = None
    option_values: Optional[list[str]] = None
    file_attachment_id: Optional[str] = None


class SubmitApplicationRequest(BaseModel):
    selected_resume_id: Optional[str] = None
    answers: list[AnswerIn] = []
    cover_note: Optional[str] = Field(None, max_length=2000)


class ApplicationOut(BaseModel):
    id: UUIDStr
    job_id: UUIDStr
    job_title: str
    company_name: str
    status: str
    reference_number: Optional[str]
    match_score: Optional[int]
    knockout_triggered: bool
    application_score: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApplicationDetailOut(ApplicationOut):
    cover_note: Optional[str]
    employer_note: Optional[str]
    status_history: list["StatusHistoryItem"] = []


class StatusHistoryItem(BaseModel):
    from_status: Optional[str]
    to_status: str
    note: Optional[str]
    is_automated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WithdrawRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


# resolve forward ref
ApplicationDetailOut.model_rebuild()
