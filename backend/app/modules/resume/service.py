"""Resume Builder service — Module 06."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.models.mvp2 import Resume, ResumeSection, ResumeTemplate, ResumeVersion
from app.models.user import AspirantProfile, CareerTrack, User
from app.modules.resume import ai_service
from app.modules.resume.schemas import (
    AIGenerateResumeResponse, AIImproveSectionResponse,
    CreateResumeRequest, ResumeDetail, ResumeSummary,
    ResumeTemplateOut, ResumeSectionOut, UpdateResumeRequest,
    UpsertSectionRequest, SectionReorderItem, ImportParsedRequest,
    ParsedResumeData, SetJobTargetRequest, KeywordGapOut, BulletRewriteOut,
)


class AiGenerateJobContext(BaseModel):
    """Optional job context passed by the frontend when user has an active prep job."""
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    required_skills: Optional[list[str]] = None
    job_description: Optional[str] = None

logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_resume_or_404(resume_id: str, user_id, db: Session) -> Resume:
    resume = (
        db.query(Resume)
        .filter(Resume.id == resume_id, Resume.user_id == user_id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")
    return resume


def _build_summary(resume: Resume) -> ResumeSummary:
    return ResumeSummary(
        id=str(resume.id),
        title=resume.title,
        is_primary=resume.is_primary,
        ats_score=resume.ats_score,
        score_breakdown=resume.score_breakdown,
        career_track_name=resume.career_track.title if resume.career_track else None,
        template_name=resume.template.name if resume.template else None,
        section_count=len(resume.sections),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


def _snapshot_version(resume: Resume, db: Session, ai_generated: bool = False) -> None:
    """Save a snapshot of current sections as a new version."""
    latest = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume.id)
        .order_by(ResumeVersion.version_num.desc())
        .first()
    )
    next_num = (latest.version_num + 1) if latest else 1

    content = {
        "sections": [
            {"type": s.section_type, "title": s.title, "content": s.content, "order": s.sort_order}
            for s in resume.sections
        ]
    }
    db.add(ResumeVersion(
        resume_id=resume.id,
        version_num=next_num,
        content=content,
        ai_generated=ai_generated,
    ))


# ─── CRUD ─────────────────────────────────────────────────────────────────────

def list_resumes(user: User, db: Session) -> list[ResumeSummary]:
    resumes = (
        db.query(Resume)
        .options(
            joinedload(Resume.sections),
            joinedload(Resume.template),
            joinedload(Resume.career_track),
        )
        .filter(Resume.user_id == user.id, Resume.deleted_at == None)
        .order_by(Resume.updated_at.desc())
        .all()
    )
    return [_build_summary(r) for r in resumes]


def get_resume(resume_id: str, user: User, db: Session) -> ResumeDetail:
    resume = (
        db.query(Resume)
        .options(
            joinedload(Resume.sections),
            joinedload(Resume.template),
            joinedload(Resume.career_track),
        )
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")

    sections_out = [
        ResumeSectionOut(
            id=str(s.id),
            section_type=s.section_type,
            title=s.title,
            content=s.content or {},
            sort_order=s.sort_order,
            ai_improved=s.ai_improved,
        )
        for s in resume.sections
    ]
    return ResumeDetail(**_build_summary(resume).model_dump(), sections=sections_out)


def create_resume(body: CreateResumeRequest, user: User, db: Session) -> ResumeDetail:
    resume = Resume(
        user_id=user.id,
        title=body.title,
        career_track_id=body.career_track_id,
        template_id=body.template_id,
    )
    db.add(resume)
    db.flush()
    db.commit()
    db.refresh(resume)
    return get_resume(str(resume.id), user, db)


def update_resume(resume_id: str, body: UpdateResumeRequest, user: User, db: Session) -> ResumeDetail:
    resume = _get_resume_or_404(resume_id, user.id, db)

    if body.title is not None:
        resume.title = body.title
    if body.career_track_id is not None:
        resume.career_track_id = body.career_track_id
    if body.template_id is not None:
        resume.template_id = body.template_id
    if body.is_primary is not None:
        if body.is_primary:
            # Clear primary flag from others
            db.query(Resume).filter(
                Resume.user_id == user.id, Resume.id != resume_id
            ).update({"is_primary": False})
        resume.is_primary = body.is_primary

    resume.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_resume(resume_id, user, db)


def delete_resume(resume_id: str, user: User, db: Session) -> None:
    resume = _get_resume_or_404(resume_id, user.id, db)
    resume.deleted_at = datetime.now(timezone.utc)
    db.commit()


def delete_section(resume_id: str, section_id: str, user: User, db: Session) -> None:
    """Hard-delete a single section from a resume."""
    _get_resume_or_404(resume_id, user.id, db)  # ownership check
    section = (
        db.query(ResumeSection)
        .filter(ResumeSection.id == section_id, ResumeSection.resume_id == resume_id)
        .first()
    )
    if not section:
        raise ValueError("Section not found.")
    db.delete(section)
    db.commit()


def reorder_sections(
    resume_id: str,
    items: list[SectionReorderItem],
    user: User,
    db: Session,
) -> None:
    """Persist drag-to-reorder: bulk-update sort_order for the given section list."""
    _get_resume_or_404(resume_id, user.id, db)

    section_ids = [item.section_id for item in items]
    sections = (
        db.query(ResumeSection)
        .filter(ResumeSection.resume_id == resume_id, ResumeSection.id.in_(section_ids))
        .all()
    )

    section_map = {str(s.id): s for s in sections}
    for item in items:
        section = section_map.get(item.section_id)
        if section:
            section.sort_order = item.sort_order

    db.commit()


def upsert_section(
    resume_id: str,
    body: UpsertSectionRequest,
    user: User,
    db: Session,
) -> ResumeSectionOut:
    resume = _get_resume_or_404(resume_id, user.id, db)

    existing = (
        db.query(ResumeSection)
        .filter(
            ResumeSection.resume_id == resume_id,
            ResumeSection.section_type == body.section_type,
        )
        .first()
    )

    if existing:
        existing.title = body.title or existing.title
        existing.content = body.content
        existing.sort_order = body.sort_order
        existing.updated_at = datetime.now(timezone.utc)
        section = existing
    else:
        section = ResumeSection(
            resume_id=resume_id,
            section_type=body.section_type,
            title=body.title,
            content=body.content,
            sort_order=body.sort_order,
        )
        db.add(section)

    # Recompute score breakdown (stores breakdown + overall ATS score)
    db.flush()
    all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
    sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
    breakdown = ai_service.compute_score_breakdown(sections_raw, job_description=resume.target_job_description)
    resume.ats_score = breakdown["overall"]
    resume.score_breakdown = breakdown
    resume.updated_at = datetime.now(timezone.utc)
    db.commit()

    return ResumeSectionOut(
        id=str(section.id),
        section_type=section.section_type,
        title=section.title,
        content=section.content or {},
        sort_order=section.sort_order,
        ai_improved=section.ai_improved,
    )


def list_templates(db: Session) -> list[ResumeTemplateOut]:
    templates = db.query(ResumeTemplate).filter(ResumeTemplate.is_active == True).all()
    return [
        ResumeTemplateOut(
            id=str(t.id),
            name=t.name,
            description=t.description,
            template_type=t.template_type,
            thumbnail_url=t.thumbnail_url,
        )
        for t in templates
    ]


def get_versions(resume_id: str, user: User, db: Session) -> list:
    _get_resume_or_404(resume_id, user.id, db)
    versions = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume_id)
        .order_by(ResumeVersion.version_num.desc())
        .all()
    )
    return [
        {"id": str(v.id), "version_num": v.version_num, "ai_generated": v.ai_generated, "created_at": v.created_at}
        for v in versions
    ]


def save_version(resume_id: str, user: User, db: Session) -> dict:
    resume = (
        db.query(Resume)
        .options(joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")
    _snapshot_version(resume, db)
    db.commit()
    return {"message": "Version saved."}


# ─── AI Features ─────────────────────────────────────────────────────────────

async def ai_improve_section(
    resume_id: str,
    section_id: str,
    career_context: str | None,
    user: User,
    db: Session,
) -> AIImproveSectionResponse:
    """Use AI to improve a specific resume section in-place."""
    _get_resume_or_404(resume_id, user.id, db)

    section = (
        db.query(ResumeSection)
        .filter(ResumeSection.id == section_id, ResumeSection.resume_id == resume_id)
        .first()
    )
    if not section:
        raise ValueError("Section not found.")

    original = dict(section.content or {})

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_improve_prompt(
            section.section_type, original, career_context
        )
        response = await provider.complete(system_prompt, [{"role": "user", "content": user_prompt}])
        improved = ai_service.parse_ai_resume_response(response.content)

        section.content = improved
        section.ai_improved = True
        section.updated_at = datetime.now(timezone.utc)

        # Recompute ATS
        all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
        sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if resume:
            resume.ats_score = ai_service.compute_ats_score(sections_raw)
        db.commit()

        return AIImproveSectionResponse(
            section_id=section_id,
            improved_content=improved,
            original_content=original,
        )

    except Exception as exc:
        logger.error(f"[RESUME AI] Section improvement failed: {exc}")
        raise ValueError(f"AI improvement failed: {exc}")


async def ai_generate_resume(
    resume_id: str,
    user: User,
    db: Session,
    job_context: AiGenerateJobContext | None = None,
) -> AIGenerateResumeResponse:
    """Generate full resume content from aspirant profile using AI."""
    resume = (
        db.query(Resume)
        .options(joinedload(Resume.career_track), joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        raise ValueError("Aspirant profile not found. Complete onboarding first.")

    career_track = resume.career_track
    if not career_track and resume.career_track_id:
        career_track = db.query(CareerTrack).filter(CareerTrack.id == resume.career_track_id).first()

    # Snapshot existing sections before overwriting
    if resume.sections:
        _snapshot_version(resume, db, ai_generated=False)
        db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_generation_prompt(
            profile, career_track, job_context=job_context
        )
        response = await provider.complete(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=3000,   # full resume JSON needs ~2500 tokens; 1500 cuts it off
            temperature=0.3,   # low temp = structured, consistent JSON output
        )
        parsed = ai_service.parse_ai_resume_response(response.content)
        section_data = ai_service.ai_response_to_sections(parsed)

        for sec_info in section_data:
            db.add(ResumeSection(resume_id=resume_id, **sec_info))

        db.flush()

        all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
        sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
        ats = ai_service.compute_ats_score(sections_raw)
        resume.ats_score = ats
        resume.updated_at = datetime.now(timezone.utc)

        # Snapshot the AI-generated result
        db.flush()
        _snapshot_version(resume, db, ai_generated=True)
        db.commit()

        return AIGenerateResumeResponse(
            resume_id=resume_id,
            message="Resume generated successfully.",
            sections_created=len(section_data),
            ats_score=ats,
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"[RESUME AI] Generation failed for user={user.id}: {exc}")
        raise ValueError(f"AI generation failed: {exc}")


async def ai_generate_resume_stream(
    resume_id: str,
    user: User,
    db: Session,
    job_context: AiGenerateJobContext | None = None,
    answers: dict[str, str] | None = None,
):
    """
    Interactive resume co-pilot: emits step/question/section/error/complete events
    so the frontend can show real-time progress and pause for clarification.

    Yields plain dicts — the router serialises them as SSE 'data:' JSON lines.
    """
    import asyncio

    answers = answers or {}

    resume = (
        db.query(Resume)
        .options(joinedload(Resume.career_track), joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        yield {"type": "error", "message": "Resume not found."}
        return

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        yield {"type": "error", "message": "Aspirant profile not found. Complete onboarding first."}
        return

    career_track = resume.career_track
    if not career_track and resume.career_track_id:
        career_track = db.query(CareerTrack).filter(CareerTrack.id == resume.career_track_id).first()

    yield {"type": "step", "label": "Analysing your profile..."}
    await asyncio.sleep(0.2)

    question = ai_service.get_next_question(profile, career_track, job_context, answers)
    if question:
        yield {"type": "question", **question}
        return

    yield {"type": "step", "label": "Understanding your target role..."}
    await asyncio.sleep(0.2)
    yield {"type": "step", "label": "Generating resume content..."}

    if resume.sections:
        _snapshot_version(resume, db, ai_generated=False)
        db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_generation_prompt(
            profile, career_track, job_context=job_context, answers=answers,
        )
        response = await provider.complete(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=3000,
            temperature=0.3,
        )
        parsed = ai_service.parse_ai_resume_response(response.content)
        section_data = ai_service.ai_response_to_sections(parsed)

        section_labels = {
            "summary": "Professional Summary",
            "experience": "Experience",
            "education": "Education",
            "skills": "Skills",
            "achievements": "Achievements",
            "projects": "Projects",
        }

        for sec_info in section_data:
            db.add(ResumeSection(resume_id=resume_id, **sec_info))
            db.flush()
            yield {
                "type": "section_done",
                "section_type": sec_info["section_type"],
                "label": section_labels.get(sec_info["section_type"], sec_info["section_type"]),
                "content": sec_info["content"],
            }
            await asyncio.sleep(0.25)

        all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
        sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
        ats = ai_service.compute_ats_score(sections_raw)
        resume.ats_score = ats
        resume.updated_at = datetime.now(timezone.utc)

        db.flush()
        _snapshot_version(resume, db, ai_generated=True)
        db.commit()

        yield {
            "type": "complete",
            "message": "Resume generated successfully.",
            "sections_created": len(section_data),
            "ats_score": ats,
        }

    except Exception as exc:
        db.rollback()
        logger.error(f"[RESUME AI] Stream generation failed for user={user.id}: {exc}")
        yield {"type": "error", "message": f"AI generation failed: {exc}"}


# ─── Resume file parsing ──────────────────────────────────────────────────────

_PDF_MAGIC = b"%PDF"
_DOCX_MAGIC = b"PK\x03\x04"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _extract_text_from_pdf(content: bytes) -> str:
    """Extract plain text from a PDF file using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        pages = []
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return "\n".join(pages).strip()
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}")


