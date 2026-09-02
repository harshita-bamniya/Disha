"""Pipeline stage CRUD (Phase F)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException, NotFoundException
from app.models.user import (
    JobPosting,
)

from app.modules.matching.service import core

logger = logging.getLogger(__name__)


def _get_job_for_employer(job_id: str, current_user, db: Session):
    """Fetch job posting, ensuring it belongs to the employer's company."""
    ep = core._get_employer_profile_approved(current_user, db)
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    # Company-wide check — allow all employer profiles in the same company
    company_ids = core._get_company_employer_ids(ep, db)
    if job.employer_id not in company_ids:
        raise AuthException("Not authorised")
    return ep, job


def get_pipeline_stages(job_id: str, current_user, db: Session):
    from app.models.pipeline import JobPipelineStage
    from app.modules.matching.schemas import PipelineStageOut
    _get_job_for_employer(job_id, current_user, db)
    rows = (
        db.query(JobPipelineStage)
        .filter(JobPipelineStage.job_id == job_id)
        .order_by(JobPipelineStage.position)
        .all()
    )
    if not rows:
        # Return system defaults
        defaults = [
            {"applied": ("#3B82F6", 0)},
            {"screening": ("#D97706", 1)},
            {"shortlisted": ("#059669", 2)},
            {"interview_scheduled": ("#6366F1", 3)},
            {"interview_completed": ("#0EA5E9", 4)},
            {"offer_sent": ("#7C3AED", 5)},
            {"hired": ("#059669", 6)},
            {"rejected": ("#DC2626", 7)},
        ]
        LABELS = {
            "applied": "Applied",
            "screening": "Screening",
            "shortlisted": "Shortlisted",
            "interview_scheduled": "Interview",
            "interview_completed": "Interviewed",
            "offer_sent": "Offer Sent",
            "hired": "Hired",
            "rejected": "Rejected",
        }
        stages = []
        for i, d in enumerate(defaults):
            for key, (color, pos) in d.items():
                stages.append(PipelineStageOut(
                    id="",
                    stage_key=key,
                    display_name=LABELS[key],
                    color=color,
                    position=pos,
                    is_visible=True,
                ))
        return stages
    return [PipelineStageOut(
        id=str(r.id), stage_key=r.stage_key, display_name=r.display_name,
        color=r.color, position=r.position, is_visible=r.is_visible,
    ) for r in rows]


def bulk_upsert_pipeline_stages(job_id: str, payload, current_user, db: Session):
    from app.models.pipeline import CUSTOMISABLE_STAGE_KEYS, JobPipelineStage
    _get_job_for_employer(job_id, current_user, db)
    for s in payload.stages:
        if s.stage_key not in CUSTOMISABLE_STAGE_KEYS:
            raise BadRequestException(f"Invalid stage_key: {s.stage_key}")
    # Delete existing rows for this job, then bulk-insert
    db.query(JobPipelineStage).filter(JobPipelineStage.job_id == job_id).delete()
    for s in payload.stages:
        db.add(JobPipelineStage(
            job_id=job_id,
            stage_key=s.stage_key,
            display_name=s.display_name,
            color=s.color,
            position=s.position,
            is_visible=s.is_visible,
        ))
    db.commit()
    return get_pipeline_stages(job_id, current_user, db)


def list_pipeline_templates(current_user, db: Session):
    from app.models.pipeline import CompanyPipelineTemplate
    from app.modules.matching.schemas import PipelineTemplateOut, PipelineTemplateStage
    ep = core._get_employer_profile_approved(current_user, db)
    if not ep.company_id:
        return []
    rows = (
        db.query(CompanyPipelineTemplate)
        .filter(CompanyPipelineTemplate.company_id == ep.company_id)
        .order_by(CompanyPipelineTemplate.created_at)
        .all()
    )
    result = []
    for r in rows:
        stages = [PipelineTemplateStage(**s) for s in (r.stages or [])]
        result.append(PipelineTemplateOut(id=str(r.id), name=r.name, stages=stages))
    return result


def create_pipeline_template(payload, current_user, db: Session):
    from app.models.pipeline import CUSTOMISABLE_STAGE_KEYS, CompanyPipelineTemplate
    from app.modules.matching.schemas import PipelineTemplateOut, PipelineTemplateStage
    ep = core._get_employer_profile_approved(current_user, db)
    if not ep.company_id:
        raise BadRequestException("Employer is not associated with a company")
    for s in payload.stages:
        if s.stage_key not in CUSTOMISABLE_STAGE_KEYS:
            raise BadRequestException(f"Invalid stage_key: {s.stage_key}")
    tmpl = CompanyPipelineTemplate(
        company_id=ep.company_id,
        name=payload.name,
        stages=[s.dict() for s in payload.stages],
        created_by=current_user.id,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    stages = [PipelineTemplateStage(**s) for s in (tmpl.stages or [])]
    return PipelineTemplateOut(id=str(tmpl.id), name=tmpl.name, stages=stages)


def delete_pipeline_template(template_id: str, current_user, db: Session):
    from app.models.pipeline import CompanyPipelineTemplate
    ep = core._get_employer_profile_approved(current_user, db)
    tmpl = db.query(CompanyPipelineTemplate).filter(
        CompanyPipelineTemplate.id == template_id,
        CompanyPipelineTemplate.company_id == ep.company_id,
    ).first()
    if not tmpl:
        raise NotFoundException("Template not found")
    db.delete(tmpl)
    db.commit()
    return {"deleted": True}


def apply_template_to_job(job_id: str, template_id: str, current_user, db: Session):
    from app.models.pipeline import CompanyPipelineTemplate
    from app.modules.matching.schemas import (
        BulkUpsertPipelineStagesRequest,
        PipelineStageIn,
    )
    ep, _ = _get_job_for_employer(job_id, current_user, db)
    tmpl = db.query(CompanyPipelineTemplate).filter(
        CompanyPipelineTemplate.id == template_id,
        CompanyPipelineTemplate.company_id == ep.company_id,
    ).first()
    if not tmpl:
        raise NotFoundException("Template not found")
    stages = [PipelineStageIn(**s) for s in (tmpl.stages or [])]
    return bulk_upsert_pipeline_stages(
        job_id, BulkUpsertPipelineStagesRequest(stages=stages), current_user, db
    )

