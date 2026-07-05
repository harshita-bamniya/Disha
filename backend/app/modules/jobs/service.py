import logging
import uuid
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session

from fastapi import UploadFile

from app.core.exceptions import AuthException, BadRequestException
from app.core.storage import save_upload
from app.models.employer_verification import (
    DOCUMENT_TYPES, EmployerVerification, EmployerVerificationDocument, EmployerVerificationEvent,
)
from app.models.company import Company, CompanyDepartment
from app.models.mvp3 import JobTemplate
from app.models.user import EmployerProfile, JobPosting, User
from sqlalchemy import func
from app.modules.jobs.schemas import (
    BulkImportResponse, BulkImportRowError,
    EmployerDashboardResponse, GenerateDescriptionResponse, JobPostingRequest, JobTemplateCreateRequest, JobTemplateOut, VALID_SKILLS,
    JobPostingResponse, SuggestSkillsResponse, VerificationDocumentOut, VerificationEventOut, VerificationStatusResponse,
)

logger = logging.getLogger(__name__)


def _get_approved_employer(user: User, db: Session) -> EmployerProfile:
    """Job posting (not account access) is gated on two things, same as
    Naukri/Indeed: a completed company profile, and KYC verification."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")

    company = db.query(Company).filter(Company.id == profile.company_id).first() if profile.company_id else None
    if not company or not company.industry or not company.company_size:
        raise BadRequestException(
            "Complete your company profile (industry and company size) before posting jobs."
        )
    if not profile.is_approved:
        raise AuthException(
            "Your company isn't verified yet. Submit your verification documents to start posting jobs."
        )
    return profile


def _get_company_employer_ids(profile: EmployerProfile, db: Session) -> list:
    """All EmployerProfile.id values that share this profile's company."""
    if not profile.company_id:
        return [profile.id]
    rows = db.query(EmployerProfile.id).filter(EmployerProfile.company_id == profile.company_id).all()
    return [r[0] for r in rows]


def _is_company_wide(profile: EmployerProfile, role_name: str | None) -> bool:
    """Company-wide access: owner OR hr_manager OR no department assigned.
    Everyone else (recruiter, interviewer, hiring_manager) with a department_id
    is scoped to their department only — LinkedIn Recruiter / Naukri style."""
    if profile.is_owner:
        return True
    if role_name in ("hr_manager", "admin", "super_admin"):
        return True
    if profile.department_id is None:
        return True
    return False


def _scope_jobs_query(query, profile: EmployerProfile, role_name: str | None):
    """Apply department scoping to a JobPosting query that already filters by
    company employer_ids. Returns the query unchanged for company-wide users."""
    if _is_company_wide(profile, role_name):
        return query
    return query.filter(JobPosting.department_id == profile.department_id)


def _get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    return profile


def _job_to_response(job: JobPosting, applicant_count: int = 0) -> JobPostingResponse:
    dept_name = job.department.name if job.department else None
    return JobPostingResponse(
        id=str(job.id),
        title=job.title,
        description=job.description,
        sector=job.sector,
        required_skills=job.required_skills or [],
        min_k_score=job.min_k_score,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        growth_outlook=job.growth_outlook,
        job_type=job.job_type,
        location=job.location,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        is_active=job.is_active,
        status=job.status,
        department_id=str(job.department_id) if job.department_id else None,
        department_name=dept_name,
        created_at=job.created_at,
        updated_at=job.updated_at,
        applicant_count=applicant_count,
    )


