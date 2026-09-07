from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, NotFoundException
from app.core.rbac import require_employer
from app.database import get_db
from app.models.user import User
from app.modules.talent_pool import service
from app.modules.talent_pool.schemas import SaveCandidateRequest, SavedCandidateOut

router = APIRouter(prefix="/employer/talent-pool", tags=["Employer Talent Pool"])

_employer = require_employer


@router.get("", response_model=list[SavedCandidateOut])
def list_talent_pool(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Candidates this company has bookmarked, independent of any one job."""
    try:
        return service.list_talent_pool(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{aspirant_id}", response_model=SavedCandidateOut, status_code=201)
def save_candidate(
    aspirant_id: str,
    body: SaveCandidateRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.save_candidate(aspirant_id, body.note, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{aspirant_id}", status_code=200)
def unsave_candidate(
    aspirant_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.unsave_candidate(aspirant_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{aspirant_id}/is-saved")
def check_saved(
    aspirant_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return {"aspirant_id": aspirant_id, "saved": service.is_saved(aspirant_id, current_user, db)}
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))
