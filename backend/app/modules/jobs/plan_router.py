"""Aspirant-facing endpoints for job-specific AI learning plans."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.job_plan import JobLearningPlan
from app.models.user import AspirantProfile, JobPosting, KrsScore, PsychologicalAssessment, User
from app.modules.jobs.plan_generator import (
    count_article_resources, count_youtube_resources,
    enrich_plan_with_real_videos, generate_job_plan, generate_module_quiz,
    is_plan_stale, redact_quiz_answers,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Job Learning Plan"])


def _tokenize(skill: str) -> set[str]:
    return set(re.split(r"[\s\-/,]+", skill.lower().strip())) - {""}


def _skill_covered(required: str, user_skill_set: set[str], user_tokens: list[set[str]]) -> bool:
    """Return True if the user already has this skill under any reasonable form.

    Checks in order (cheapest first):
    1. Exact normalized match ("python" == "python")
    2. Token overlap: ≥ 60 % of the required skill's tokens appear in any single
       user skill ("Python 3" covers "Python"; "Data Analysis" covers "Data Analytics" partially)
    3. Fuzzy similarity ≥ 0.82 via SequenceMatcher ("MS Excel" ~ "Microsoft Excel")
    """
    norm = required.lower().strip()
    if norm in user_skill_set:
        return True

    req_tokens = _tokenize(required)
    if req_tokens:
        for ut in user_tokens:
            overlap = len(req_tokens & ut) / len(req_tokens)
            if overlap >= 0.6:
                return True

    for us in user_skill_set:
        if SequenceMatcher(None, norm, us).ratio() >= 0.82:
            return True

    return False


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


def _plan_progress_pct(plan: JobLearningPlan) -> int:
    if plan.status != "ready" or not plan.plan:
        return 0
    resources = [r for m in plan.plan.get("modules", []) for r in m.get("resources", [])]
    if not resources:
        return 0
    done = sum(1 for r in resources if (plan.progress or {}).get(r["id"], {}).get("done"))
    return round((done / len(resources)) * 100)


@router.get("/learning-plans/mine")
def get_my_learning_plans(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """List every job-specific AI plan the user has ever generated — the per-job
    equivalent of /roadmap/all, so switching to a new active job doesn't bury
    the plans generated for previous ones."""
    from app.models.user import EmployerProfile

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    active_job_id = str(profile.active_prep_job_id) if profile and profile.active_prep_job_id else None

    plans = (
        db.query(JobLearningPlan)
        .filter(JobLearningPlan.user_id == user.id)
        .order_by(JobLearningPlan.updated_at.desc())
        .all()
    )
    out = []
    for p in plans:
        job = db.query(JobPosting).filter(JobPosting.id == p.job_id).first()
        if not job:
            continue
        employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        out.append({
            "job_id": str(p.job_id),
            "job_title": job.title,
            "company_name": employer.company_name if employer else "Company",
            "status": p.status,
            "progress_pct": _plan_progress_pct(p),
            "generated_at": p.generated_at.isoformat() if p.generated_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "is_active": str(p.job_id) == active_job_id,
            # Lets the roadmap list flag plans for jobs that have since closed —
            # previously these stayed in the list indistinguishable from open ones.
            "job_is_open": bool(job.is_active),
        })
    return out


@router.delete("/{job_id}/learning-plan", status_code=200)
def delete_plan(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Delete a generated roadmap for a job. If it's the user's active prep job,
    clears that pointer too so prep tools revert to generic mode."""
    plan = _get_plan(user.id, job_id, db)
    if not plan:
        raise HTTPException(status_code=404, detail="No roadmap found for this job.")

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if profile and str(profile.active_prep_job_id) == str(job_id):
        profile.active_prep_job_id = None

    db.delete(plan)
    db.commit()
    return {"job_id": job_id, "deleted": True}


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
    krs = db.query(KrsScore).filter(KrsScore.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()

    user_skills: list[str] = profile.skills or [] if profile else []

    # Compute gap skills: required - user has (fuzzy-matched)
    required: list[str] = job.required_skills or []
    user_skill_set = {s.lower().strip() for s in user_skills}
    user_tokens = [_tokenize(s) for s in user_skills]
    gap_skills = [s for s in required if not _skill_covered(s, user_skill_set, user_tokens)]
    gaps_will_be_grouped = len(gap_skills) > 7

    # Upsert plan row
    plan = _get_plan(user.id, job_id, db)
    if plan and plan.status == "generating":
        # Already in flight — don't spawn a second task that would race to overwrite the result.
        return {"plan_id": str(plan.id), "status": "generating", "message": "Plan generation already in progress. Poll GET /jobs/{job_id}/learning-plan."}
    if plan:
        # Regenerate: reset to generating state
        plan.status = "generating"
        plan.generation_step = "agenda"
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
            generation_step="agenda",
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

    # Snapshot user context — passed to generate_job_plan for prompt personalisation
    user_context_snapshot = {
        "k_score": krs.k_score if krs else None,
        "r_score": krs.r_score if krs else None,
        "s_score": krs.s_score if krs else None,
        "burnout_score": psych.burnout_score if psych else None,
        "confidence_score": psych.confidence_index if psych else None,
        "work_experience_years": profile.work_experience_years if profile else None,
        "work_experience_domain": profile.work_experience_domain if profile else None,
        # UPSC journey — collected in onboarding but previously never reached the AI
        "upsc_exam": profile.upsc_exam if profile else None,
        "highest_stage_cleared": profile.highest_stage_cleared if profile else None,
        "years_preparing": profile.years_preparing if profile else None,
        "optional_subject": profile.optional_subject if profile else None,
        # Career preferences
        "preferred_sectors": profile.preferred_sectors if profile else None,
    }

    class _Cancelled(Exception):
        pass

    async def _bg(pid=plan_id, js=job_snapshot, us=user_skills, gs=gap_skills, uc=user_context_snapshot, jid=job_id):
        from app.database import SessionLocal
        bg_db = SessionLocal()

        def _set_step(step: str, detail: dict | None = None):
            values = {"generation_step": step}
            if detail is not None:
                values["generation_detail"] = detail
            bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).update(values)
            bg_db.commit()

        def _still_generating() -> bool:
            """The user can cancel by deleting the plan row (DELETE /jobs/{id}/learning-plan)
            while it's still generating. Check between steps and bail out cooperatively —
            we can't interrupt a single in-flight LLM call, but we stop before the next one."""
            current = bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
            return current is not None and current.status == "generating"

        try:
            bg_plan = bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
            if not bg_plan:
                return
            try:
                # Step 1: ask the LLM to draft the module/resource structure.
                _set_step("agenda", {})
                result = await generate_job_plan(
                    job_title=js["title"],
                    company=js["company"],
                    sector=js["sector"],
                    description=js["description"],
                    required_skills=js["required_skills"],
                    user_skills=us,
                    gap_skills=gs,
                    job_id=jid,
                    k_score=uc.get("k_score"),
                    r_score=uc.get("r_score"),
                    s_score=uc.get("s_score"),
                    burnout_score=uc.get("burnout_score"),
                    confidence_score=uc.get("confidence_score"),
                    work_experience_years=uc.get("work_experience_years"),
                    work_experience_domain=uc.get("work_experience_domain"),
                    upsc_exam=uc.get("upsc_exam"),
                    highest_stage_cleared=uc.get("highest_stage_cleared"),
                    years_preparing=uc.get("years_preparing"),
                    optional_subject=uc.get("optional_subject"),
                    preferred_sectors=uc.get("preferred_sectors"),
                )

                if not _still_generating():
                    raise _Cancelled()

                # Step 2: enrich resources with real URLs (YouTube videos + article links).
                # Compute the true total now so the frontend progress bar never goes backward.
                resources_total = count_youtube_resources(result) + count_article_resources(result)
                _set_step("resources", {
                    "modules_planned": len(result.get("modules", [])),
                    "resources_done": 0,
                    "resources_total": resources_total,
                    "current_skill": None,
                    "last_found": None,
                })

                async def _on_progress(detail: dict):
                    if not _still_generating():
                        raise _Cancelled()
                    _set_step("resources", detail)

                result = await enrich_plan_with_real_videos(result, on_progress=_on_progress)

                if not _still_generating():
                    raise _Cancelled()

                # Step 3: finalize and persist.
                _set_step("finalizing", {"modules_planned": len(result.get("modules", []))})
                bg_plan = bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
                bg_plan.plan = result
                bg_plan.status = "ready"
                bg_db.commit()
            except _Cancelled:
                logger.info("Plan generation %s cancelled by user.", pid)
            except Exception as exc:
                logger.error("Plan gen failed %s: %s", pid, exc, exc_info=True)
                bg_plan = bg_db.query(JobLearningPlan).filter(JobLearningPlan.id == pid).first()
                if bg_plan:
                    bg_plan.status = "failed"
                    bg_plan.error_msg = str(exc)
                    bg_db.commit()
        finally:
            bg_db.close()

    background_tasks.add_task(_bg)

    return {
        "plan_id": plan_id,
        "status": "generating",
        "message": "Plan generation started. Poll GET /jobs/{job_id}/learning-plan.",
        "gaps_will_be_grouped": gaps_will_be_grouped,
        "gap_count": len(gap_skills),
    }


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

    ready_plan = plan.plan if plan.status == "ready" else None
    return {
        "status": plan.status,
        "plan": redact_quiz_answers(ready_plan),
        "progress": plan.progress or {},
        "generation_step": plan.generation_step,
        "generation_detail": plan.generation_detail or {},
        "generated_at": plan.generated_at.isoformat() if plan.generated_at else None,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        "error": plan.error_msg if plan.status == "failed" else None,
        # True if this is an old plan generated before real-video enrichment or quizzes
        # existed — the frontend can use this to prompt/auto-trigger a one-time regeneration.
        "stale": is_plan_stale(ready_plan),
    }


