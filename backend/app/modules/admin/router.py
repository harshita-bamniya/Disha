from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.rbac import require_admin, require_permission, require_super_admin
from app.database import get_db
from app.models.user import User
from app.modules.admin import service
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
    AdminJobEntry,
    AdminStatsResponse,
    AspirantDetailResponse,
    AspirantUserEntry,
    CareerTrackAdminEntry,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    AuditLogPage,
    DeviceSessionEntry,
    EmployerVerificationDetail,
    EmployerVerificationEntry,
    LoginHistoryEntry,
    MessageResponse,
    PendingEmployerResponse,
    PermissionEntry,
    RoleEntry,
    RolePermissionsUpdateRequest,
    SubAdminCreateRequest,
    SubAdminEntry,
    SubAdminRoleUpdateRequest,
    SubscriptionPlanAdminEntry,
    SubscriptionPlanUpdateRequest,
    UserManagementEntry,
    UserStatusUpdateRequest,
    VerificationReviewRequest,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_stats(db)


# ── Employers ─────────────────────────────────────────────────────────────────

@router.get("/employers", response_model=list[PendingEmployerResponse])
def list_employers(
    status: Literal["pending", "approved", "all"] = "pending",
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_employers(db, status)


@router.post("/employers/{profile_id}/revoke", response_model=MessageResponse)
def revoke_employer(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.revoke_employer(profile_id, str(admin.id), db)


# ── Aspirant users ─────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AspirantUserEntry])
def list_users(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_aspirants(db, search)


@router.get("/users/{user_id}", response_model=AspirantDetailResponse)
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_aspirant_detail(user_id, db)


@router.post("/users/{user_id}/deactivate", response_model=MessageResponse)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.deactivate_user(user_id, db)


@router.post("/users/{user_id}/reactivate", response_model=MessageResponse)
def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.reactivate_user(user_id, db)


# ── Career track management ───────────────────────────────────────────────────

@router.get("/career-tracks", response_model=list[CareerTrackAdminEntry])
def list_career_tracks(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_career_tracks_admin(db)


@router.post("/career-tracks", response_model=CareerTrackAdminEntry, status_code=201)
def create_career_track(
    body: CareerTrackCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    try:
        return service.create_career_track(body, db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/career-tracks/{track_id}", response_model=CareerTrackAdminEntry)
def update_career_track(
    track_id: str,
    body: CareerTrackUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.update_career_track(track_id, body, db)


@router.delete("/career-tracks/{track_id}", response_model=MessageResponse)
def delete_career_track(
    track_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.delete_career_track(track_id, db)


# ── Jobs management ───────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[AdminJobEntry])
def list_jobs(
    search: Optional[str] = Query(None),
    active_only: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_admin_jobs(db, search, active_only)


@router.patch("/jobs/{job_id}/toggle", response_model=AdminJobEntry)
def toggle_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.toggle_admin_job(job_id, db)


@router.delete("/jobs/{job_id}", response_model=MessageResponse)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.delete_admin_job(job_id, db)


# ── Applications ──────────────────────────────────────────────────────────────

@router.get("/applications", response_model=list[AdminApplicationEntry])
def list_applications(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_admin_applications(db, status, search, limit, offset)


# ── Activity feed ─────────────────────────────────────────────────────────────

@router.get("/activity", response_model=list[AdminActivityItem])
def activity_feed(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_activity_feed(db, limit)


# ── RBAC: Roles & permission matrix ───────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionEntry])
def list_permissions(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_permissions(db)


@router.get("/roles", response_model=list[RoleEntry])
def list_roles(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_roles(db)


@router.patch("/roles/{role_id}/permissions", response_model=RoleEntry)
def update_role_permissions(
    role_id: str,
    body: RolePermissionsUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.update_role_permissions(role_id, body.permission_ids, str(admin.id), db)


# ── Sub-admin management (super_admin only) ───────────────────────────────────

@router.get("/sub-admins", response_model=list[SubAdminEntry])
def list_sub_admins(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_sub_admins(db)


@router.post("/sub-admins", response_model=SubAdminEntry, status_code=201)
def create_sub_admin(
    body: SubAdminCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    try:
        return service.create_sub_admin(body, str(admin.id), db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/sub-admins/{user_id}/role", response_model=SubAdminEntry)
def update_sub_admin_role(
    user_id: str,
    body: SubAdminRoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.update_sub_admin_role(user_id, body.role_id, str(admin.id), db)


@router.delete("/sub-admins/{user_id}", response_model=MessageResponse)
def delete_sub_admin(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.delete_sub_admin(user_id, str(admin.id), db)


# ── User management: status / login history / sessions ───────────────────────

@router.get("/user-management", response_model=list[UserManagementEntry])
def list_managed_users(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.list_managed_users(db, search, status)


@router.patch("/user-management/{user_id}/status", response_model=MessageResponse)
def update_user_status(
    user_id: str,
    body: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "suspend")),
):
    try:
        return service.update_user_status(user_id, body.status, body.reason, str(admin.id), db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/user-management/{user_id}/login-history", response_model=list[LoginHistoryEntry])
def get_login_history(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.get_login_history(user_id, db)


@router.get("/user-management/{user_id}/sessions", response_model=list[DeviceSessionEntry])
def get_device_sessions(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.get_device_sessions(user_id, db)


@router.post("/user-management/{user_id}/sessions/{session_id}/revoke", response_model=MessageResponse)
def revoke_device_session(
    user_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "suspend")),
):
    return service.revoke_device_session(user_id, session_id, db)


# ── Employer KYC verification ─────────────────────────────────────────────────

@router.get("/employer-verifications", response_model=list[EmployerVerificationEntry])
def list_employer_verifications(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    return service.list_employer_verifications(db, status)


@router.get("/employer-verifications/{verification_id}", response_model=EmployerVerificationDetail)
def get_employer_verification(
    verification_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    return service.get_employer_verification_detail(verification_id, db)


@router.get("/employer-verifications/{verification_id}/documents/{document_id}")
def download_verification_document(
    verification_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    path, filename = service.get_verification_document_path(verification_id, document_id, db)
    return FileResponse(path, filename=filename)


@router.post("/employer-verifications/{verification_id}/review", response_model=EmployerVerificationDetail)
def review_employer_verification(
    verification_id: str,
    body: VerificationReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    try:
        return service.review_employer_verification(
            verification_id, body.action, body.notes, body.rejection_reason, str(admin.id), db,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Audit log ──────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogPage)
def list_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("audit_logs", "view")),
):
    return service.list_audit_logs(db, user_id, action, from_date, to_date, limit, offset)


# ── Subscription plans ────────────────────────────────────────────────────────

@router.get("/subscription-plans", response_model=list[SubscriptionPlanAdminEntry])
def list_subscription_plans(
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("subscriptions", "view")),
):
    return service.list_subscription_plans(db)


@router.patch("/subscription-plans/{plan_id}", response_model=SubscriptionPlanAdminEntry)
def update_subscription_plan(
    plan_id: str,
    body: SubscriptionPlanUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("subscriptions", "manage")),
):
    return service.update_subscription_plan(plan_id, body, str(admin.id), db)
