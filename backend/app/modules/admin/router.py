from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.rbac import require_admin, require_permission, require_super_admin
from app.database import get_db
from app.models.user import User
from app.modules.admin import service
from app.modules.interview import calibration_service
from app.modules.interview.schemas import (
    CalibrationStatsOut,
    OutcomeCorrelationOut,
    ReviewableSessionOut,
    SubmitHumanReviewRequest,
)
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminApplicationEntry,
    AdminJobEntry,
    AdminJobDetailResponse,
    EmployerJobsResponse,
    AdminStatsResponse,
    AnalyticsResponse,
    AnnouncementCreateRequest,
    AnnouncementEntry,
    AnnouncementUpdateRequest,
    AspirantDetailResponse,
    AspirantUserEntry,
    BillingOverviewResponse,
    CareerTrackAdminEntry,
    EmployerDetailResponse,
    GlobalSearchResponse,
    CareerTrackCreateRequest,
    CareerTrackUpdateRequest,
    AuditLogPage,
    DeviceSessionEntry,
    EmployerVerificationDetail,
    EmployerVerificationEntry,
    LoginHistoryEntry,
    MessageResponse,
    NotificationListResponse,
    NotificationStatsResponse,
    PendingEmployerResponse,
    PermissionEntry,
    RoleCreateRequest,
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
    AddMessageRequest,
    CreateTicketRequest,
    TicketDetailResponse,
    TicketEntry,
    TicketListResponse,
    TicketMessageEntry,
    UpdateTicketRequest,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_stats(db)


