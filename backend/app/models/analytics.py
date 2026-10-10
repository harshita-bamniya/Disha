"""SQLAlchemy ORM model for the behavioral event stream."""
import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class UserEvent(Base):
    """Behavioral event stream. High-volume — partition by month in production.

    This model replaces the raw SQL string in analytics/router.py.
    """
    __tablename__ = "user_events"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id  = Column(String(64), nullable=True)
    event_name  = Column(String(100), nullable=False, index=True)
    event_data  = Column(JSONB, nullable=True, server_default="{}")
    page_url    = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_user_events_created_at", "created_at"),
    )


class UserActivityDaily(Base):
    """One row per user per (India-time) day on which they used the product.

    Written when a session is created or renewed (login, token refresh). Access tokens last 15 minutes but a
    session lasts 30 days, so a person using the app every day creates no new login row for weeks;
    login_history therefore cannot measure active users. DAU/WAU/MAU are distinct counts over this table.
    """
    __tablename__ = "user_activity_daily"

    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    activity_date = Column(Date, primary_key=True)

    __table_args__ = (
        Index("ix_user_activity_daily_date", "activity_date"),
    )
