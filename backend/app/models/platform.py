"""SQLAlchemy ORM models for runtime platform configuration and feature flags."""
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


def _uuid():
    return uuid.uuid4()


class PlatformSetting(Base):
    """Runtime-editable platform configuration.

    Stores settings that admins can change without a deployment:
    e.g. maintenance_mode, max_applications_per_user, onboarding_total_steps.
    """
    __tablename__ = "platform_settings"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    key         = Column(String(100), unique=True, nullable=False, index=True)
    value       = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    updated_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FeatureFlag(Base):
    """Feature flags for controlled rollout of Phase 3 features.

    rollout_pct: 0-100, percentage of users who see the feature.
    target_roles: JSON array of role names; null = all roles.
    """
    __tablename__ = "feature_flags"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    flag_name    = Column(String(100), unique=True, nullable=False, index=True)
    is_enabled   = Column(Boolean, nullable=False, default=False)
    rollout_pct  = Column(Integer, nullable=False, default=0)   # 0-100
    target_roles = Column(JSONB, nullable=True)                 # ["aspirant"] or null
    description  = Column(Text, nullable=True)
    updated_by   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("rollout_pct BETWEEN 0 AND 100", name="ck_flag_rollout_pct"),
    )
