"""Admin: user status, login history, device sessions."""
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import (
    AspirantProfile,
    DeviceSession,
    LoginHistory,
    Role,
    User,
)
from app.modules.admin.schemas import (
    DeviceSessionEntry,
    LoginHistoryEntry,
    MessageResponse,
    UserManagementEntry,
)
from app.modules.admin.service import core


def list_managed_users(db: Session, search: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0) -> list[UserManagementEntry]:
    query = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .outerjoin(Role, User.role_id == Role.id)
        .filter(User.deleted_at == None)
    )
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
                AspirantProfile.full_name.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.filter(User.status == status)

    rows = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return [
        UserManagementEntry(
            user_id=str(user.id), email=user.email, phone=user.phone,
            role_name=user.role_name, full_name=profile.full_name if profile else None,
            status=user.status, is_active=user.is_active,
            failed_login_attempts=user.failed_login_attempts,
            last_login_at=user.last_login_at, registered_at=user.created_at,
        )
        for user, profile in rows
    ]


def update_user_status(user_id: str, status: str, reason: str | None, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    if status not in ("active", "suspended", "banned"):
        raise ValueError("status must be one of: active, suspended, banned")

    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")

    prev_status = user.status
    user.status = status
    user.status_reason = reason
    user.status_changed_by = uuid.UUID(actor_id)
    user.status_changed_at = datetime.now(timezone.utc)
    user.is_active = (status == "active")

    core._write_audit(db, actor_id, "user.status_changed", resource="user", resource_id=user_id,
                 previous_value={"status": prev_status}, new_value={"status": status, "reason": reason}, request=request)
    db.commit()
    return MessageResponse(message=f"User status set to '{status}'.")


def get_login_history(user_id: str, db: Session, limit: int = 50) -> list[LoginHistoryEntry]:
    rows = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        LoginHistoryEntry(
            id=str(r.id), ip_address=str(r.ip_address) if r.ip_address else None,
            user_agent=r.user_agent, device_label=r.device_label,
            success=r.success, failure_reason=r.failure_reason, created_at=r.created_at,
        )
        for r in rows
    ]


def get_device_sessions(user_id: str, db: Session) -> list[DeviceSessionEntry]:
    rows = (
        db.query(DeviceSession)
        .filter(DeviceSession.user_id == user_id, DeviceSession.revoked_at == None)
        .order_by(DeviceSession.last_seen_at.desc())
        .all()
    )
    return [
        DeviceSessionEntry(
            id=str(r.id), device_label=r.device_label,
            ip_address=str(r.ip_address) if r.ip_address else None,
            last_seen_at=r.last_seen_at, created_at=r.created_at,
        )
        for r in rows
    ]


def revoke_device_session(user_id: str, session_id: str, db: Session, actor_id: str | None = None, request: Request | None = None) -> MessageResponse:
    from app.models.user import RefreshToken

    session = (
        db.query(DeviceSession)
        .filter(DeviceSession.id == session_id, DeviceSession.user_id == user_id)
        .first()
    )
    if not session:
        raise NotFoundException("Session not found.")

    session.revoked_at = datetime.now(timezone.utc)
    token = db.query(RefreshToken).filter(RefreshToken.id == session.refresh_token_id).first()
    if token:
        token.revoked_at = datetime.now(timezone.utc)

    core._write_audit(db, actor_id or user_id, "user.session_revoked", resource="device_session",
                 resource_id=session_id, new_value={"target_user_id": user_id}, request=request)
    db.commit()
    return MessageResponse(message="Session revoked.")

