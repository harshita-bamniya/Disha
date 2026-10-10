from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import User
from app.modules.admin.dashboard import marketplace, service

router = APIRouter(prefix="/admin/dashboard", tags=["Admin Dashboard"])
_staff = require_role(*service.DASHBOARD_ROLES)


@router.get("/attention")
def attention(db: Session = Depends(get_db), user: User = Depends(_staff)):
    """Zone A: queues waiting on a person. Only the rows this role acts on are returned or computed."""
    return service.attention(db, user)


@router.get("/overview")
def overview(
    days: int = Query(30, ge=7, le=365), compare: bool = Query(False),
    db: Session = Depends(get_db), user: User = Depends(_staff),
):
    """Zone B: marketplace health for a date range, optionally against the range before it (super admin and admin)."""
    if user.role_name not in ("super_admin", "admin"):
        raise ForbiddenException("Marketplace health is for super admin and admin.")
    return marketplace.overview(db, days, compare)