def _extract_text_from_docx(content: bytes) -> str:
    """Extract plain text from a DOCX file using python-docx."""
    try:
        import io
        from docx import Document
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs).strip()
    except Exception as exc:
        raise ValueError(f"Could not read DOCX: {exc}")


async def parse_resume_file(content: bytes, filename: str) -> ParsedResumeData:
    """
    Extract text from a PDF or DOCX file (verified by magic bytes),
    send to LLM for structured parsing, and return the parsed data
    for user confirmation — does NOT write to the database.
    """
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("File exceeds 5 MB limit.")

    if content[:4] == _PDF_MAGIC:
        text = _extract_text_from_pdf(content)
    elif content[:4] == _DOCX_MAGIC:
        text = _extract_text_from_docx(content)
    else:
        raise ValueError("Only PDF and DOCX files are supported. Verify file is not corrupted.")

    if not text or len(text.strip()) < 50:
        raise ValueError("No readable text found in the file. It may be scanned or image-based.")

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_parse_prompt(text)
        response = await provider.complete(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=2500,
            temperature=0.1,
        )
        parsed_dict = ai_service.parse_ai_resume_response(response.content)
        return ParsedResumeData(**{k: parsed_dict.get(k) for k in ParsedResumeData.model_fields})
    except Exception as exc:
        logger.error(f"[RESUME PARSE] LLM parsing failed: {exc}")
        raise ValueError(f"AI parsing failed: {exc}")


