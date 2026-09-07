"""Analytics module — Module 11.

Routes:
  POST /api/analytics/events             → batch event ingestion (all authenticated users)
  GET  /api/analytics/admin/overview     → platform KPIs (admin only)
  GET  /api/analytics/admin/funnel       → onboarding + KRS funnel (admin only)
  GET  /api/analytics/admin/safety-flags → safety flag review queue (admin only)
  PATCH /api/analytics/admin/safety-flags/{id}/review → mark flag reviewed (admin only)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_permission
from app.database import get_db
from app.models.user import User
from app.modules.analytics import service
from app.modules.analytics.schemas import BatchEventRequest

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_admin = require_permission("analytics", "view")


# ── Event ingestion ───────────────────────────────────────────────────────────

@router.post("/events", status_code=202)
async def ingest_events(
    body: BatchEventRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Batch event ingestion (fire-and-forget, always returns 202)."""
    accepted = service.ingest_events(body.events, user.id if user else None, db)
    return {"accepted": accepted}


# ── Admin: platform overview ──────────────────────────────────────────────────

@router.get("/admin/overview")
def admin_overview(
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Platform KPIs for admin dashboard."""
    return service.get_admin_overview(db)


@router.get("/admin/funnel")
def admin_funnel(
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Onboarding + engagement funnel for cohort analysis."""
    return service.get_admin_funnel(db)


@router.get("/admin/safety-flags")
def list_safety_flags(
    severity: Optional[str] = Query(None),
    reviewed: Optional[bool] = Query(None, description="Filter by review status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """List safety flags for admin review."""
    return service.list_safety_flags(severity, reviewed, limit, offset, db)


@router.get("/admin/trends")
def admin_trends(
    metric: str = Query("users", pattern="^(users|employers|jobs|applications)$"),
    days: int = Query(30, ge=7, le=180),
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Daily time series for growth charts — Module 05 admin analytics dashboard."""
    return service.get_admin_trends(metric, days, db)


@router.get("/admin/job-engagement")
def admin_job_engagement(
    days: int = Query(30, ge=1, le=180),
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Aggregate job-level engagement events for the admin dashboard.

    Returns counts of job_card_click, application_started, application_submitted
    grouped by job_id for the specified window.
    """
    return service.get_admin_job_engagement(days, db)


@router.patch("/admin/safety-flags/{flag_id}/review", status_code=200)
def review_safety_flag(
    flag_id: str,
    current_user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """Mark a safety flag as reviewed by the current admin."""
    try:
        return service.review_safety_flag(flag_id, current_user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
