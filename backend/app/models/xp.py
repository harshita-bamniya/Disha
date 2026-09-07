"""XP System ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserXP(Base):
    __tablename__ = "user_xp"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    xp_total   = Column(Integer, nullable=False, default=0)
    xp_this_week = Column(Integer, nullable=False, default=0)
    level      = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class XPTransaction(Base):
    __tablename__ = "xp_transactions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    xp_delta   = Column(Integer, nullable=False)
    event_type = Column(String(50), nullable=False)
    ref_id     = Column(String(255), nullable=True)
    note       = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('lesson_complete','exercise_score_80','stage_complete','ticket_approved',"
            "'interview_complete','job_offer','narrative_score_80','daily_mission')",
            name="ck_xp_event_type",
        ),
    )


# XP award amounts — single source of truth
XP_AWARDS = {
    "lesson_complete":    10,
    "exercise_score_80":  50,
    "stage_complete":    500,
    "ticket_approved":   100,
    "interview_complete": 75,
    "job_offer":        2000,
    "narrative_score_80": 80,
    "daily_mission":      30,
}

# Level thresholds: level = 1 + floor(total / 500), capped at 10
def compute_level(xp_total: int) -> int:
    return min(10, 1 + xp_total // 500)