@router.get("/search", response_model=GlobalSearchResponse)
def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Cross-entity search (users, employers, jobs, applications) — previously
    each admin section had its own isolated search with no way to find an
    entity without knowing which tab it lived in."""
    return service.global_search(db, q)


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    days: int = Query(30, ge=7, le=365),
    from_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD; overrides 'days'"),
    to_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD; overrides 'days'"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("analytics", "view")),
):
    from datetime import timezone as _tz
    if from_date and to_date:
        try:
            from_dt = datetime.fromisoformat(from_date).replace(tzinfo=_tz.utc)
            to_dt = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59, tzinfo=_tz.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail="from_date / to_date must be YYYY-MM-DD.")
    else:
        to_dt = datetime.now(_tz.utc)
        from_dt = to_dt - timedelta(days=days - 1)
        from_dt = from_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return service.get_analytics(db, from_dt, to_dt)


# ── Employers ─────────────────────────────────────────────────────────────────

@router.get("/employers", response_model=list[PendingEmployerResponse])
def list_employers(
    status: Literal["pending", "approved", "all"] = "pending",
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_employers(db, status, limit=limit, offset=offset)


@router.get("/employers/{profile_id}", response_model=EmployerDetailResponse)
def get_employer_detail(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_employer_detail(profile_id, db)


@router.get("/employers/{profile_id}/support", response_model=TicketListResponse)
def get_employer_support_tickets(
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "view")),
):
    return service.list_employer_support_tickets(profile_id, db)


@router.get("/employers/{profile_id}/jobs", response_model=EmployerJobsResponse)
def list_employer_jobs(
    profile_id: str,
    search: Optional[str] = Query(None),
    active_only: bool = False,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_employer_jobs_admin(profile_id, db, search, active_only, limit, offset)


@router.get("/users/{user_id}/applications", response_model=list[AdminApplicationEntry])
def list_candidate_applications(
    user_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_candidate_applications(user_id, db, status, limit, offset)


@router.post("/employers/{profile_id}/revoke", response_model=MessageResponse)
@limiter.limit("10/minute")
def revoke_employer(
    request: Request,
    profile_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    return service.revoke_employer(profile_id, str(admin.id), db, request=request)


# ── Aspirant users ─────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AspirantUserEntry])
def list_users(
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_aspirants(db, search, limit=limit, offset=offset)


@router.get("/users/{user_id}", response_model=AspirantDetailResponse)
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_aspirant_detail(user_id, db)


@router.get("/candidates/{user_id}/support", response_model=TicketListResponse)
def get_candidate_support_tickets(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.list_candidate_support_tickets(user_id, db)


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
    admin: User = Depends(require_permission("career_tracks", "view")),
):
    return service.list_career_tracks_admin(db)


@router.post("/career-tracks", response_model=CareerTrackAdminEntry, status_code=201)
def create_career_track(
    body: CareerTrackCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("career_tracks", "write")),
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
    admin: User = Depends(require_permission("career_tracks", "write")),
):
    return service.update_career_track(track_id, body, db)


@router.delete("/career-tracks/{track_id}", response_model=MessageResponse)
@limiter.limit("10/minute")
def delete_career_track(
    request: Request,
    track_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("career_tracks", "delete")),
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


@router.get("/jobs/{job_id}", response_model=AdminJobDetailResponse)
def get_job_detail(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_admin_job_detail(job_id, db)


@router.get("/jobs/{job_id}/applications", response_model=list[AdminApplicationEntry])
def list_job_applications(
    job_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_job_applications(job_id, db, status, limit, offset)


@router.patch("/jobs/{job_id}/toggle", response_model=AdminJobEntry)
def toggle_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.toggle_admin_job(job_id, db)


@router.delete("/jobs/{job_id}", response_model=MessageResponse)
@limiter.limit("10/minute")
def delete_job(
    request: Request,
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


@router.post("/roles", response_model=RoleEntry, status_code=201)
def create_role(
    request: Request,
    body: RoleCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    try:
        return service.create_role(body, str(admin.id), db, request=request)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/roles/{role_id}", response_model=MessageResponse)
@limiter.limit("10/minute")
def delete_role(
    request: Request,
    role_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    try:
        return service.delete_role(role_id, str(admin.id), db, request=request)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/roles/{role_id}/permissions", response_model=RoleEntry)
def update_role_permissions(
    request: Request,
    role_id: str,
    body: RolePermissionsUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.update_role_permissions(role_id, body.permission_ids, str(admin.id), db, request=request)


# ── Sub-admin management (super_admin only) ───────────────────────────────────

@router.get("/sub-admins", response_model=list[SubAdminEntry])
def list_sub_admins(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_sub_admins(db)


@router.post("/sub-admins", response_model=SubAdminEntry, status_code=201)
def create_sub_admin(
    request: Request,
    body: SubAdminCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    try:
        return service.create_sub_admin(body, str(admin.id), db, request=request)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/sub-admins/{user_id}/role", response_model=SubAdminEntry)
def update_sub_admin_role(
    request: Request,
    user_id: str,
    body: SubAdminRoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.update_sub_admin_role(user_id, body.role_id, str(admin.id), db, request=request)


@router.delete("/sub-admins/{user_id}", response_model=MessageResponse)
@limiter.limit("10/minute")
def delete_sub_admin(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.delete_sub_admin(user_id, str(admin.id), db, request=request)


# ── User management: status / login history / sessions ───────────────────────

@router.get("/user-management", response_model=list[UserManagementEntry])
def list_managed_users(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.list_managed_users(db, search, status, limit=limit, offset=offset)


@router.patch("/user-management/{user_id}/status", response_model=MessageResponse)
def update_user_status(
    request: Request,
    user_id: str,
    body: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "suspend")),
):
    try:
        return service.update_user_status(user_id, body.status, body.reason, str(admin.id), db, request=request)
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
    request: Request,
    user_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "suspend")),
):
    return service.revoke_device_session(user_id, session_id, db, actor_id=str(admin.id), request=request)


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
    request: Request,
    verification_id: str,
    body: VerificationReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("companies", "verify")),
):
    try:
        return service.review_employer_verification(
            verification_id, body.action, body.notes, body.rejection_reason, str(admin.id), db, request=request,
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

@router.get("/billing/overview", response_model=BillingOverviewResponse)
def billing_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("subscriptions", "view")),
):
    """Platform-wide MRR, plan distribution, and subscription growth — there was
    previously no way for an operator to see this without querying the DB directly."""
    return service.get_billing_overview(db)


@router.get("/subscription-plans", response_model=list[SubscriptionPlanAdminEntry])
def list_subscription_plans(
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("subscriptions", "view")),
):
    return service.list_subscription_plans(db)


@router.patch("/subscription-plans/{plan_id}", response_model=SubscriptionPlanAdminEntry)
def update_subscription_plan(
    request: Request,
    plan_id: str,
    body: SubscriptionPlanUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("subscriptions", "manage")),
):
    return service.update_subscription_plan(plan_id, body, str(admin.id), db, request=request)


# ── Announcements ─────────────────────────────────────────────────────────────

@router.get("/announcements", response_model=list[AnnouncementEntry])
def list_announcements(
    status: Optional[Literal["draft", "scheduled", "published"]] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_announcements(db, status)


@router.post("/announcements", response_model=AnnouncementEntry, status_code=201)
def create_announcement(
    request: Request,
    body: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.create_announcement(body, str(admin.id), db, request=request)


@router.patch("/announcements/{ann_id}", response_model=AnnouncementEntry)
def update_announcement(
    request: Request,
    ann_id: str,
    body: AnnouncementUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.update_announcement(ann_id, body, str(admin.id), db, request=request)


@router.post("/announcements/{ann_id}/publish", response_model=AnnouncementEntry)
def publish_announcement(
    request: Request,
    ann_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    return service.publish_announcement(ann_id, str(admin.id), db, request=request)


@router.delete("/announcements/{ann_id}", response_model=MessageResponse)
@limiter.limit("30/minute")
def delete_announcement(
    request: Request,
    ann_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    service.delete_announcement(ann_id, str(admin.id), db, request=request)
    return MessageResponse(message="Announcement deleted")


# ── Notification management ───────────────────────────────────────────────────

@router.get("/notifications/stats", response_model=NotificationStatsResponse)
def get_notifications_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_notifications_stats(db)


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    user_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
    delivery_status: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_notifications(db, user_id=user_id, type_filter=type,
                                      delivery_status=delivery_status, is_read=is_read,
                                      skip=skip, limit=limit)


@router.delete("/notifications/{notification_id}", response_model=MessageResponse)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.delete_notification(notification_id, db)


@router.get("/users/{user_id}/notifications", response_model=NotificationListResponse)
def get_user_notifications(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users", "view")),
):
    return service.get_user_notifications(user_id, db, skip=skip, limit=limit)


# ── Support tickets ───────────────────────────────────────────────────────────

@router.get("/support/tickets", response_model=TicketListResponse)
def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.list_tickets(db, status=status, priority=priority,
                                entity_type=entity_type, category=category,
                                search=search, skip=skip, limit=limit)


@router.post("/support/tickets", response_model=TicketEntry)
def create_ticket(
    request: Request,
    req: CreateTicketRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.create_ticket(req, str(admin.id), db, request=request)


@router.get("/support/tickets/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.get_ticket(ticket_id, db)


@router.patch("/support/tickets/{ticket_id}", response_model=TicketEntry)
def update_ticket(
    request: Request,
    ticket_id: str,
    req: UpdateTicketRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.update_ticket(ticket_id, req, str(admin.id), db, request=request)


@router.post("/support/tickets/{ticket_id}/messages", response_model=TicketMessageEntry)
def add_ticket_message(
    ticket_id: str,
    req: AddMessageRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return service.add_ticket_message(ticket_id, req, str(admin.id), db)


# ═══════════════════════════════════════════════════════════════════════════
# AI Interviewer — human-calibration dashboard & predictive-validity view
# (Phase 7 moonshots: does the AI's score agree with a human, and does a
# higher readiness tier actually track with a better real-world outcome?)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/interview-calibration/sample", response_model=list[ReviewableSessionOut])
def sample_interview_sessions_for_review(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return calibration_service.sample_sessions_for_review(limit, db)


@router.post("/interview-calibration/{session_id}/review", response_model=MessageResponse)
def submit_interview_human_review(
    session_id: str,
    req: SubmitHumanReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    try:
        return calibration_service.submit_human_review(
            session_id, admin, req.human_readiness_score, req.human_recommendation, req.notes, db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/interview-calibration/stats", response_model=CalibrationStatsOut)
def get_interview_calibration_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return calibration_service.get_calibration_stats(db)


@router.get("/interview-calibration/outcome-correlation", response_model=OutcomeCorrelationOut)
def get_interview_outcome_correlation(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return calibration_service.get_outcome_correlation(db)
