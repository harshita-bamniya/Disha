from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.core.rbac import get_current_aspirant, require_employer
from app.database import get_db
from app.models.user import User
from app.modules.inbox import service
from app.modules.inbox.schemas import (
    NotificationListResponse, TaskCreateRequest, TaskOut, TaskUpdateRequest,
)

router = APIRouter(prefix="/employer", tags=["Employer Inbox"])

_employer = require_employer

# Aspirant notifications reuse the exact same Notification table/service
# functions (list/mark-read/mark-all-read are already user-generic) — only
# the route prefix and auth dependency differ from the employer inbox above.
aspirant_router = APIRouter(prefix="/notifications", tags=["Aspirant Notifications"])


@aspirant_router.get("", response_model=NotificationListResponse)
def list_my_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_notifications(current_user, db, limit)


@aspirant_router.patch("/{notification_id}/read")
def mark_my_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.mark_notification_read(notification_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@aspirant_router.post("/read-all")
def mark_all_my_notifications_read(
    current_user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.mark_all_read(current_user, db)


# ── Notifications ──────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.list_notifications(current_user, db, limit)


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.mark_notification_read(notification_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/notifications/read-all")
def mark_all_read(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.mark_all_read(current_user, db)


# ── Tasks ────────────────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    include_done: bool = Query(False),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.list_tasks(current_user, db, include_done)


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreateRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.create_task(body.title, body.due_at, body.application_id, current_user, db)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    body: TaskUpdateRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.update_task(task_id, body.title, body.due_at, body.is_done, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.delete_task(task_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
