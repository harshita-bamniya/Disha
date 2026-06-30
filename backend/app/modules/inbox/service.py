"""In-app notification inbox + recruiter task list for employer-side users."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.mvp3 import Application, EmployerTask, Notification
from app.models.user import EmployerProfile, JobPosting, User
from app.modules.inbox.schemas import (
    NotificationListResponse, NotificationOut, TaskOut,
)


def create_notification(db: Session, user_id, type: str, title: str, body: str | None = None, link_url: str | None = None) -> None:
    """Called from other modules (e.g. matching.service on new application)
    to populate a user's in-app inbox. Caller owns the commit."""
    db.add(Notification(user_id=user_id, type=type, title=title, body=body, link_url=link_url))


def notify_company_team(db: Session, employer: EmployerProfile, type: str, title: str, body: str | None, link_url: str | None) -> None:
    """Notifies every teammate sharing this employer's company — same
    company-wide visibility pattern used for applications/jobs/talent pool."""
    if employer.company_id:
        team = db.query(EmployerProfile.user_id).filter(EmployerProfile.company_id == employer.company_id).all()
        user_ids = [t[0] for t in team]
    else:
        user_ids = [employer.user_id]
    for uid in user_ids:
        create_notification(db, uid, type, title, body, link_url)


def list_notifications(user: User, db: Session, limit: int = 30) -> NotificationListResponse:
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    unread_count = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).count()
    return NotificationListResponse(
        unread_count=unread_count,
        notifications=[
            NotificationOut(
                id=str(n.id), type=n.type, title=n.title, body=n.body,
                link_url=n.link_url, is_read=n.is_read, created_at=n.created_at,
            )
            for n in rows
        ],
    )


def mark_notification_read(notification_id: str, user: User, db: Session) -> dict:
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not row:
        raise NotFoundException("Notification not found.")
    row.is_read = True
    db.commit()
    return {"id": notification_id, "is_read": True}


def mark_all_read(user: User, db: Session) -> dict:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()
    return {"updated": updated}


def _task_to_out(row: EmployerTask, db: Session) -> TaskOut:
    candidate_name = None
    job_title = None
    if row.application_id:
        app = db.query(Application).filter(Application.id == row.application_id).first()
        if app:
            from app.models.user import AspirantProfile
            profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == app.aspirant_id).first()
            candidate_name = profile.full_name if profile else None
            job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
            job_title = job.title if job else None
    return TaskOut(
        id=str(row.id), title=row.title, due_at=row.due_at, is_done=row.is_done,
        application_id=str(row.application_id) if row.application_id else None,
        candidate_name=candidate_name, job_title=job_title, created_at=row.created_at,
    )


def list_tasks(user: User, db: Session, include_done: bool = False) -> list[TaskOut]:
    q = db.query(EmployerTask).filter(EmployerTask.assigned_to == user.id)
    if not include_done:
        q = q.filter(EmployerTask.is_done == False)
    rows = q.order_by(EmployerTask.due_at.asc().nullslast(), EmployerTask.created_at.desc()).all()
    return [_task_to_out(r, db) for r in rows]


def create_task(title: str, due_at, application_id: str | None, user: User, db: Session) -> TaskOut:
    row = EmployerTask(assigned_to=user.id, created_by=user.id, title=title, due_at=due_at, application_id=application_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _task_to_out(row, db)


def update_task(task_id: str, title: str | None, due_at, is_done: bool | None, user: User, db: Session) -> TaskOut:
    row = db.query(EmployerTask).filter(EmployerTask.id == task_id, EmployerTask.assigned_to == user.id).first()
    if not row:
        raise NotFoundException("Task not found.")
    if title is not None:
        row.title = title
    if due_at is not None:
        row.due_at = due_at
    if is_done is not None:
        row.is_done = is_done
    db.commit()
    db.refresh(row)
    return _task_to_out(row, db)


def delete_task(task_id: str, user: User, db: Session) -> dict:
    row = db.query(EmployerTask).filter(EmployerTask.id == task_id, EmployerTask.assigned_to == user.id).first()
    if not row:
        raise NotFoundException("Task not found.")
    db.delete(row)
    db.commit()
    return {"id": task_id, "deleted": True}
