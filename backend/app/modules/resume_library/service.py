"""Resume Library service — candidate uploaded-file management.

Handles upload, list, preview URL generation, download URL generation,
rename (label update), soft-delete, and AI-powered resume recommendation.

Storage: local-disk (same BASE_DIR as core.storage) with an S3-compatible
interface; swap storage helpers to boto3/GCS when deploying to cloud.
Key pattern: resumes/{candidate_id}/{uuid}.{ext}
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.storage import BASE_DIR, _scan_for_viruses
from app.models.ats import CandidateResumeFile
from app.models.mvp3 import Application
from app.models.user import JobPosting, User

logger = logging.getLogger(__name__)

# ── constants ──────────────────────────────────────────────────────────────────

MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB

ALLOWED_FORMATS = {"pdf", "docx", "doc", "rtf"}

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "text/rtf": "rtf",
    "application/rtf": "rtf",
}

# Magic-byte signatures for content-type verification.
# DOCX/XLSX/ZIP share PK\x03\x04; DOC uses CFBF magic; RTF uses plain text header.
_MAGIC: dict[str, tuple[bytes, ...]] = {
    "pdf":  (b"%PDF-",),
    "docx": (b"PK\x03\x04",),
    "doc":  (b"\xd0\xcf\x11\xe0",),
    "rtf":  (b"{\\rtf",),
}


# ── helpers ────────────────────────────────────────────────────────────────────

def _ext_from_mime(content_type: str | None, filename: str) -> str:
    """Resolve extension from MIME type first, then filename suffix."""
    if content_type and content_type in ALLOWED_MIME_TYPES:
        return ALLOWED_MIME_TYPES[content_type]
    suffix = Path(filename).suffix.lstrip(".").lower() if filename else ""
    if suffix in ALLOWED_FORMATS:
        return suffix
    return ""


def _verify_magic(ext: str, contents: bytes, filename: str) -> None:
    sigs = _MAGIC.get(ext, ())
    if sigs and not any(contents.startswith(s) for s in sigs):
        raise BadRequestException(
            f"File content does not match its declared type ({ext}). "
            "The file may be corrupted or renamed."
        )


def _storage_key(candidate_id: str, file_uuid: str, ext: str) -> str:
    return f"resumes/{candidate_id}/{file_uuid}.{ext}"


def _resume_path(storage_key: str) -> Path:
    return BASE_DIR / storage_key


def _is_used_in_active_application(resume_id: uuid.UUID, db: Session) -> bool:
    """Return True if this resume is linked to a non-withdrawn, non-rejected application."""
    return (
        db.query(Application)
        .filter(
            Application.resume_id == resume_id,
            Application.status.notin_(["withdrawn", "rejected"]),
        )
        .first()
        is not None
    )


# ── public service functions ───────────────────────────────────────────────────

async def upload_resume(
    file: UploadFile,
    user: User,
    db: Session,
    label: str | None = None,
    source: str = "uploaded",
) -> CandidateResumeFile:
    """Validate, store, and register a new resume file for the candidate."""
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise BadRequestException("Resume file too large. Maximum size is 5 MB.")

    if len(contents) == 0:
        raise BadRequestException("Uploaded file is empty.")

    ext = _ext_from_mime(file.content_type, file.filename or "")
    if not ext:
        raise BadRequestException(
            f"Unsupported file type. Allowed formats: PDF, DOCX, DOC, RTF. "
            f"Received: {file.content_type or 'unknown'}."
        )

    _verify_magic(ext, contents, file.filename or "")
    _scan_for_viruses(contents, file.filename or "resume")

    file_uuid = uuid.uuid4().hex
    storage_key = _storage_key(str(user.id), file_uuid, ext)
    dest = _resume_path(storage_key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(contents)

    record = CandidateResumeFile(
        candidate_id=user.id,
        filename=file.filename or f"resume.{ext}",
        storage_key=storage_key,
        file_size_bytes=len(contents),
        format=ext,
        label=label,
        source=source,
        is_deleted=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("[RESUME_LIBRARY] Uploaded: user=%s file=%s size=%d", user.id, record.id, len(contents))
    return record


def list_resumes(user: User, db: Session) -> list[CandidateResumeFile]:
    """Return all non-deleted resumes for the candidate, most-recently uploaded first."""
    return (
        db.query(CandidateResumeFile)
        .filter(
            CandidateResumeFile.candidate_id == user.id,
            CandidateResumeFile.is_deleted == False,
        )
        .order_by(CandidateResumeFile.created_at.desc())
        .all()
    )


def get_resume_or_404(resume_id: str, user: User, db: Session) -> CandidateResumeFile:
    """Fetch a resume that belongs to this user, or raise 404."""
    try:
        rid = uuid.UUID(resume_id)
    except ValueError:
        raise NotFoundException("Resume not found.")

    record = (
        db.query(CandidateResumeFile)
        .filter(
            CandidateResumeFile.id == rid,
            CandidateResumeFile.candidate_id == user.id,
            CandidateResumeFile.is_deleted == False,
        )
        .first()
    )
    if not record:
        raise NotFoundException("Resume not found.")
    return record


def get_preview_url(resume_id: str, user: User, db: Session) -> str:
    """Return the storage-relative path that the preview endpoint will serve."""
    record = get_resume_or_404(resume_id, user, db)
    # Return the storage key; the router serves the bytes from local disk.
    # In production, swap with a signed S3 pre-signed URL with a short TTL.
    return record.storage_key


def get_download_path(resume_id: str, user: User, db: Session) -> tuple[Path, str]:
    """Return (disk_path, filename) for streaming download."""
    record = get_resume_or_404(resume_id, user, db)
    path = _resume_path(record.storage_key)
    if not path.exists():
        raise NotFoundException("Resume file not found on storage.")
    record.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return path, record.filename


def rename_resume(resume_id: str, new_label: str, user: User, db: Session) -> CandidateResumeFile:
    """Update the human-readable label of a resume."""
    record = get_resume_or_404(resume_id, user, db)
    record.label = new_label.strip()
    db.commit()
    db.refresh(record)
    return record


def delete_resume(resume_id: str, user: User, db: Session) -> None:
    """Soft-delete a resume. Blocked if the resume is used in an active application."""
    record = get_resume_or_404(resume_id, user, db)

    if _is_used_in_active_application(record.id, db):
        raise BadRequestException(
            "This resume is attached to an active application and cannot be deleted. "
            "Withdraw the application first, or wait until it is no longer active."
        )

    record.is_deleted = True
    db.commit()
    logger.info("[RESUME_LIBRARY] Soft-deleted: user=%s resume=%s", user.id, resume_id)


# ── AI recommendation ──────────────────────────────────────────────────────────

_RECOMMEND_SYSTEM = """You are a resume selection assistant.
Given a job description and a list of candidate resumes (with metadata only — no file content),
rank the resumes by relevance to the job. Return a JSON array ranked best-first.

