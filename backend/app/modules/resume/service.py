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
    UpsertSectionRequest,
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

    # Recompute ATS score
    db.flush()
    all_sections = db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).all()
    sections_raw = [{"section_type": s.section_type, "content": s.content} for s in all_sections]
    resume.ats_score = ai_service.compute_ats_score(sections_raw)
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
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()
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
        from app.ai.providers.groq import GroqProvider
        provider = GroqProvider()
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
