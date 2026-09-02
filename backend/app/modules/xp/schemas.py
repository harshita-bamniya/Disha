"""Pydantic schemas for the XP API."""
from pydantic import BaseModel


class XPSummaryOut(BaseModel):
    xp_total: int
    xp_this_week: int
    level: int
    next_level_at: int
    xp_to_next: int


class XPTransactionOut(BaseModel):
    id: str
    xp_delta: int
    event_type: str
    note: str | None
    created_at: str | None
