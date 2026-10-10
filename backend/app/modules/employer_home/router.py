from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.rbac import require_employer
from app.database import get_db
from app.models.user import User
from app.modules.employer_home import service

router = APIRouter(prefix="/employer/home", tags=["Employer Dashboard"])


@router.get("/attention")
def attention(db: Session = Depends(get_db), user: User = Depends(require_employer)):
    """What needs the hiring team now, scoped to the viewer's company or department."""
    return service.attention(db, user)


@router.get("/overview")
def overview(
    days: int = Query(30, ge=7, le=365), compare: bool = Query(False),
    db: Session = Depends(get_db), user: User = Depends(require_employer),
):
    """KPI tiles, the current pipeline and the open jobs for a date range, optionally against the range before it."""
    return service.overview(db, user, days, compare)
