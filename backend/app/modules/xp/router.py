"""XP API router — /api/xp/*"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user
from app.database import get_db
from app.models.user import User
from app.modules.xp import service
from app.modules.xp.schemas import XPSummaryOut, XPTransactionOut

router = APIRouter(prefix="/xp", tags=["XP"])


def _require_aspirant(user: User = Depends(get_current_user)) -> User:
    if user.role_name not in ("aspirant", "admin"):
        raise HTTPException(status_code=403, detail="Aspirants only.")
    return user


@router.get("", response_model=XPSummaryOut)
def get_xp(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return XP summary for the current user."""
    return service.get_xp_summary(user.id, db)


@router.get("/transactions", response_model=list[XPTransactionOut])
def get_xp_transactions(
    user: User = Depends(_require_aspirant),
    db: Session = Depends(get_db),
):
    """Return recent XP transaction history."""
    return service.get_recent_transactions(user.id, limit=20, db=db)
