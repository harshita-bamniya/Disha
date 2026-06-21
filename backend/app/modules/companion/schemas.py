from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    safety_flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    title: Optional[str]
    message_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MoodEntryOut(BaseModel):
    id: str
    mood: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CreateMoodEntryRequest(BaseModel):
    mood: str = Field(pattern="^(great|good|okay|low|struggling)$")
    note: Optional[str] = Field(default=None, max_length=2000)


class MilestoneOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class CreateMilestoneRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class MemoryOut(BaseModel):
    id: str
    memory_type: str
    content: str
    importance: str
    created_at: Optional[str]


class WeeklyInsight(BaseModel):
    mood_counts: dict[str, int]
    dominant_mood: Optional[str]
    check_in_count: int
    check_in_streak: int
    latest_milestone: Optional[MilestoneOut]


class TimelineEntry(BaseModel):
    type: str  # "mood" | "milestone"
    date: datetime
    mood: Optional[str] = None
    note: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
