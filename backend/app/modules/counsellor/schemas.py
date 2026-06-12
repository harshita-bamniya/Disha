from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    safety_flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    id: str
    title: Optional[str]
    context_type: str
    status: str
    message_count: int
    skill_focus: Optional[str] = None
    job_context: Optional[dict] = None
    interview_config: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationSummary):
    messages: list[MessageOut]


class CreateConversationRequest(BaseModel):
    context_type: str = "general"
    skill_focus: Optional[str] = None       # skill_learning
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    sector: Optional[str] = None
    interview_type: Optional[str] = None    # mock_interview: "hr"|"technical"|"stress"
    key_skills: Optional[list[str]] = None  # mock_interview: skills to probe


class SendMessageRequest(BaseModel):
    content: str


class ArchiveConversationResponse(BaseModel):
    conversation_id: str
    status: str
