from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user, require_employer, require_permission
from app.core.exceptions import AuthException, BadRequestException
from app.database import get_db
from app.models.user import User
from app.modules.jobs import service
from app.modules.jobs.schemas import (
    BulkImportResponse,
    EmployerDashboardResponse, EmployerPermissionsResponse, GenerateDescriptionRequest, GenerateDescriptionResponse,
    JobPostingRequest, JobPostingResponse, JobTemplateCreateRequest, JobTemplateOut,
    SuggestSkillsRequest, SuggestSkillsResponse, VerificationStatusResponse,
)

router = APIRouter(prefix="/employer", tags=["Employer Jobs"])

# All routes require the caller to be a company-side user (owner or team member)
_employer = require_employer


@router.get("/dashboard", response_model=EmployerDashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_dashboard(current_user, db)
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
):
    try:
        return await service.suggest_skills_for_job(body.title, body.description)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/jobs/generate-description", response_model=GenerateDescriptionResponse)
async def generate_description(
    body: GenerateDescriptionRequest,
    current_user: User = Depends(require_permission("jobs", "create")),
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
    db: Session = Depends(get_db),
):
    try:
        service.delete_job(current_user, job_id, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


# ── Employer KYC verification (self-service) ──────────────────────────────────

@router.get("/verification", response_model=VerificationStatusResponse)
def get_verification_status(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    return service.get_verification_status(current_user, db)


@router.post("/verification/documents", response_model=VerificationStatusResponse)
async def upload_verification_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return await service.upload_verification_document(current_user, doc_type, file, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.post("/verification/submit", response_model=VerificationStatusResponse)
def submit_verification(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.submit_verification(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)
