"""Pydantic schemas for the Application Form Builder (Phase 3)."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Optional
from pydantic import BaseModel, BeforeValidator, Field

# UUID columns in SQLAlchemy return uuid.UUID objects; Pydantic v2 won't auto-coerce
# them to str without this validator.
UUIDStr = Annotated[str, BeforeValidator(str)]


# ── Question ──────────────────────────────────────────────────────────────────

class QuestionIn(BaseModel):
    question_type: str
    label: str = Field(..., min_length=1, max_length=1000)
    hint_text: Optional[str] = None
    placeholder: Optional[str] = Field(None, max_length=500)
    is_required: bool = False
    character_limit: Optional[int] = Field(None, ge=1, le=10000)
    validation_json: dict[str, Any] = {}
    options_json: Optional[list[dict[str, Any]]] = None
    question_bank_id: Optional[str] = None


class QuestionOut(BaseModel):
    id: UUIDStr
    section_id: UUIDStr
    question_type: str
    label: str
    hint_text: Optional[str]
    placeholder: Optional[str]
    is_required: bool
    is_compliance_protected: bool
    order_index: int
    character_limit: Optional[int]
    validation_json: dict[str, Any]
    options_json: Optional[list[dict[str, Any]]]
    version: int
    question_bank_id: Optional[UUIDStr]
    knockout_rule: Optional["KnockoutRuleOut"] = None

    model_config = {"from_attributes": True}


class QuestionReorderItem(BaseModel):
    question_id: str
    order_index: int


# ── Knockout Rule ─────────────────────────────────────────────────────────────

class KnockoutRuleIn(BaseModel):
    operator: str = Field(..., description="equals | not_equals | greater_than | less_than")
    threshold_value: str = Field(..., min_length=1)
    action: str = Field(..., description="auto_reject | auto_tag | auto_advance | alert | label")
    tag_name: Optional[str] = Field(None, max_length=100)
    advance_stage_id: Optional[str] = None
    priority: int = Field(0, ge=0)


class KnockoutRuleOut(BaseModel):
    id: UUIDStr
    question_id: UUIDStr
    operator: str
    threshold_value: str
    action: str
    tag_name: Optional[str]
    advance_stage_id: Optional[str]
    priority: int

    model_config = {"from_attributes": True}


# ── Conditional Rule ──────────────────────────────────────────────────────────

class ConditionalRuleIn(BaseModel):
    trigger_question_id: str
    operator: str
    trigger_value: Optional[str] = None
    target_entity_type: str = Field(..., description="question | section")
    target_entity_id: str
    action: str = Field("show", description="show | hide")


class ConditionalRuleOut(BaseModel):
    id: UUIDStr
    trigger_question_id: UUIDStr
    operator: str
    trigger_value: Optional[str]
    target_entity_type: str
    target_entity_id: UUIDStr
    action: str

    model_config = {"from_attributes": True}


# ── Form Section ──────────────────────────────────────────────────────────────

class FormSectionIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    section_type: str = Field("questions",
        description="resume | cover_letter | portfolio | documents | questions | compliance | custom")
    is_locked: bool = False


class FormSectionOut(BaseModel):
    id: UUIDStr
    form_id: UUIDStr
    title: str
    description: Optional[str]
    section_type: str
    order_index: int
    is_locked: bool
    is_visible: bool
    questions: list[QuestionOut] = []

    model_config = {"from_attributes": True}


class SectionReorderItem(BaseModel):
    section_id: str
    order_index: int


# ── Application Form ──────────────────────────────────────────────────────────

class FormSettingsIn(BaseModel):
    resume_config: str = Field("required", description="required | optional | hidden | auto_fill")
    require_cover_letter: str = Field("optional", description="required | optional | hidden")
    require_portfolio: str = Field("hidden", description="required | optional | hidden")
    require_work_authorization: bool = False
    allow_attachments: bool = False
    max_attachment_size_mb: int = Field(10, ge=1, le=50)


class ApplicationFormCreateIn(BaseModel):
    settings: FormSettingsIn = FormSettingsIn()
    template_id: Optional[str] = None  # load from template if provided
    clone_from_job_id: Optional[str] = None  # clone from another job's published form


class ApplicationFormUpdateIn(BaseModel):
    settings: Optional[FormSettingsIn] = None


class ApplicationFormOut(BaseModel):
    id: UUIDStr
    job_id: UUIDStr
    status: str
    version: int
    settings_json: dict[str, Any]
    last_published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    sections: list[FormSectionOut] = []
    conditional_rules: list[ConditionalRuleOut] = []

    model_config = {"from_attributes": True}


class ApplicationFormSummaryOut(BaseModel):
    id: UUIDStr
    job_id: UUIDStr
    status: str
    version: int
    settings_json: dict[str, Any]
    last_published_at: Optional[datetime]
    section_count: int
    question_count: int

    model_config = {"from_attributes": True}


# ── Form Template ─────────────────────────────────────────────────────────────

class FormTemplateSaveIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None


class FormTemplateOut(BaseModel):
    id: UUIDStr
    name: str
    description: Optional[str]
    owner_type: str
    used_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Question Bank ─────────────────────────────────────────────────────────────

class AtsQuestionBankOut(BaseModel):
    id: UUIDStr
    question_type: str
    label: str
    hint_text: Optional[str]
    category: Optional[str]
    options_json: Optional[list[dict[str, Any]]]
    is_platform_template: bool
    is_compliance_protected: bool
    owner_type: str

    model_config = {"from_attributes": True}


# resolve forward reference
QuestionOut.model_rebuild()