def get_dashboard(user: User, db: Session, department_id: str | None = None) -> EmployerDashboardResponse:
    from app.models.mvp3 import Application
    profile = _get_employer_profile(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    q = (
        db.query(JobPosting)
        .filter(JobPosting.employer_id.in_(company_employer_ids))
        .order_by(JobPosting.created_at.desc())
    )
    q = _scope_jobs_query(q, profile, user.role_name)
    if department_id:
        q = q.filter(JobPosting.department_id == department_id)
    jobs = q.all()
    # Batch count applicants per job
    job_ids = [j.id for j in jobs]
    counts = {}
    if job_ids:
        rows = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        counts = {str(row[0]): row[1] for row in rows}

    active = [j for j in jobs if j.is_active]
    return EmployerDashboardResponse(
        company_name=profile.company_name,
        is_approved=profile.is_approved,
        total_jobs=len(jobs),
        active_jobs=len(active),
        jobs=[_job_to_response(j, counts.get(str(j.id), 0)) for j in jobs],
    )


def _embed_job(job: JobPosting) -> None:
    """Dispatch description embedding + required_skills caching to Celery."""
    from app.tasks.worker import embed_job
    embed_job.delay(str(job.id))


def _check_active_job_limit(profile: EmployerProfile, db: Session) -> None:
    """Raises if creating one more active job would exceed the company's plan limit."""
    if not profile.company_id:
        return
    from app.models.subscription import CompanySubscription, SubscriptionPlan

    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == profile.company_id).first()
    if not sub:
        return
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
    if not plan or plan.max_active_jobs is None:
        return

    company_employer_ids = _get_company_employer_ids(profile, db)
    active_count = db.query(JobPosting).filter(
        JobPosting.employer_id.in_(company_employer_ids), JobPosting.is_active == True,
    ).count()
    if active_count >= plan.max_active_jobs:
        raise BadRequestException(
            f"Your plan allows {plan.max_active_jobs} active job posting(s). "
            f"Upgrade your subscription or pause an existing job to post a new one."
        )


_SUGGEST_SKILLS_SYSTEM = """You are an expert technical recruiter. Given a job title and description,
identify which skills from the provided taxonomy are most relevant for this role.

Respond ONLY with a valid JSON array of skill name strings, chosen ONLY from the taxonomy below —
never invent a skill that isn't in this list. Pick 4-8 skills that genuinely match the role; don't
pad the list with weak matches.

Taxonomy: {skills}"""


