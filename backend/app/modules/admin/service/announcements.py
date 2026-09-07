"""Admin: platform announcements."""
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    Role,
    User,
)
from app.modules.admin.schemas import (
    PLATFORM_ROLE_NAMES,
    AnnouncementCreateRequest,
    AnnouncementEntry,
    AnnouncementUpdateRequest,
)
from app.modules.admin.service import core


def _ann_status(ann) -> str:
    if ann.published_at:
        return "published"
    if ann.scheduled_at:
        return "scheduled"
    return "draft"


def _ann_to_entry(ann, creator_name: str | None = None) -> AnnouncementEntry:
    return AnnouncementEntry(
        id=str(ann.id),
        title=ann.title,
        body=ann.body,
        type=ann.type,
        target=ann.target,
        channel=ann.channel,
        status=_ann_status(ann),
        scheduled_at=ann.scheduled_at,
        published_at=ann.published_at,
        sent_count=ann.sent_count,
        created_by_name=creator_name,
        created_at=ann.created_at,
        updated_at=ann.updated_at,
    )


def list_announcements(db: Session, status: str | None = None) -> list[AnnouncementEntry]:
    from app.models.notifications import AdminAnnouncement
    now = datetime.now(timezone.utc)

    q = db.query(AdminAnnouncement, User).outerjoin(User, User.id == AdminAnnouncement.created_by)
    if status == "published":
        q = q.filter(AdminAnnouncement.published_at != None)
    elif status == "scheduled":
        q = q.filter(AdminAnnouncement.published_at == None, AdminAnnouncement.scheduled_at != None)
    elif status == "draft":
        q = q.filter(AdminAnnouncement.published_at == None, AdminAnnouncement.scheduled_at == None)

    rows = q.order_by(AdminAnnouncement.created_at.desc()).all()
    result = []
    for ann, creator in rows:
        name = None
        if creator:
            profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == creator.id).first()
            name = profile.full_name if profile else creator.phone
        result.append(_ann_to_entry(ann, name))
    return result


def create_announcement(data: AnnouncementCreateRequest, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.notifications import AdminAnnouncement
    ann = AdminAnnouncement(
        title=data.title,
        body=data.body,
        type=data.type,
        target=data.target,
        channel=data.channel,
        scheduled_at=data.scheduled_at,
        created_by=uuid.UUID(actor_id),
    )
    db.add(ann)
    db.flush()
    core._write_audit(db, actor_id, "announcement_create", "announcement", str(ann.id), request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)


def update_announcement(ann_id: str, data: AnnouncementUpdateRequest, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.notifications import AdminAnnouncement
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    if ann.published_at:
        raise ForbiddenException("Published announcements cannot be edited")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(ann, field, value)
    core._write_audit(db, actor_id, "announcement_update", "announcement", ann_id, request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)


def _resolve_announcement_targets(db: Session, ann) -> list[User]:
    """Return the list of active, non-deleted users this announcement targets."""
    target_roles = getattr(ann, "target_roles", None)
    needs_role_join = bool(target_roles) or ann.target == "admins"

    query = db.query(User).filter(User.is_active == True, User.deleted_at == None)

    if ann.target == "employers":
        query = query.join(EmployerProfile, EmployerProfile.user_id == User.id)
    elif ann.target in ("aspirants", "candidates"):
        query = query.join(AspirantProfile, AspirantProfile.user_id == User.id)

    if needs_role_join:
        query = query.join(Role, User.role_id == Role.id)
        if ann.target == "admins":
            query = query.filter(Role.name.in_(PLATFORM_ROLE_NAMES))
        if target_roles:
            query = query.filter(Role.name.in_(target_roles))

    return query.all()


def publish_announcement(ann_id: str, actor_id: str, db: Session, request: Request | None = None) -> AnnouncementEntry:
    from app.models.notifications import AdminAnnouncement, Notification
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    if ann.published_at:
        raise ForbiddenException("Already published")

    now = datetime.now(timezone.utc)
    ann.published_at = now

    target_users = _resolve_announcement_targets(db, ann)

    for user in target_users:
        db.add(Notification(
            user_id=user.id,
            type="announcement",
            title=ann.title,
            body=ann.body,
            delivery_status="pending",
        ))

    ann.sent_count = len(target_users)

    if ann.channel in ("email", "both"):
        from app.tasks.announcements import send_announcement_emails
        send_announcement_emails.delay(str(ann.id), [str(u.id) for u in target_users])

    core._write_audit(db, actor_id, "announcement_publish", "announcement", ann_id, new_value={"sent_count": len(target_users)}, request=request)
    db.commit()
    db.refresh(ann)
    return _ann_to_entry(ann)


def delete_announcement(ann_id: str, actor_id: str, db: Session, request: Request | None = None) -> None:
    from app.models.notifications import AdminAnnouncement
    ann = db.query(AdminAnnouncement).filter(AdminAnnouncement.id == uuid.UUID(ann_id)).first()
    if not ann:
        raise NotFoundException("Announcement not found")
    core._write_audit(db, actor_id, "announcement_delete", "announcement", ann_id, request=request)
    db.delete(ann)
    db.commit()

