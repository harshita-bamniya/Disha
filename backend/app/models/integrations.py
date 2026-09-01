"""SQLAlchemy ORM models for third-party OAuth integrations."""
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class GoogleCalendarToken(Base):
    """Stores Google Calendar OAuth2 tokens per employer user.
    One row per user — upserted on each auth callback.
    Tokens are encrypted at rest in production via DB-level encryption;
    for local dev they are stored as plain JSON.
    """
    __tablename__ = "google_calendar_tokens"

    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token         = Column(Text, nullable=False)          # JSON: access_token, refresh_token, expiry
    calendar_id   = Column(String(255), nullable=True, default="primary")
    connected_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user          = relationship("User")
