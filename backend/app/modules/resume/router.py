import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.user import AspirantProfile, User
from app.modules.resume import service, pdf_service
from app.modules.resume.schemas import (
    AIGenerateResumeResponse, AIImproveSectionRequest, AIImproveSectionResponse,
    CreateResumeRequest, ResumeDetail, ResumeSummary, ResumeTemplateOut,
    ResumeSectionOut, UpdateResumeRequest, UpsertSectionRequest,
)

router = APIRouter(prefix="/resume", tags=["Resume Builder"])


@router.get("/templates", response_model=list[ResumeTemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return service.list_templates(db)


@router.get("/", response_model=list[ResumeSummary])
def list_resumes(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_resumes(user, db)


@router.post("/", response_model=ResumeDetail, status_code=201)
def create_resume(
    body: CreateResumeRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.create_resume(body, user, db)


@router.get("/{resume_id}", response_model=ResumeDetail)
def get_resume(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_resume(resume_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{resume_id}", response_model=ResumeDetail)
def update_resume(
    resume_id: str,
    body: UpdateResumeRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.update_resume(resume_id, body, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{resume_id}", status_code=204)
def delete_resume(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        service.delete_resume(resume_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{resume_id}/sections/{section_id}", status_code=204)
def delete_section(
    resume_id: str,
    section_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Delete a single section from a resume."""
    try:
        service.delete_section(resume_id, section_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{resume_id}/sections", response_model=ResumeSectionOut)
def upsert_section(
    resume_id: str,
    body: UpsertSectionRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.upsert_section(resume_id, body, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{resume_id}/ai-improve", response_model=AIImproveSectionResponse)
async def ai_improve(
    resume_id: str,
    body: AIImproveSectionRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return await service.ai_improve_section(resume_id, body.section_id, body.career_context, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{resume_id}/ai-generate", response_model=AIGenerateResumeResponse)
async def ai_generate(
    resume_id: str,
    body: service.AiGenerateJobContext | None = None,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return await service.ai_generate_resume(resume_id, user, db, job_context=body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{resume_id}/versions")
def get_versions(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_versions(resume_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{resume_id}/save-version")
def save_version(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.save_version(resume_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{resume_id}/export")
def export_resume_pdf(
    resume_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Download the resume as a PDF file.

    Returns a streaming PDF with Content-Disposition: attachment so the browser
    triggers a save-as dialog.  The candidate's name is pulled from their
    AspirantProfile; falls back to their phone number if the profile is incomplete.
    """
    try:
        resume_detail = service.get_resume(resume_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Resolve candidate name: profile > summary text > phone fallback
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    candidate_name = (profile.full_name if profile and profile.full_name else None)
    if not candidate_name:
        # Try to extract name from summary section text (first capitalised words)
        import re as _re
        summary_sec = next((s for s in resume_detail.sections if s.section_type == 'summary'), None)
        if summary_sec:
            summary_text = (summary_sec.content or {}).get('text', '') or ''
            m = _re.match(r'^([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,3})', summary_text)
            if m:
                candidate_name = m.group(1)
    candidate_name = candidate_name or str(user.phone)

    # Convert Pydantic section models to plain dicts for the PDF renderer
    sections = [
        {
            "section_type": s.section_type,
            "title":        s.title,
            "content":      s.content,
            "sort_order":   s.sort_order,
        }
        for s in resume_detail.sections
    ]

    try:
        pdf_bytes = pdf_service.generate_pdf(
            candidate_name=candidate_name,
            resume_title=resume_detail.title,
            sections=sections,
        )
    except Exception as exc:
        logging.getLogger(__name__).error("[EXPORT] PDF generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="PDF generation failed.")

    # Build a safe filename: "Rahul_Sharma_Resume.pdf"
    safe_name = re.sub(r"[^\w\s-]", "", candidate_name).strip().replace(" ", "_")
    filename = f"{safe_name}_Resume.pdf" if safe_name else "Resume.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
