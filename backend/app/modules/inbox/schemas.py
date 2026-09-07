from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: Optional[str] = None
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    unread_count: int
    notifications: list[NotificationOut]


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    due_at: Optional[datetime] = None
    application_id: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    due_at: Optional[datetime] = None
    is_done: Optional[bool] = None


class TaskOut(BaseModel):
    id: str
    title: str
    due_at: Optional[datetime] = None
    is_done: bool
    application_id: Optional[str] = None
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    created_at: datetime
