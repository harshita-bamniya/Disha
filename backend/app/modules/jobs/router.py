from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException
from app.core.rbac import (
    get_current_verified_user,
    require_employer,
    require_permission,
)
from app.database import get_db
from app.models.user import User
from app.modules.jobs import service, verification
from app.modules.payments.service import require_active_employer_subscription
from app.modules.jobs.schemas import (
    BusinessEmailCodeRequest,
    BulkImportResponse,
    EmployerDashboardResponse,
    EmployerPermissionsResponse,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    HiringTeamAddRequest,
    HiringTeamMemberOut,
    JobPostingRequest,
    JobPostingResponse,
    JobTemplateCreateRequest,
    JobTemplateOut,
    SuggestSkillsRequest,
    SuggestSkillsResponse,
    VerificationDetailsRequest,
    VerificationStatusResponse,
)

router = APIRouter(prefix="/employer", tags=["Employer Jobs"])

# All routes require the caller to be a company-side user (owner or team member)
_employer = require_employer
# Dashboard/job-management routes additionally require an active subscription (free
# or paid) — verification and permissions stay accessible even pre-signup (see
# PaymentRequiredException). Free-tier usage is capped by the plan's own limits
# (e.g. max_active_jobs, enforced in service._check_active_job_limit).
_active_employer = require_active_employer_subscription


@router.get("/dashboard", response_model=EmployerDashboardResponse)
def get_dashboard(
    department_id: str | None = Query(None, description="Filter jobs by department ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_verified_user),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_dashboard(current_user, db, department_id=department_id, limit=limit, offset=offset)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.get("/permissions", response_model=EmployerPermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.get_my_permissions(current_user, db)


@router.post("/jobs/suggest-skills", response_model=SuggestSkillsResponse)
async def suggest_skills(
    body: SuggestSkillsRequest,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
):
    try:
        return await service.suggest_skills_for_job(body.title, body.description)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/jobs/generate-description", response_model=GenerateDescriptionResponse)
async def generate_description(
    body: GenerateDescriptionRequest,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
):
    """AI first-draft of the job description from title + sector — employer
    reviews/edits before publishing. Skill suggestion already existed
    (suggest-skills above, already wired into the form); description writing
    itself was the remaining piece of the audit's 'no AI-assisted job
    creation' gap."""
    try:
        return await service.generate_job_description(body.title, body.sector, body.key_points)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/jobs", response_model=JobPostingResponse, status_code=201)
def create_job(
    body: JobPostingRequest,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.create_job(current_user, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.post("/jobs/bulk-import", response_model=BulkImportResponse)
async def bulk_import_jobs(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    """Bulk-create job postings from a CSV — all saved as drafts for the
    employer to review and publish individually."""
    if file.content_type not in ("text/csv", "application/vnd.ms-excel", "application/csv", "text/plain"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")
    raw = await file.read()
    try:
        csv_text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read file — please save as UTF-8 CSV.")
    try:
        return service.bulk_import_jobs(current_user, csv_text, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.get("/jobs/templates", response_model=list[JobTemplateOut])
def list_job_templates(
    current_user: User = Depends(_employer),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_job_templates(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.post("/jobs/templates", response_model=JobTemplateOut, status_code=201)
def create_job_template(
    body: JobTemplateCreateRequest,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.create_job_template(current_user, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.delete("/jobs/templates/{template_id}")
def delete_job_template(
    template_id: str,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.delete_job_template(current_user, template_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.put("/jobs/{job_id}", response_model=JobPostingResponse)
def update_job(
    job_id: str,
    body: JobPostingRequest,
    current_user: User = Depends(require_permission("jobs", "edit")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.update_job(current_user, job_id, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.patch("/jobs/{job_id}/publish", response_model=JobPostingResponse)
def publish_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "publish")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.publish_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.patch("/jobs/{job_id}/pause", response_model=JobPostingResponse)
def pause_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "publish")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.pause_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.patch("/jobs/{job_id}/close", response_model=JobPostingResponse)
def close_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "publish")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.close_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.patch("/jobs/{job_id}/reopen", response_model=JobPostingResponse)
def reopen_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "publish")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.reopen_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.patch("/jobs/{job_id}/archive", response_model=JobPostingResponse)
def archive_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "publish")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.archive_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/jobs/{job_id}/duplicate", response_model=JobPostingResponse, status_code=201)
def duplicate_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "create")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.duplicate_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current_user: User = Depends(require_permission("jobs", "delete")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        service.delete_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


# ── Employer verification (self-service) ──────────────────────────────────────

@router.get("/verification", response_model=VerificationStatusResponse)
def get_verification_status(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return verification.get_status(current_user, db)
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/start", response_model=VerificationStatusResponse)
def start_verification(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Open (or re-open after a rejection) an editable verification draft."""
    try:
        return verification.start(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/request", response_model=VerificationStatusResponse, deprecated=True)
def request_verification(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Legacy alias of /verification/start — no longer enters the review queue by itself."""
    return start_verification(current_user, db)


@router.put("/verification/details", response_model=VerificationStatusResponse)
def save_verification_details(
    body: VerificationDetailsRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return verification.save_details(current_user, body, db)
    except verification.InvalidDetailsError as e:
        raise HTTPException(status_code=422, detail={"message": "Some details are not valid.", "errors": e.errors})
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/documents", response_model=VerificationStatusResponse)
async def upload_verification_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return await verification.upload_document(current_user, doc_type, file, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


_limiter = Limiter(key_func=get_remote_address)


@router.post("/verification/business-email/send", response_model=VerificationStatusResponse)
@_limiter.limit("5/minute;15/hour")
async def send_business_email_code(
    request: Request,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Email a code to the business email on the case, to prove the employer controls it."""
    try:
        return await verification.send_business_email_code(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/business-email/verify", response_model=VerificationStatusResponse)
@_limiter.limit("10/hour")
def verify_business_email_code(
    request: Request,
    body: BusinessEmailCodeRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return verification.verify_business_email_code(current_user, body.otp, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.delete("/verification/documents/{document_id}", response_model=VerificationStatusResponse)
def delete_verification_document(
    document_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return verification.delete_document(current_user, document_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/submit", response_model=VerificationStatusResponse)
def submit_verification(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return verification.submit(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.get("/verification/rules")
def verification_rules(current_user: User = Depends(_employer)):
    """Entity types, document labels and declaration texts for the verification form."""
    from app.core import employer_verification_rules as rules
    return {
        "entity_types": [{"value": k, "label": rules.ENTITY_LABELS[k], "checklist": rules.checklist(k)} for k in rules.ENTITY_TYPES],
        "reason_codes": rules.REASON_CODES,
    }


# ── Hiring Team ────────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/hiring-team", response_model=list[HiringTeamMemberOut])
def list_hiring_team(
    job_id: str,
    current_user: User = Depends(_employer),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_hiring_team(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/jobs/{job_id}/hiring-team", response_model=HiringTeamMemberOut, status_code=201)
def add_hiring_team_member(
    job_id: str,
    body: HiringTeamAddRequest,
    current_user: User = Depends(require_permission("jobs", "edit")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.add_hiring_team_member(current_user, job_id, body, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.delete("/jobs/{job_id}/hiring-team/{member_id}")
def remove_hiring_team_member(
    job_id: str,
    member_id: str,
    current_user: User = Depends(require_permission("jobs", "edit")),
    _sub: User = Depends(_active_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.remove_hiring_team_member(current_user, job_id, member_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)