def import_parsed_resume(body: ImportParsedRequest, user: User, db: Session) -> ResumeDetail:
    """
    Accept confirmed parsed resume data, create a Resume + sections, and return detail.
    Called after the user reviews and confirms the parsed data on the frontend.
    """
    resume = Resume(
        user_id=user.id,
        title=body.title,
        career_track_id=body.career_track_id,
        template_id=body.template_id,
    )
    db.add(resume)
    db.flush()

    section_data = ai_service.parsed_resume_to_sections(body.parsed_data.model_dump())
    for sec_info in section_data:
        db.add(ResumeSection(resume_id=resume.id, **sec_info))

    db.flush()
    all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume.id).all()
    sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
    breakdown = ai_service.compute_score_breakdown(sections_raw)
    resume.ats_score = breakdown["overall"]
    resume.score_breakdown = breakdown
    db.commit()
    db.refresh(resume)

    return get_resume(str(resume.id), user, db)


def set_job_target(resume_id: str, body: SetJobTargetRequest, user: User, db: Session) -> dict:
    """Store a job description target on the resume and trigger score recalculation."""
    resume = (
        db.query(Resume)
        .options(joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")

    jd_text = body.job_description

    if body.job_posting_id and not jd_text:
        from app.models.mvp3 import JobPosting
        job = db.query(JobPosting).filter(JobPosting.id == body.job_posting_id).first()
        if job:
            jd_text = f"{job.title} at {job.company_name}. {job.description or ''}"

    resume.target_job_description = jd_text
    resume.updated_at = datetime.now(timezone.utc)

    # Recompute score breakdown with keyword coverage now populated
    sections_raw = [{"section_type": s.section_type, "content": s.content} for s in resume.sections]
    breakdown = ai_service.compute_score_breakdown(sections_raw, job_description=jd_text)
    resume.ats_score = breakdown["overall"]
    resume.score_breakdown = breakdown
    db.commit()

    return {"message": "Job target saved.", "score_breakdown": breakdown}


async def keyword_gap(
    resume_id: str,
    job_description: str,
    user: User,
    db: Session,
) -> KeywordGapOut:
    """Analyze keyword gap between the resume and a job description via LLM."""
    resume = (
        db.query(Resume)
        .options(joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")

    import json as _json
    resume_text = " ".join(
        _json.dumps(s.content or {}) for s in resume.sections
    )

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_keyword_gap_prompt(resume_text, job_description)
        response = await provider.complete(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=800,
            temperature=0.1,
        )
        parsed = ai_service.parse_ai_resume_response(response.content)
        return KeywordGapOut(
            matched=parsed.get("matched", []),
            missing_critical=parsed.get("missing_critical", []),
            missing_nice_to_have=parsed.get("missing_nice_to_have", []),
            match_score=max(0, min(100, int(parsed.get("match_score", 0)))),
        )
    except Exception as exc:
        logger.error(f"[RESUME] Keyword gap failed: {exc}")
        raise ValueError(f"Keyword gap analysis failed: {exc}")


async def rewrite_bullet(
    resume_id: str,
    section_id: str,
    bullet_text: str,
    role_context: str | None,
    user: User,
    db: Session,
) -> BulletRewriteOut:
    """Rewrite a single resume bullet with stronger action verb + outcome structure."""
    _get_resume_or_404(resume_id, user.id, db)

    section = (
        db.query(ResumeSection)
        .filter(ResumeSection.id == section_id, ResumeSection.resume_id == resume_id)
        .first()
    )
    if not section:
        raise ValueError("Section not found.")

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        system_prompt, user_prompt = ai_service.build_bullet_rewrite_prompt(bullet_text, role_context)
        response = await provider.complete(
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        parsed = ai_service.parse_ai_resume_response(response.content)
        return BulletRewriteOut(
            original=bullet_text,
            improved=parsed.get("improved", bullet_text),
        )
    except Exception as exc:
        logger.error(f"[RESUME] Bullet rewrite failed: {exc}")
        raise ValueError(f"Bullet rewrite failed: {exc}")


def restore_version(resume_id: str, version_id: str, user: User, db: Session) -> ResumeDetail:
    """Replace current sections with the content snapshot from a prior version."""
    resume = (
        db.query(Resume)
        .options(joinedload(Resume.sections))
        .filter(Resume.id == resume_id, Resume.user_id == user.id, Resume.deleted_at == None)
        .first()
    )
    if not resume:
        raise ValueError("Resume not found.")

    version = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.id == version_id, ResumeVersion.resume_id == resume_id)
        .first()
    )
    if not version:
        raise ValueError("Version not found.")

    # Snapshot current state before overwriting
    if resume.sections:
        _snapshot_version(resume, db, ai_generated=False)

    # Delete current sections
    db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()
    db.flush()

    # Restore from snapshot
    for sec in (version.content or {}).get("sections", []):
        db.add(ResumeSection(
            resume_id=resume_id,
            section_type=sec.get("type", "summary"),
            title=sec.get("title"),
            content=sec.get("content", {}),
            sort_order=sec.get("order", 0),
        ))

    db.flush()
    all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
    sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
    breakdown = ai_service.compute_score_breakdown(sections_raw, job_description=resume.target_job_description)
    resume.ats_score = breakdown["overall"]
    resume.score_breakdown = breakdown
    resume.updated_at = datetime.now(timezone.utc)
    db.commit()

    return get_resume(resume_id, user, db)
