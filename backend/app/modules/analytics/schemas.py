"""Pydantic schemas for the analytics API."""
from typing import Any, Optional

from pydantic import BaseModel


class EventPayload(BaseModel):
    event_name: str
    event_data: dict[str, Any] = {}
    page_url: Optional[str] = None
    session_id: Optional[str] = None


class BatchEventRequest(BaseModel):
    events: list[EventPayload]
