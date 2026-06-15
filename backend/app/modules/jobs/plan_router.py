"""Aspirant-facing endpoints for job-specific AI learning plans."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.job_plan import JobLearningPlan
from app.models.user import AspirantProfile, JobPosting, User
from app.modules.jobs.plan_generator import generate_job_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Job Learning Plan"])


def _get_job_or_404(job_id: str, db: Session) -> JobPosting:
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


def _get_plan(user_id, job_id, db: Session) -> JobLearningPlan | None:
    return (
        db.query(JobLearningPlan)
        .filter(JobLearningPlan.user_id == user_id, JobLearningPlan.job_id == job_id)
        .first()
    )


async def _run_generation(plan_id: str, job: JobPosting, user_skills: list[str], gap_skills: list[str], db: Session):
    """Background task: call AI, update plan row."""
    plan = db.query(JobLearningPlan).filter(JobLearningPlan.id == plan_id).first()
    if not plan:
        return
    try:
        result = await generate_job_plan(
            job_title=job.title,
            company=job.employer.company_name if job.employer else "the company",
            sector=job.sector,
            description=job.description,
            required_skills=job.required_skills or [],
            user_skills=user_skills,
            gap_skills=gap_skills,
        )
        plan.plan = result
        plan.status = "ready"
    except Exception as exc:
        logger.error("Job plan generation failed for plan %s: %s", plan_id, exc, exc_info=True)
        plan.status = "failed"
        plan.error_msg = str(exc)
    db.commit()


@router.post("/{job_id}/learning-plan", status_code=202)
async def generate_plan(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Trigger AI generation of a job-specific learning plan.

    Returns immediately (202). Poll GET /jobs/{job_id}/learning-plan
    until status == 'ready'.
    """
    job = _get_job_or_404(job_id, db)

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    user_skills: list[str] = profile.skills or [] if profile else []

    # Compute gap skills: required - user has
    required: list[str] = job.required_skills or []
    user_skill_set = {s.lower().strip() for s in user_skills}
    gap_skills = [s for s in required if s.lower().strip() not in user_skill_set]

    # Upsert plan row
    plan = _get_plan(user.id, job_id, db)
    if plan:
        # Regenerate: reset to generating state
        plan.status = "generating"
        plan.plan = {}
        plan.error_msg = None
        plan.generated_at = datetime.now(timezone.utc)
        db.commit()
        plan_id = str(plan.id)
    else:
        plan = JobLearningPlan(
            user_id=user.id,
            job_id=job_id,
            status="generating",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        plan_id = str(plan.id)

    # Load job employer before handing off to background
    # (avoid lazy-load issues in background task)
    job_snapshot = {
        "title": job.title,
        "company": job.employer.company_name if job.employer else "the company",
        "sector": job.sector,
        "description": job.description,
        "required_skills": job.required_skills or [],
    }

    async def _bg(pid=plan_id, js=job_snapshot, us=user_skills, gs=gap_skills):
        import asyncio
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_plan = bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
            if not bg_plan:
                return
            try:
                result = await generate_job_plan(
                    job_title=js["title"],
                    company=js["company"],
                    sector=js["sector"],
                    description=js["description"],
                    required_skills=js["required_skills"],
                    user_skills=us,
                    gap_skills=gs,
                )
                bg_plan.plan = result
                bg_plan.status = "ready"
            except Exception as exc:
                logger.error("Plan gen failed %s: %s", pid, exc, exc_info=True)
                bg_plan.status = "failed"
                bg_plan.error_msg = str(exc)
            bg_db.commit()
        finally:
            bg_db.close()

    background_tasks.add_task(_bg)

    return {"plan_id": plan_id, "status": "generating", "message": "Plan generation started. Poll GET /jobs/{job_id}/learning-plan."}


@router.get("/{job_id}/learning-plan")
def get_plan(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Fetch the learning plan and current progress for a job."""
    _get_job_or_404(job_id, db)
    plan = _get_plan(user.id, job_id, db)
    if not plan:
        return {"status": "not_generated", "plan": None, "progress": {}}

    return {
        "status": plan.status,
        "plan": plan.plan if plan.status == "ready" else None,
        "progress": plan.progress or {},
        "generated_at": plan.generated_at.isoformat() if plan.generated_at else None,
        "error": plan.error_msg if plan.status == "failed" else None,
    }


@router.patch("/{job_id}/learning-plan/progress")
def update_progress(
    job_id: str,
    body: dict,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Mark a resource as done or undone.

    Body: { "resource_id": str, "done": bool }
    """
    resource_id: str = body.get("resource_id", "")
    done: bool = bool(body.get("done", False))

    if not resource_id:
        raise HTTPException(status_code=422, detail="resource_id is required.")

    plan = _get_plan(user.id, job_id, db)
    if not plan or plan.status != "ready":
        raise HTTPException(status_code=404, detail="No ready plan found for this job.")

    progress = dict(plan.progress or {})
    progress[resource_id] = {
        "done": done,
        "done_at": datetime.now(timezone.utc).isoformat() if done else None,
    }
    plan.progress = progress
    db.commit()

    # Compute overall completion %
    all_resource_ids: list[str] = []
    for mod in (plan.plan or {}).get("modules", []):
        for res in mod.get("resources", []):
            all_resource_ids.append(res["id"])

    done_count = sum(1 for rid in all_resource_ids if progress.get(rid, {}).get("done"))
    total = len(all_resource_ids)

    return {
        "resource_id": resource_id,
        "done": done,
        "completed": done_count,
        "total": total,
        "pct": round(done_count / total * 100) if total else 0,
    }
