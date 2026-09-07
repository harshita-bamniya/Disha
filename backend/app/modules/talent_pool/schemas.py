from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SaveCandidateRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=1000)


class SavedCandidateOut(BaseModel):
    aspirant_id: str
    full_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    highest_qualification: Optional[str] = None
    last_designation: Optional[str] = None
    skills: list[str] = []
    composite: Optional[int] = None
    note: Optional[str] = None
    saved_by_name: Optional[str] = None
    saved_at: datetime
