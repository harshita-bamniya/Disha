"""Admin: roles/permissions and sub-admin management."""
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.user import (
    Permission,
    Role,
    RolePermission,
    User,
)
from app.modules.admin.schemas import (
    PLATFORM_ROLE_NAMES,
    MessageResponse,
    PermissionEntry,
    RoleEntry,
    SubAdminCreateRequest,
    SubAdminEntry,
)
from app.modules.admin.service import core


def list_permissions(db: Session) -> list[PermissionEntry]:
    perms = db.query(Permission).order_by(Permission.resource, Permission.action).all()
    return [
        PermissionEntry(id=str(p.id), resource=p.resource, action=p.action, description=p.description)
        for p in perms
    ]


def list_roles(db: Session) -> list[RoleEntry]:
    roles = db.query(Role).order_by(Role.name).all()

    user_counts = dict(
        db.query(User.role_id, func.count(User.id))
        .filter(User.deleted_at == None)
        .group_by(User.role_id)
        .all()
    )

    perms_by_role_id: dict = {}
    for role_id, resource, action in (
        db.query(RolePermission.role_id, Permission.resource, Permission.action)
        .join(Permission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id.in_([role.id for role in roles]))
        .all()
    ):
        perms_by_role_id.setdefault(role_id, []).append(f"{resource}:{action}")

    result = []
    for role in roles:
        result.append(RoleEntry(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=perms_by_role_id.get(role.id, []),
            user_count=user_counts.get(role.id, 0),
        ))
    return result


def create_role(data: "RoleCreateRequest", actor_id: str, db: Session, request: Request | None = None) -> RoleEntry:

    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise ValueError(f"A role named '{data.name}' already exists.")

    # Resolve permission IDs — start from clone source if requested
    permission_ids = list(data.permission_ids)
    if data.clone_from_id and not permission_ids:
        source_perms = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == data.clone_from_id)
            .all()
        )
        permission_ids = [str(p.id) for p in source_perms]

    # Privilege escalation guard: actor cannot grant permissions they don't hold.
    if permission_ids:
        actor = db.query(User).filter(User.id == uuid.UUID(actor_id)).first()
        if actor and actor.role_id:
            actor_perm_ids = {
                str(rp.permission_id)
                for rp in db.query(RolePermission).filter(RolePermission.role_id == actor.role_id).all()
            }
            forbidden = [pid for pid in permission_ids if pid not in actor_perm_ids]
            if forbidden:
                raise ForbiddenException(
                    "Cannot grant permissions that you do not hold yourself."
                )

    new_role = Role(name=data.name, description=data.description, is_system=False)
    db.add(new_role)
    db.flush()

    for pid in permission_ids:
        db.add(RolePermission(role_id=new_role.id, permission_id=uuid.UUID(pid)))

    core._write_audit(db, actor_id, "role.created", resource="role", resource_id=str(new_role.id),
                 new_value={"name": data.name, "permission_count": len(permission_ids)}, request=request)
    db.commit()
    db.refresh(new_role)

    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == new_role.id)
        .all()
    )
    return RoleEntry(
        id=str(new_role.id), name=new_role.name, description=new_role.description,
        is_system=False, permissions=[f"{p.resource}:{p.action}" for p in perms], user_count=0,
    )


def delete_role(role_id: str, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found.")
    if role.is_system:
        raise ForbiddenException("System roles cannot be deleted.")

    user_count = db.query(User).filter(User.role_id == role.id, User.deleted_at == None).count()
    if user_count > 0:
        raise ValueError(f"Cannot delete role '{role.name}' — {user_count} user(s) are assigned to it. Reassign them first.")

    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    core._write_audit(db, actor_id, "role.deleted", resource="role", resource_id=role_id,
                 previous_value={"name": role.name}, request=request)
    db.delete(role)
    db.commit()
    return MessageResponse(message=f"Role '{role.name}' deleted.")


def update_role_permissions(role_id: str, permission_ids: list[str], actor_id: str, db: Session, request: Request | None = None) -> RoleEntry:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found.")

    old_perms = [
        f"{p.resource}:{p.action}" for p in
        db.query(Permission).join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id).all()
    ]

    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    for pid in permission_ids:
        db.add(RolePermission(role_id=role.id, permission_id=uuid.UUID(pid)))

    core._write_audit(db, actor_id, "role.permissions_updated", resource="role", resource_id=role_id,
                 previous_value={"permissions": old_perms}, new_value={"permission_ids": permission_ids}, request=request)
    db.commit()

    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role.id)
        .all()
    )
    return RoleEntry(
        id=str(role.id), name=role.name, description=role.description,
        is_system=role.is_system, permissions=[f"{p.resource}:{p.action}" for p in perms],
    )


def _platform_role_or_404(role_id: str, db: Session) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role or role.name not in PLATFORM_ROLE_NAMES:
        raise NotFoundException("Platform role not found.")
    return role


def list_sub_admins(db: Session) -> list[SubAdminEntry]:
    rows = (
        db.query(User, Role)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name.in_(PLATFORM_ROLE_NAMES), User.deleted_at == None)
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        SubAdminEntry(
            user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
            role_id=str(role.id), role_name=role.name,
            status=user.status, is_active=user.is_active,
            last_login_at=user.last_login_at, created_at=user.created_at,
        )
        for user, role in rows
    ]


def create_sub_admin(data: SubAdminCreateRequest, actor_id: str, db: Session, request: Request | None = None) -> SubAdminEntry:
    role = _platform_role_or_404(data.role_id, db)
    if role.name == "super_admin":
        raise ForbiddenException("super_admin cannot be assigned via this endpoint.")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ValueError(f"A user with email '{data.email}' already exists.")

    user = User(
        email=data.email,
        phone=data.phone,
        full_name=data.full_name,
        role_id=role.id,
        email_verified=True,   # admin-created accounts skip OTP verification
        is_active=True,
    )
    db.add(user)
    db.flush()

    core._write_audit(db, actor_id, "sub_admin.created", resource="user", resource_id=str(user.id),
                 new_value={"email": data.email, "role": role.name}, request=request)
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def update_sub_admin_role(user_id: str, role_id: str, actor_id: str, db: Session, request: Request | None = None) -> SubAdminEntry:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    old_role_name = user.role_name
    role = _platform_role_or_404(role_id, db)

    user.role_id = role.id
    core._write_audit(db, actor_id, "sub_admin.role_changed", resource="user", resource_id=user_id,
                 previous_value={"role": old_role_name}, new_value={"role": role.name}, request=request)
    db.commit()
    db.refresh(user)

    return SubAdminEntry(
        user_id=str(user.id), email=user.email, phone=user.phone, full_name=user.full_name,
        role_id=str(role.id), role_name=role.name,
        status=user.status, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


def delete_sub_admin(user_id: str, actor_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise NotFoundException("User not found.")
    if user.role_name not in PLATFORM_ROLE_NAMES:
        raise NotFoundException("User is not a platform sub-admin.")

    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    core._write_audit(db, actor_id, "sub_admin.removed", resource="user", resource_id=user_id,
                 previous_value={"role": user.role_name}, request=request)
    db.commit()
    return MessageResponse(message="Sub-admin removed.")

