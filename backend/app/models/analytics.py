"""SQLAlchemy ORM model for the behavioral event stream."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
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