Rules:
- Base your ranking on the resume label, filename, and any source hints (builder/optimizer).
- Never rank based on personal characteristics of the candidate.
- Return ONLY valid JSON — no prose, no markdown fences."""

_RECOMMEND_USER = """Job description:
{job_description}

Required skills: {required_skills}

Candidate's resumes:
{resumes_json}

Return a JSON array (ordered best-first) where each item has:
{{
  "resume_id": "<id from input>",
  "relevance_score": <integer 0-100>,
  "reason": "<one sentence explaining why this resume fits or does not fit this job>"
}}

Include ALL resumes in the output, even if poorly matched."""


async def recommend_resumes(job_id: str, user: User, db: Session) -> list[dict]:
    """Use Claude to rank the candidate's resumes for a specific job.

    Falls back to recency-order if AI is unavailable.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise NotFoundException("Job not found.")

    job = db.query(JobPosting).filter(JobPosting.id == job_uuid).first()
    if not job:
        raise NotFoundException("Job not found.")

    resumes = list_resumes(user, db)
    if not resumes:
        return []

    if len(resumes) == 1:
        return [{
            "resume_id": str(resumes[0].id),
            "filename": resumes[0].filename,
            "label": resumes[0].label,
            "relevance_score": 80,
            "reason": "This is your only resume — it will be used for this application.",
        }]

    resume_list = [
        {
            "resume_id": str(r.id),
            "filename": r.filename,
            "label": r.label or "",
            "source": r.source,
            "format": r.format,
            "uploaded": r.created_at.isoformat() if r.created_at else "",
        }
        for r in resumes
    ]

    job_description = (job.description or "")[:2000]
    required_skills = ", ".join(job.required_skills or [])

    from app.ai.providers import create_provider
    provider = create_provider()
    try:
        prompt = _RECOMMEND_USER.format(
            job_description=job_description,
            required_skills=required_skills,
            resumes_json=json.dumps(resume_list, indent=2),
        )
        msg = await provider.complete(
            system=_RECOMMEND_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.2,
        )
        raw = msg.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        ranked: list[dict] = json.loads(raw)

        # Build a lookup by resume_id for enrichment
        resume_map = {str(r.id): r for r in resumes}
        result = []
        for item in ranked:
            rid = item.get("resume_id", "")
            r = resume_map.get(rid)
            if r:
                result.append({
                    "resume_id": rid,
                    "filename": r.filename,
                    "label": r.label,
                    "relevance_score": max(0, min(100, int(item.get("relevance_score", 50)))),
                    "reason": str(item.get("reason", "")),
                })
        return result

    except json.JSONDecodeError:
        logger.warning("[RESUME_RECOMMEND] AI returned malformed JSON — falling back to recency order")
    except Exception as exc:
        logger.error("[RESUME_RECOMMEND] AI call failed: %s — falling back to recency order", exc)

    # Fallback: return resumes sorted by recency with a generic reason
    return [
        {
            "resume_id": str(r.id),
            "filename": r.filename,
            "label": r.label,
            "relevance_score": max(10, 90 - i * 10),
            "reason": "Ranked by most recently uploaded.",
        }
        for i, r in enumerate(resumes)
    ]
