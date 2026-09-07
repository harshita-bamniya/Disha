"""SQLAlchemy ORM models for 'Your Companion' — the emotional support feature.

Conversations and messages for the companion are stored in the existing
`conversations` / `messages` tables (context_type='emotional'), and long-term
facts reuse `counsellor_memory`. This module only adds the two pieces of data
unique to the companion experience: daily mood check-ins and milestones.
"""
import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class CompanionMoodEntry(Base):
    """A daily mood check-in — the basis for the journey timeline and weekly insights."""
    __tablename__ = "companion_mood_entries"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mood       = Column(String(20), nullable=False)   # great|good|okay|low|struggling
    note       = Column(Text, nullable=True)           # the reflection / journal entry
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

    __table_args__ = (
        CheckConstraint(
            "mood IN ('great','good','okay','low','struggling')",
            name="ck_companion_mood_value",
        ),
    )


class CompanionMilestone(Base):
    """A personal win or turning point in the user's journey — shown on the timeline."""
    __tablename__ = "companion_milestones"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    source      = Column(String(20), default="user", nullable=False)  # user|ai
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

    __table_args__ = (
        CheckConstraint("source IN ('user','ai')", name="ck_companion_milestone_source"),
    )
