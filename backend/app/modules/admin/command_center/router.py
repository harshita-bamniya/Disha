from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.database import get_db
from app.models.user import User
from app.modules.admin.command_center import funnel as funnel_mod
from app.modules.admin.command_center.stats import resolve_range

router = APIRouter(prefix="/admin/analytics/command-center", tags=["Admin Analytics"])


@router.get("/funnel")
def get_funnel(
    side: Literal["aspirant", "employer"] = "aspirant",
    days: int = Query(30, ge=7, le=365),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD; with to_date overrides days"),
    to_date: Optional[str] = Query(None),
    compare: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("analytics", "view")),
):
    try:
        start, end = resolve_range(days, from_date, to_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="from_date / to_date must be YYYY-MM-DD.")
    return funnel_mod.build_funnel(db, side, start, end, compare)
