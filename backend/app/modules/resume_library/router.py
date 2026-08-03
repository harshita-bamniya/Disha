"""Resume Library API — candidate resume file management.

All routes require an authenticated aspirant (candidate) user.
"""
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.user import User
from app.modules.resume_library import service
from app.modules.resume_library.schemas import (
    ResumeFileOut,
    ResumeLibraryOut,
    ResumeRenameRequest,
    ResumeRecommendationOut,
    ResumeRecommendation,
)

router = APIRouter(prefix="/candidates/me/resumes", tags=["Resume Library"])


def _exc(e: Exception) -> HTTPException:
    if isinstance(e, NotFoundException):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, (BadRequestException, ForbiddenException)):
        return HTTPException(status_code=400, detail=str(e))
    return HTTPException(status_code=500, detail="Unexpected error.")


# ── AI Recommendation (registered first — static path must beat /{resume_id}) ─

@router.get("/recommend", response_model=ResumeRecommendationOut)
async def recommend_resumes(
    job_id: str = Query(..., description="Job posting ID to match resumes against"),
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """AI-ranked resume recommendations for a specific job."""
    try:
        ranked = await service.recommend_resumes(job_id, user, db)
        return ResumeRecommendationOut(
            job_id=job_id,
            recommendations=[ResumeRecommendation(**r) for r in ranked],
        )
    except Exception as e:
        raise _exc(e)


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("/", response_model=ResumeLibraryOut)
def list_resumes(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Return all non-deleted resumes in the candidate's library."""
    records = service.list_resumes(user, db)
    return ResumeLibraryOut(
        resumes=[ResumeFileOut.model_validate(r) for r in records],
        total=len(records),
    )


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ResumeFileOut, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    label: str | None = Form(None),
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Upload a new resume file (PDF, DOCX, DOC, RTF — max 5 MB)."""
    try:
        record = await service.upload_resume(file, user, db, label=label)
        return ResumeFileOut.model_validate(record)
    except (BadRequestException, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise _exc(e)


# ── Preview (serve bytes inline) ───────────────────────────────────────────────

@router.get("/{resume_id}/preview")
def preview_resume(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Serve the resume file for in-browser preview (inline Content-Disposition)."""
    try:
        storage_key = service.get_preview_url(resume_id, user, db)
    except Exception as e:
        raise _exc(e)

    from app.core.storage import get_path
    path = get_path(storage_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume file not found on storage.")

    media_type, _ = mimetypes.guess_type(str(path))
    media_type = media_type or "application/octet-stream"

    def _iter():
        with open(path, "rb") as f:
            yield from iter(lambda: f.read(65536), b"")

    return StreamingResponse(
        _iter(),
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename=\"{path.name}\""},
    )


# ── Download ───────────────────────────────────────────────────────────────────

@router.get("/{resume_id}/download")
def download_resume(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Download the resume file as an attachment."""
    try:
        path, filename = service.get_download_path(resume_id, user, db)
    except Exception as e:
        raise _exc(e)

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/octet-stream",
    )


# ── Rename (update label) ──────────────────────────────────────────────────────

@router.put("/{resume_id}", response_model=ResumeFileOut)
def rename_resume(
    resume_id: str,
    body: ResumeRenameRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Update the human-readable label of a resume."""
    try:
        record = service.rename_resume(resume_id, body.label, user, db)
        return ResumeFileOut.model_validate(record)
    except Exception as e:
        raise _exc(e)


# ── Soft-delete ────────────────────────────────────────────────────────────────

@router.delete("/{resume_id}", status_code=204)
def delete_resume(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Soft-delete a resume. Blocked if the resume is used in an active application."""
    try:
        service.delete_resume(resume_id, user, db)
    except Exception as e:
        raise _exc(e)


