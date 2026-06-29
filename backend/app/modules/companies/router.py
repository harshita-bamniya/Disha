from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException, ForbiddenException, NotFoundException
from app.core.rbac import require_employer, require_permission
from app.core.storage import save_upload
from app.database import get_db
from app.models.user import User
from app.modules.companies import service
from app.modules.companies.schemas import (
    CompanyAssetUploadResponse, CompanyProfileResponse, CompanyProfileUpdateRequest,
    CompanySubscriptionResponse, EmployerProfileSelfResponse, EmployerProfileUpdateRequest,
    MessageResponse, SubscriptionPlanEntry, SubscriptionUpgradeRequest, SubscriptionUsageResponse,
    TeamInviteRequest, TeamMemberEntry, TransferOwnershipRequest,
)

router = APIRouter(prefix="/employer/company", tags=["Employer Company"])

_company_errors = (AuthException, NotFoundException, BadRequestException, ForbiddenException)


def _status_for(e: Exception) -> int:
    if isinstance(e, NotFoundException):
        return 404
    if isinstance(e, ForbiddenException):
        return 403
    if isinstance(e, AuthException):
        return 401
    return 400


@router.get("", response_model=CompanyProfileResponse)
def get_company(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_company_profile(current_user, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.patch("", response_model=CompanyProfileResponse)
def update_company(
    body: CompanyProfileUpdateRequest,
    current_user: User = Depends(require_permission("companies", "edit")),
    db: Session = Depends(get_db),
):
    try:
        return service.update_company_profile(current_user, body, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.patch("/profile", response_model=EmployerProfileSelfResponse)
def update_employer_profile(
    body: EmployerProfileUpdateRequest,
    current_user: User = Depends(require_permission("companies", "edit")),
    db: Session = Depends(get_db),
):
    """Recruiter info (contact person, designation, city, GST) — distinct from
    /employer/company, which updates the shared Company branding/industry fields."""
    try:
        return service.update_employer_profile(current_user, body, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.post("/logo", response_model=CompanyAssetUploadResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("companies", "edit")),
    db: Session = Depends(get_db),
):
    try:
        file_url, _ = await save_upload(file, "company_branding")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # save_upload returns "company_branding/<name>" — the public static mount's
    # root IS that directory, so strip the subdir prefix for the public URL.
    public_url = f"/static/{file_url.removeprefix('company_branding/')}"
    try:
        service.set_company_logo(current_user, public_url, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))
    return CompanyAssetUploadResponse(url=public_url)


@router.post("/banner", response_model=CompanyAssetUploadResponse)
async def upload_company_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("companies", "edit")),
    db: Session = Depends(get_db),
):
    try:
        file_url, _ = await save_upload(file, "company_branding")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    public_url = f"/static/{file_url.removeprefix('company_branding/')}"
    try:
        service.set_company_banner(current_user, public_url, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))
    return CompanyAssetUploadResponse(url=public_url)


@router.get("/team", response_model=list[TeamMemberEntry])
def list_team(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_team_members(current_user, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.post("/team/invite", response_model=TeamMemberEntry, status_code=201)
def invite_team_member(
    body: TeamInviteRequest,
    current_user: User = Depends(require_permission("team", "invite")),
    db: Session = Depends(get_db),
):
    try:
        return service.invite_team_member(current_user, body, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.delete("/team/{employer_profile_id}", response_model=MessageResponse)
def remove_team_member(
    employer_profile_id: str,
    current_user: User = Depends(require_permission("team", "remove")),
    db: Session = Depends(get_db),
):
    try:
        return service.remove_team_member(current_user, employer_profile_id, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@router.post("/team/transfer-ownership", response_model=MessageResponse)
def transfer_ownership(
    body: TransferOwnershipRequest,
    current_user: User = Depends(require_permission("team", "transfer_ownership")),
    db: Session = Depends(get_db),
):
    try:
        return service.transfer_ownership(current_user, body.new_owner_employer_profile_id, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


# ── Subscriptions ──────────────────────────────────────────────────────────────

subscription_router = APIRouter(prefix="/employer/subscription", tags=["Employer Subscription"])


@subscription_router.get("", response_model=CompanySubscriptionResponse)
def get_subscription(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_company_subscription(current_user, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@subscription_router.get("/usage", response_model=SubscriptionUsageResponse)
def get_subscription_usage(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_subscription_usage(current_user, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@subscription_router.post("/upgrade", response_model=CompanySubscriptionResponse)
def upgrade_subscription(
    body: SubscriptionUpgradeRequest,
    current_user: User = Depends(require_permission("subscriptions", "manage")),
    db: Session = Depends(get_db),
):
    try:
        return service.upgrade_subscription(current_user, body.plan_id, db)
    except _company_errors as e:
        raise HTTPException(status_code=_status_for(e), detail=str(e))


@subscription_router.get("/plans", response_model=list[SubscriptionPlanEntry])
def list_subscription_plans(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return service.list_subscription_plans(db)
