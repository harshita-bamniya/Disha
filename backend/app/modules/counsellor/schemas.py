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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationSummary):
    messages: list[MessageOut]


class CreateConversationRequest(BaseModel):
    context_type: str = "general"


class SendMessageRequest(BaseModel):
    content: str


class ArchiveConversationResponse(BaseModel):
    conversation_id: str
    status: str