@router.post("/{job_id}/learning-plan/modules/{module_id}/quiz/generate")
async def generate_module_quiz_endpoint(
    job_id: str,
    module_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Generate a quiz for ONE module, on demand — only when the user clicks the
    button, scoped to just that module's skill context (not the whole plan)."""
    plan = _get_plan(user.id, job_id, db)
    if not plan or plan.status != "ready":
        raise HTTPException(status_code=404, detail="Plan not ready.")
    job = _get_job_or_404(job_id, db)

    modules = plan.plan.get("modules", [])
    module = next((m for m in modules if m.get("id") == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    try:
        quiz = await generate_module_quiz(
            job_title=plan.plan.get("job_title", "this role"),
            sector=job.sector or "",
            skill=module.get("skill", ""),
            why_important=module.get("why_important", ""),
            resources=module.get("resources", []),
        )
    except Exception as exc:
        logger.error("Quiz generation failed for module %s: %s", module_id, exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Quiz generation failed: {exc}")

    # Reassign plan.plan (new dict) so SQLAlchemy detects the JSONB change.
    new_modules = [
        {**m, "quiz": quiz} if m.get("id") == module_id else m
        for m in modules
    ]
    plan.plan = {**plan.plan, "modules": new_modules}
    db.commit()

    return redact_quiz_answers({"modules": [m for m in new_modules if m.get("id") == module_id]})["modules"][0]["quiz"]


@router.post("/{job_id}/learning-plan/modules/{module_id}/quiz/submit")
def submit_quiz(
    job_id: str,
    module_id: str,
    body: dict,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Grade a module's quiz. Body: { "answers": [{"question_id", "selected_option_id"}] }."""
    plan = _get_plan(user.id, job_id, db)
    if not plan or plan.status != "ready":
        raise HTTPException(status_code=404, detail="Plan not ready.")

    module = next((m for m in plan.plan.get("modules", []) if m.get("id") == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")
    questions = module.get("quiz", {}).get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="This module has no quiz.")

    answers = {a["question_id"]: a["selected_option_id"] for a in body.get("answers", [])}
    results = []
    correct_count = 0
    for q in questions:
        selected = answers.get(q["id"])
        is_correct = selected == q["correct_option_id"]
        if is_correct:
            correct_count += 1
        results.append({
            "question_id": q["id"],
            "selected_option_id": selected,
            "correct_option_id": q["correct_option_id"],
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })

    score_pct = round((correct_count / len(questions)) * 100)
    passed = score_pct >= 70

    progress = dict(plan.progress or {})
    progress[f"quiz_{module_id}"] = {
        "score_pct": score_pct,
        "passed": passed,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    plan.progress = progress
    db.commit()

    retry_guidance: dict | None = None
    if not passed:
        wrong_results = [r for r in results if not r["is_correct"]]
        wrong_count = len(wrong_results)

        # Pull the explanations from wrong answers so the user knows exactly what they missed.
        missed_explanations = [r["explanation"] for r in wrong_results if r.get("explanation")]

        # Return the module's resources so the frontend can tell the user what to revisit.
        resources_to_revisit = [
            {"id": res.get("id"), "title": res.get("title"), "type": res.get("type"), "url": res.get("url")}
            for res in module.get("resources", [])
        ]

        retry_guidance = {
            "wrong_count": wrong_count,
            "total_questions": len(questions),
            "message": (
                f"You got {wrong_count} of {len(questions)} questions wrong. "
                f"Review the {len(resources_to_revisit)} resource(s) below before retrying."
            ),
            "missed_explanations": missed_explanations,
            "resources_to_revisit": resources_to_revisit,
        }

    return {"score_pct": score_pct, "passed": passed, "results": results, "retry_guidance": retry_guidance}


@router.patch("/{job_id}/learning-plan/progress")
def update_progress(
    job_id: str,
    body: dict,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Mark a resource done/undone, or rate its selected video.

    Body (mark done): { "resource_id": str, "done": bool }
    Body (rate video): { "resource_id": str, "video_id": str, "video_rating": "relevant"|"not_relevant" }
    Both fields may be combined in one request.
    """
    resource_id: str = body.get("resource_id", "")
    if not resource_id:
        raise HTTPException(status_code=422, detail="resource_id is required.")

    plan = _get_plan(user.id, job_id, db)
    if not plan or plan.status != "ready":
        raise HTTPException(status_code=404, detail="No ready plan found for this job.")

    progress = dict(plan.progress or {})
    entry = dict(progress.get(resource_id, {}))

    if "done" in body:
        done = bool(body["done"])
        entry["done"] = done
        entry["done_at"] = datetime.now(timezone.utc).isoformat() if done else None

    video_id: str | None = body.get("video_id")
    video_rating: str | None = body.get("video_rating")
    if video_id and video_rating:
        if video_rating not in ("relevant", "not_relevant"):
            raise HTTPException(status_code=422, detail="video_rating must be 'relevant' or 'not_relevant'.")
        entry["video_rating"] = {
            "video_id": video_id,
            "rating": video_rating,
            "rated_at": datetime.now(timezone.utc).isoformat(),
        }

        # If the user rejected the recommended video, promote the next available option.
        if video_rating == "not_relevant":
            new_modules = []
            plan_changed = False
            for mod in (plan.plan or {}).get("modules", []):
                new_resources = []
                for res in mod.get("resources", []):
                    if res.get("id") == resource_id and res.get("recommended_video_id") == video_id:
                        options = res.get("video_options") or []
                        alternative = next(
                            (v["video_id"] for v in options if v["video_id"] != video_id),
                            None,
                        )
                        if alternative:
                            res = {**res, "recommended_video_id": alternative}
                            plan_changed = True
                    new_resources.append(res)
                new_modules.append({**mod, "resources": new_resources})
            if plan_changed:
                plan.plan = {**plan.plan, "modules": new_modules}

    progress[resource_id] = entry
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