async def suggest_skills_for_job(title: str, description: str) -> SuggestSkillsResponse:
    """AI-assisted first draft for the required-skills picker — the employer
    still reviews and can add/remove before submitting. Never invents skills
    outside VALID_SKILLS, since that's what the submit endpoint accepts."""
    import json
    import re
    from app.ai.providers.groq import GroqProvider, RateLimitedError

    provider = GroqProvider()
    system = _SUGGEST_SKILLS_SYSTEM.format(skills=", ".join(sorted(VALID_SKILLS)))
    user_prompt = f"Job title: {title}\n\nJob description:\n{description[:2000]}"

    try:
        response = await provider.complete(system, [{"role": "user", "content": user_prompt}], max_tokens=300, temperature=0.3)
    except RateLimitedError as e:
        raise BadRequestException(str(e))
    except RuntimeError as e:
        raise BadRequestException(f"Skill suggestion is unavailable right now: {e}")

    raw = response.content.strip()
    raw = re.sub(r"^```(?:json)?\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    start, end = raw.find("["), raw.rfind("]") + 1
    if start == -1 or end <= start:
        return SuggestSkillsResponse(suggested_skills=[])

    try:
        parsed = json.loads(raw[start:end])
    except json.JSONDecodeError:
        return SuggestSkillsResponse(suggested_skills=[])

    # Defense in depth — only ever return skills that are actually in the
    # taxonomy, even though the prompt already constrains the model to it.
    valid = [s for s in parsed if isinstance(s, str) and s in VALID_SKILLS]
    return SuggestSkillsResponse(suggested_skills=valid[:8])


_GENERATE_DESCRIPTION_SYSTEM = """You are an expert technical recruiter writing job postings for a \
careers platform aimed at UPSC/government-exam aspirants transitioning to private-sector roles. \
Write a clear, honest job description in plain prose (2-4 short paragraphs, no markdown headers, \
no bullet-point lists) covering: what the role actually involves day-to-day, what kind of \
background/strengths suit it, and why it could be a good fit for someone coming from a rigorous \
exam-prep background. Do not invent a company name, salary, or specific perks — none of that \
context is given. Keep it under 220 words. Respond with ONLY the description text, nothing else \
(no preamble, no quotes around it)."""


async def generate_job_description(title: str, sector: str, key_points: str) -> GenerateDescriptionResponse:
    """First-draft job description from a title + sector — the employer still
    reviews and edits before publishing. Mirrors suggest_skills_for_job's
    provider/error-handling pattern exactly."""
    from app.ai.providers.groq import GroqProvider, RateLimitedError

    provider = GroqProvider()
    user_prompt = f"Job title: {title}\nSector: {sector}"
    if key_points.strip():
        user_prompt += f"\nKey points to include:\n{key_points.strip()[:1000]}"

    try:
        response = await provider.complete(
            _GENERATE_DESCRIPTION_SYSTEM, [{"role": "user", "content": user_prompt}],
            max_tokens=400, temperature=0.6,
        )
    except RateLimitedError as e:
        raise BadRequestException(str(e))
    except RuntimeError as e:
        raise BadRequestException(f"Description generation is unavailable right now: {e}")

    return GenerateDescriptionResponse(description=response.content.strip())


def _resolve_department_id(profile: EmployerProfile, requested_id: str | None, db: Session):
    """Determine the department_id for a new job posting.

    Rules (mirrors LinkedIn Recruiter / Naukri employer portal):
    - Dept-scoped user (recruiter/HM with dept assigned): always use their own
      department. They cannot post to a different dept or bypass scoping.
    - Company-wide user (owner / hr_manager / no dept): use the explicitly
      requested department_id, or leave NULL if none provided.
    """
    if profile.department_id:
        # Dept-scoped: ignore any requested_id — always inherit from profile
        return profile.department_id

    if requested_id is None:
        return None

    # Company-wide user specified a department — validate it belongs to this company
    dept = db.query(CompanyDepartment).filter(
        CompanyDepartment.id == requested_id,
        CompanyDepartment.company_id == profile.company_id,
    ).first()
    if not dept:
        raise BadRequestException("Department not found in this company.")
    return dept.id


def create_job(user: User, data: JobPostingRequest, db: Session) -> JobPostingResponse:
    profile = _get_approved_employer(user, db)
    if data.publish:
        _check_active_job_limit(profile, db)

    department_id = _resolve_department_id(profile, data.department_id, db)

    status = "published" if data.publish else "draft"
    job = JobPosting(
        employer_id=profile.id,
        department_id=department_id,
        title=data.title,
        description=data.description,
        sector=data.sector,
        required_skills=data.required_skills,
        min_k_score=data.min_k_score,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        growth_outlook=data.growth_outlook,
        job_type=data.job_type,
        location=data.location,
        employment_type=data.employment_type,
        expires_at=data.expires_at,
        status=status,
        is_active=data.publish,
        skill_extraction_status="done",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info(f"[JOBS] {profile.company_name} {'published' if data.publish else 'saved draft'}: {job.title}")
    _embed_job(job)
    return _job_to_response(job)


_BULK_IMPORT_REQUIRED_COLUMNS = (
    "title", "description", "sector", "required_skills", "job_type", "location", "employment_type", "expires_at",
)


def bulk_import_jobs(user: User, csv_text: str, db: Session) -> BulkImportResponse:
    """Creates multiple job postings from a CSV upload, all as drafts —
    employers review and publish individually afterward rather than the
    import silently going live, since a bad CSV shouldn't spam the platform
    with live postings. Reuses create_job() per row so behavior (embeddings,
    audit logging, approval gating) stays identical to a single manual post.

    Expected columns: title, description, sector, required_skills
    (semicolon-separated), job_type, location, employment_type, expires_at
    (YYYY-MM-DD). Optional: min_k_score, salary_min, salary_max, growth_outlook.
    """
    import csv
    import io

    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames or not set(_BULK_IMPORT_REQUIRED_COLUMNS).issubset(set(reader.fieldnames)):
        missing = set(_BULK_IMPORT_REQUIRED_COLUMNS) - set(reader.fieldnames or [])
        raise BadRequestException(f"CSV is missing required column(s): {', '.join(sorted(missing))}")

    created = 0
    failed: list[BulkImportRowError] = []

    for row_num, row in enumerate(reader, start=1):
        try:
            skills = [s.strip() for s in (row.get("required_skills") or "").split(";") if s.strip()]
            payload = JobPostingRequest(
                title=row.get("title", ""),
                description=row.get("description", ""),
                sector=row.get("sector", ""),
                required_skills=skills,
                min_k_score=int(row["min_k_score"]) if row.get("min_k_score") else 0,
                salary_min=int(row["salary_min"]) if row.get("salary_min") else None,
                salary_max=int(row["salary_max"]) if row.get("salary_max") else None,
                growth_outlook=row.get("growth_outlook") or None,
                job_type=row.get("job_type", ""),
                location=row.get("location", ""),
                employment_type=row.get("employment_type", ""),
                expires_at=datetime.strptime(row["expires_at"], "%Y-%m-%d").date(),
                publish=False,
            )
            create_job(user, payload, db)
            created += 1
        except Exception as exc:
            db.rollback()
            failed.append(BulkImportRowError(row=row_num, error=str(exc)))

    return BulkImportResponse(created=created, failed=failed)


def _template_to_out(t: JobTemplate) -> JobTemplateOut:
    return JobTemplateOut(
        id=str(t.id), name=t.name, title=t.title, description=t.description,
        sector=t.sector, required_skills=t.required_skills or [],
        job_type=t.job_type, employment_type=t.employment_type,
        min_k_score=t.min_k_score, created_at=t.created_at,
    )


def list_job_templates(user: User, db: Session) -> list[JobTemplateOut]:
    profile = _get_employer_profile(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    rows = (
        db.query(JobTemplate)
        .filter(JobTemplate.employer_id.in_(company_employer_ids))
        .order_by(JobTemplate.created_at.desc())
        .all()
    )
    return [_template_to_out(t) for t in rows]


def create_job_template(user: User, data: JobTemplateCreateRequest, db: Session) -> JobTemplateOut:
    profile = _get_employer_profile(user, db)
    row = JobTemplate(
        employer_id=profile.id, name=data.name, title=data.title, description=data.description,
        sector=data.sector, required_skills=data.required_skills,
        job_type=data.job_type, employment_type=data.employment_type, min_k_score=data.min_k_score,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _template_to_out(row)


def delete_job_template(user: User, template_id: str, db: Session) -> dict:
    profile = _get_employer_profile(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    row = db.query(JobTemplate).filter(
        JobTemplate.id == template_id, JobTemplate.employer_id.in_(company_employer_ids),
    ).first()
    if not row:
        raise BadRequestException("Template not found.")
    db.delete(row)
    db.commit()
    return {"message": "Template deleted."}


def update_job(user: User, job_id: str, data: JobPostingRequest, db: Session) -> JobPostingResponse:
    profile = _get_approved_employer(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    job = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id.in_(company_employer_ids)
    ).first()
    if not job:
        raise BadRequestException("Job posting not found.")

    job.title = data.title
    job.description = data.description
    job.sector = data.sector
    job.required_skills = data.required_skills
    job.min_k_score = data.min_k_score
    job.salary_min = data.salary_min
    job.salary_max = data.salary_max
    job.growth_outlook = data.growth_outlook
    job.job_type = data.job_type
    job.location = data.location
    job.employment_type = data.employment_type
    job.expires_at = data.expires_at
    job.department_id = _resolve_department_id(profile, data.department_id, db)
    job.updated_at = datetime.now(timezone.utc)
    job.skill_extraction_status = "done"
    db.commit()
    db.refresh(job)
    logger.info(f"[JOBS] Updated job {job_id}: {job.title}")
    _embed_job(job)
    return _job_to_response(job)


# ── Job lifecycle ──────────────────────────────────────────────────────────────

VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft":     {"published", "archived"},
    "published": {"paused", "closed", "archived"},
    "paused":    {"published", "closed", "archived"},
    "closed":    {"published", "archived"},
    "archived":  set(),   # terminal — no transitions out
}


def _get_company_job(user: User, job_id: str, db: Session) -> tuple[EmployerProfile, JobPosting]:
    profile = _get_approved_employer(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    q = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id.in_(company_employer_ids)
    )
    q = _scope_jobs_query(q, profile, user.role_name)
    job = q.first()
    if not job:
        raise BadRequestException("Job posting not found.")
    return profile, job


def _transition_job(user: User, job_id: str, to_status: str, db: Session) -> JobPostingResponse:
    profile, job = _get_company_job(user, job_id, db)
    if to_status not in VALID_TRANSITIONS.get(job.status, set()):
        raise BadRequestException(f"Cannot move a '{job.status}' job to '{to_status}'.")
    if to_status == "published":
        _check_active_job_limit(profile, db)
        if not job.expires_at:
            raise BadRequestException(
                "Cannot publish a job with no expiry date. Set an expiry date before publishing."
            )
        if job.expires_at <= date.today():
            raise BadRequestException(
                "Cannot publish a job whose expiry date is today or in the past. "
                "Update the expiry date first."
            )

    job.status = to_status
    job.is_active = (to_status == "published")
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    logger.info(f"[JOBS] Job {job_id} -> {to_status}")
    return _job_to_response(job)


def publish_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    return _transition_job(user, job_id, "published", db)


def pause_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    return _transition_job(user, job_id, "paused", db)


def close_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    return _transition_job(user, job_id, "closed", db)


def reopen_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    """Reopen a paused or closed job back to published."""
    return _transition_job(user, job_id, "published", db)


def archive_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    return _transition_job(user, job_id, "archived", db)


def duplicate_job(user: User, job_id: str, db: Session) -> JobPostingResponse:
    """Clone a job posting as a new draft — title, description, skills, etc.
    carried over; applications and status history are not (it's a new posting)."""
    _, source = _get_company_job(user, job_id, db)
    clone = JobPosting(
        employer_id=source.employer_id,
        department_id=source.department_id,
        title=f"{source.title} (Copy)",
        description=source.description,
        sector=source.sector,
        required_skills=source.required_skills,
        min_k_score=source.min_k_score,
        salary_min=source.salary_min,
        salary_max=source.salary_max,
        growth_outlook=source.growth_outlook,
        job_type=source.job_type,
        location=source.location,
        employment_type=source.employment_type,
        expires_at=source.expires_at,
        status="draft",
        is_active=False,
        skill_extraction_status="done",
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    logger.info(f"[JOBS] Duplicated job {job_id} -> {clone.id}")
    _embed_job(clone)
    return _job_to_response(clone)


def delete_job(user: User, job_id: str, db: Session) -> None:
    profile = _get_approved_employer(user, db)
    company_employer_ids = _get_company_employer_ids(profile, db)
    q = db.query(JobPosting).filter(
        JobPosting.id == job_id, JobPosting.employer_id.in_(company_employer_ids)
    )
    q = _scope_jobs_query(q, profile, user.role_name)
    job = q.first()
    if not job:
        raise BadRequestException("Job posting not found.")

    from app.models.mvp3 import Application as _App
    active_apps = db.query(_App).filter(_App.job_id == job.id).count()
    if active_apps:
        raise BadRequestException(
            f"Cannot delete a job with {active_apps} application(s). "
            "Close the job first so candidates are notified, then delete it."
        )

    db.delete(job)
    db.commit()
    logger.info(f"[JOBS] Deleted job {job_id}")


# ── Employer KYC verification (self-service) ──────────────────────────────────

def _latest_verification(profile_id, db: Session) -> EmployerVerification | None:
    return (
        db.query(EmployerVerification)
        .filter(EmployerVerification.employer_id == profile_id)
        .order_by(EmployerVerification.submitted_at.desc())
        .first()
    )


def _verification_to_response(v: EmployerVerification | None) -> VerificationStatusResponse:
    if not v:
        return VerificationStatusResponse()
    return VerificationStatusResponse(
        id=str(v.id), status=v.status, rejection_reason=v.rejection_reason,
        submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
        documents=[
            VerificationDocumentOut(
                id=str(d.id), doc_type=d.doc_type, file_url=d.file_url,
                original_filename=d.original_filename, status=d.status, uploaded_at=d.uploaded_at,
            )
            for d in v.documents
        ],
        events=[
            VerificationEventOut(
                id=str(e.id), from_status=e.from_status, to_status=e.to_status,
                note=e.note, created_at=e.created_at,
            )
            for e in v.events
        ],
    )


def get_verification_status(user: User, db: Session) -> VerificationStatusResponse:
    profile = _get_employer_profile(user, db)
    return _verification_to_response(_latest_verification(profile.id, db))


async def upload_verification_document(user: User, doc_type: str, file: UploadFile, db: Session) -> VerificationStatusResponse:
    profile = _get_employer_profile(user, db)
    if doc_type not in DOCUMENT_TYPES:
        raise BadRequestException(f"Invalid document type. Allowed: {', '.join(DOCUMENT_TYPES)}")

    v = _latest_verification(profile.id, db)
    if not v or v.status in ("approved", "rejected"):
        v = EmployerVerification(employer_id=profile.id, status="draft")
        db.add(v)
        db.flush()
    elif v.status != "draft":
        raise BadRequestException(
            f"Verification is already '{v.status}' — can't change documents until it's reviewed."
        )

    # Replace any existing document of this type rather than stacking duplicates —
    # an employer re-uploading the same slot should overwrite, not pile up rows.
    existing_doc = next((d for d in v.documents if d.doc_type == doc_type), None)
    if existing_doc:
        db.delete(existing_doc)
        db.flush()

    try:
        file_url, original_name = await save_upload(file, f"employer_verification/{v.id}")
    except ValueError as e:
        raise BadRequestException(str(e))

    db.add(EmployerVerificationDocument(
        verification_id=v.id, doc_type=doc_type, file_url=file_url, original_filename=original_name,
    ))
    db.commit()
    db.refresh(v)
    return _verification_to_response(v)


def submit_verification(user: User, db: Session) -> VerificationStatusResponse:
    """Mirrors how real KYB (Know Your Business) checks work — e.g. Naukri's
    recruiter verification: one entity-identity document (GST certificate or
    company registration / Certificate of Incorporation) plus one signatory
    identity document (PAN card). Business email is supplementary, not required."""
    profile = _get_employer_profile(user, db)
    v = _latest_verification(profile.id, db)
    if not v:
        raise BadRequestException("Upload your verification documents before submitting.")

    uploaded_types = {d.doc_type for d in v.documents}
    has_entity_proof = bool(uploaded_types & {"gst_certificate", "company_registration"})
    has_signatory_id = "pan_card" in uploaded_types
    if not (has_entity_proof and has_signatory_id):
        missing = []
        if not has_entity_proof:
            missing.append("a GST certificate or company registration document")
        if not has_signatory_id:
            missing.append("a PAN card")
        raise BadRequestException(f"Upload {' and '.join(missing)} before submitting.")

    if v.status not in ("draft", "rejected"):
        raise BadRequestException(f"Verification is already '{v.status}' — cannot resubmit.")

    old_status = v.status
    v.status = "pending"
    v.submitted_at = datetime.now(timezone.utc)
    db.add(EmployerVerificationEvent(
        verification_id=v.id, actor_id=user.id, from_status=old_status, to_status="pending",
        note="Submitted for review." if old_status != "rejected" else "Resubmitted after rejection.",
    ))
    db.commit()
    db.refresh(v)
    return _verification_to_response(v)


def get_my_permissions(user: User, db: Session):
    """Returns the current company-side user's role + granted permissions,
    so the frontend can hide/disable actions the backend would reject anyway."""
    from app.models.user import Permission, RolePermission
    from app.modules.jobs.schemas import EmployerPermissionsResponse

    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == user.role_id)
        .all()
    )
    return EmployerPermissionsResponse(
        role_name=user.role_name or "",
        permissions=[f"{p.resource}:{p.action}" for p in perms],
    )
