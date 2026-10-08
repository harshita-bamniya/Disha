"""Aspirant-facing endpoints for job-specific AI learning plans."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone

import sentry_sdk
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.job_plan import JobLearningPlan
from app.models.user import (
    AspirantProfile,
    JobPosting,
    KrsScore,
    PsychologicalAssessment,
    User,
)
from app.modules.jobs.plan_generator import (
    count_article_resources,
    count_youtube_resources,
    enrich_plan_with_real_videos,
    expand_job_competencies,
    generate_job_plan,
    generate_module_quiz,
    generate_remedial_resource,
    is_plan_stale,
    redact_quiz_answers,
)
from app.modules.krs.skill_gap import compute_gap
from app.modules.roadmap_engine import ratings as rt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Job Learning Plan"])

# No progress update for this long => the background task is gone (see get_plan).
GENERATION_ORPHAN_SECONDS = 600


def _tokenize(skill: str) -> set[str]:
    return set(re.split(r"[\s\-/,]+", skill.lower().strip())) - {""}


def _quiz_xp_awardable(passed: bool, already_passed: bool) -> bool:
    """XP for a module quiz is awarded on the first pass only — resubmitting
    an already-passed quiz shouldn't be a free XP farm."""
    return passed and not already_passed


def _resource_xp_awardable(done: bool, was_done: bool) -> bool:
    """XP for a resource is awarded on the first mark-done only — toggling
    done/undone/done again shouldn't be a free XP farm."""
    return done and not was_done


REGENERATE_COOLDOWN_SECONDS = 60


def _redis():
    import redis as redis_lib

    from app.config import get_settings
    return redis_lib.from_url(get_settings().redis_url, decode_responses=True)


def _check_and_set_regenerate_cooldown(user_id, job_id) -> int | None:
    """Atomically claims a short-TTL Redis key for this (user, job) pair.
    Returns None if the caller may proceed (and the cooldown is now set), or
    the number of seconds remaining if a generation was already triggered
    too recently. A full generate/regenerate is one 8000-token LLM call plus
    a burst of scraping calls — nothing else stops it being spammed, and the
    atomic SET NX also closes a TOCTOU race the "already generating" DB check
    alone doesn't: two near-simultaneous requests could both read the plan as
    not-yet-"generating" and both spawn a background task.
    Fails open (allows the request) if Redis itself is unreachable — a cache
    outage shouldn't block plan generation."""
    key = f"plan:regen_cooldown:{user_id}:{job_id}"
    try:
        r = _redis()
        if r.set(key, "1", nx=True, ex=REGENERATE_COOLDOWN_SECONDS):
            return None
        ttl = r.ttl(key)
        return ttl if ttl and ttl > 0 else REGENERATE_COOLDOWN_SECONDS
    except Exception as exc:
        logger.warning("Regenerate cooldown check failed (failing open): %s", exc)
        return None


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


def _summarize_interaction_history(
    old_modules: list[dict], progress: dict
) -> tuple[str | None, set[str]]:
    """Summarize a prior plan's progress into a short prompt block for
    regeneration, plus the set of skills that passed their quiz (so the
    caller can exclude them from the regenerated gap list instead of
    silently rebuilding a module for a skill that's already mastered)."""
    mastered_lines: list[str] = []
    failed_lines: list[str] = []
    rejected_video_lines: list[str] = []
    passed_skills: set[str] = set()

    for module in old_modules:
        skill = module.get("skill", "")
        module_id = module.get("id", "")
        quiz_entry = progress.get(f"quiz_{module_id}")
        if quiz_entry:
            if quiz_entry.get("passed"):
                passed_skills.add(skill.lower().strip())
                mastered_lines.append(f"- {skill}: quiz passed ({quiz_entry.get('score_pct')}%) — mastered.")
            else:
                prior_titles = ", ".join(r.get("title", "") for r in module.get("resources", []) if r.get("title"))
                failed_lines.append(
                    f"- {skill}: quiz failed ({quiz_entry.get('score_pct')}%). "
                    f"Previously tried: {prior_titles or 'n/a'}."
                )

        for res in module.get("resources", []):
            rating = (progress.get(res.get("id"), {}) or {}).get("video_rating", {})
            if rating.get("rating") == "not_relevant":
                rejected_video_lines.append(f"- {skill}: marked \"{res.get('title', 'a resource')}\" as not relevant.")

    lines = [*mastered_lines, *failed_lines, *rejected_video_lines]
    if not lines:
        return None, passed_skills
    return "\n".join(lines), passed_skills


def _is_skill_mastered(gap_skill: str, passed_skill_tokens: list[set[str]]) -> bool:
    """Token-overlap check (same threshold as _skill_covered) so a mastered skill
    like 'SQL' still matches a gap-list entry phrased slightly differently."""
    gap_tokens = _tokenize(gap_skill)
    if not gap_tokens:
        return False
    return any(
        len(gap_tokens & pt) / len(gap_tokens) >= 0.6
        for pt in passed_skill_tokens
        if pt
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


class GeneratePlanRequest(BaseModel):
    """Optional: the learner's own 0-3 ratings of the skills this posting asks for."""
    skill_ratings: dict[str, int] = {}


async def _posting_skill_names(db: Session, job) -> list[tuple[str, str, str]]:
    """(name, kind, importance) for the skills THIS posting asks for. Specific skills first. Posting data only."""
    try:
        from app.modules.resume_match.jd_parser import get_or_parse_requirements  # parses the posting only

        parsed = await get_or_parse_requirements(db, job)
        reqs = sorted((r for r in parsed.requirements if r.type != "eligibility"), key=lambda r: r.specificity == "generic")
        return [(r.name, r.specificity, r.importance) for r in reqs][:rt.MAX_RATED]
    except Exception as exc:
        logger.warning("could not parse posting requirements for rating (%s); using selected skills", exc)
        return [(str(n), "specific", "must_have") for n in (job.required_skills or [])][:rt.MAX_RATED]


@router.get("/{job_id}/learning-plan/skills-to-rate")
async def skills_to_rate(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """The skills this job asks for, to be rated 0-3 by the learner before a roadmap is generated."""
    job = _get_job_or_404(job_id, db)
    previous = ((_get_plan(user.id, job_id, db) or JobLearningPlan()).plan or {}).get("self_ratings") or {}
    prev_by_norm = {rt.norm(k): v for k, v in previous.items()}
    return {
        "scale": [{"value": k, "label": v} for k, v in rt.SCALE.items()],
        "skills": [
            {"name": n, "kind": kind, "importance": imp, "previous": prev_by_norm.get(rt.norm(n))}
            for n, kind, imp in await _posting_skill_names(db, job)
        ],
    }


@router.post("/{job_id}/learning-plan", status_code=202)
async def generate_plan(
    job_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    body: GeneratePlanRequest | None = None,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Trigger AI generation of a job-specific learning plan.

    Returns immediately (202). Poll GET /jobs/{job_id}/learning-plan
    until status == 'ready'.
    """
    job = _get_job_or_404(job_id, db)

    # Check this first, before claiming the cooldown below — a duplicate
    # click while a generation is already in flight should still get the
    # friendly "poll for status" response, not a cooldown error.
    existing_plan = _get_plan(user.id, job_id, db)
    if existing_plan and existing_plan.status == "generating":
        return {"plan_id": str(existing_plan.id), "status": "generating", "message": "Plan generation already in progress. Poll GET /jobs/{job_id}/learning-plan."}

    cooldown_remaining = _check_and_set_regenerate_cooldown(str(user.id), job_id)
    if cooldown_remaining is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {cooldown_remaining}s before regenerating this plan again.",
        )

    # Ratings: what the learner just submitted, else the ones from their previous plan for this job.
    names = [n for n, _k, _i in await _posting_skill_names(db, job)]
    if body is not None and body.skill_ratings:
        self_ratings = rt.clean_ratings(body.skill_ratings, names)
    else:
        self_ratings = rt.clean_ratings((existing_plan.plan or {}).get("self_ratings") if existing_plan else {}, names)

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()

    # Only facts we actually hold — these are the sole things the personalisation
    # step may mention about the learner (see roadmap_engine.engine._personal_lines).
    facts = {
        "Current skills": ", ".join(profile.skills or []) if profile and profile.skills else None,
        "Status": profile.current_status if profile else None,
        "Degree": profile.degree if profile else None,
        "Work experience": (
            f"{profile.work_experience_years} yrs" + (f" in {profile.work_experience_domain}" if profile.work_experience_domain else "")
        ) if profile and profile.work_experience_years else None,
        "UPSC background": (
            f"{profile.upsc_exam}, highest stage cleared: {profile.highest_stage_cleared}"
            + (f", {profile.years_preparing} yrs preparing" if profile.years_preparing else "")
        ) if profile and profile.upsc_exam else None,
        "Preferred learning format": profile.preferred_learning_format if profile else None,
        "Biggest learning challenge": profile.learning_challenge if profile else None,
        "Weekly study hours": profile.weekly_study_hours if profile else None,
        # Not a fact about the learner: the browser language, used only as a video-language fallback
        # (engine.build_plan pops it before facts reach any prompt).
        "_browser_language": request.headers.get("accept-language"),
    }
    burnout = psych.burnout_score if psych else None

    plan = existing_plan
    old_progress = dict(plan.progress or {}) if plan else {}

    if plan:
        # Regenerate: reset to generating state. Progress is kept — module and
        # resource ids are stable per blueprint skill, so completed work survives.
        plan.status = "generating"
        plan.generation_step = "agenda"
        plan.generation_detail = {}
        plan.plan = {}
        plan.error_msg = None
        plan.generated_at = datetime.now(timezone.utc)
        db.commit()
        plan_id = str(plan.id)
    else:
        plan = JobLearningPlan(user_id=user.id, job_id=job_id, status="generating", generation_step="agenda")
        db.add(plan)
        db.commit()
        db.refresh(plan)
        plan_id = str(plan.id)

    # Normal path: hand the run to the Celery worker (survives web restarts/deploys, own queue).
    # If the broker is unreachable, fall back to running in this process so the user still gets a roadmap.
    from app.modules.roadmap_engine.runner import run_plan_generation
    from app.tasks.roadmap_engine_tasks import generate_job_plan_task
    from app.tasks.worker import safe_dispatch

    job_args = (plan_id, str(job_id), str(user.id), facts, burnout, old_progress, self_ratings)
    if not safe_dispatch(generate_job_plan_task, *job_args):
        logger.warning("Roadmap task queue unavailable — generating in-process for plan %s", plan_id)
        background_tasks.add_task(run_plan_generation, *job_args)

    return {
        "plan_id": plan_id,
        "status": "generating",
        "message": "Plan generation started. Poll GET /jobs/{job_id}/learning-plan.",
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

    # A background run that dies (deploy, restart, crash) would otherwise leave the plan
    # "generating" forever. Every step bumps updated_at, so a long silence means it is gone.
    if plan.status == "generating":
        last = plan.updated_at or plan.generated_at
        if last and (datetime.now(timezone.utc) - last).total_seconds() > GENERATION_ORPHAN_SECONDS:
            plan.status = "failed"
            plan.error_msg = "Roadmap generation was interrupted. Please try again."
            db.commit()

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
async def submit_quiz(
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
    already_passed = bool((plan.progress or {}).get(f"quiz_{module_id}", {}).get("passed"))

    progress = dict(plan.progress or {})
    progress[f"quiz_{module_id}"] = {
        "score_pct": score_pct,
        "passed": passed,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    plan.progress = progress
    db.commit()

    # Feed the result into the same skill-competence tracker the mock-interview
    # path updates, so a quiz result actually moves the needle on the user's
    # demonstrated skill mastery instead of only living in this response.
    try:
        from app.modules.roadmap.service import update_skill_competence
        update_skill_competence(
            user_id=str(user.id),
            skill_text=module.get("skill", ""),
            quiz_score=float(score_pct),
            exercise_score=None,
            db=db,
        )
    except Exception as exc:
        logger.warning("Skill competence update failed for module %s: %s", module_id, exc, exc_info=True)

    if _quiz_xp_awardable(passed, already_passed):
        try:
            from app.modules.xp.service import award_xp
            award_xp(user.id, "exercise_score_80", ref_id=module_id,
                     note=f"Passed quiz: {module.get('skill', '')}", db=db)
            db.commit()
        except Exception as exc:
            logger.warning("XP award failed for module %s quiz pass: %s", module_id, exc, exc_info=True)

        # Write the mastered skill onto the user's actual profile — through the
        # same validation path Step 5 uses — so it's visible everywhere else
        # (KRS score, other job plans, the generic roadmap), not just here.
        try:
            skill_name = module.get("skill", "").strip()
            profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
            if skill_name and profile:
                existing = {s.lower().strip() for s in (profile.skills or [])}
                if skill_name.lower().strip() not in existing:
                    from app.modules.onboarding.skill_validation import (
                        validate_and_register_skill,
                    )
                    canonical = await validate_and_register_skill(skill_name, db)
                    if canonical and canonical.lower().strip() not in existing:
                        profile.skills = [*(profile.skills or []), canonical]
                        db.commit()
        except Exception as exc:
            logger.warning("Profile skill writeback failed for module %s: %s", module_id, exc, exc_info=True)

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

        # On a failing score, generate one remedial resource targeting exactly what
        # was missed instead of letting the user silently move on — a different
        # angle than the module's existing resources.
        remedial_resource: dict | None = None
        try:
            job = _get_job_or_404(job_id, db)
            remedial_resource = await generate_remedial_resource(
                job_title=plan.plan.get("job_title", "this role"),
                sector=job.sector or "",
                skill=module.get("skill", ""),
                why_important=module.get("why_important", ""),
                missed_explanations=missed_explanations,
                resource_id=f"{module_id}-res-remedial-{len(module.get('resources', [])) + 1}",
            )
        except Exception as exc:
            logger.error("Remedial resource generation failed for module %s: %s", module_id, exc, exc_info=True)

        if remedial_resource:
            # Reassign plan.plan (new dict) so SQLAlchemy detects the JSONB change.
            new_modules = [
                {**m, "resources": [*m.get("resources", []), remedial_resource]} if m.get("id") == module_id else m
                for m in plan.plan.get("modules", [])
            ]
            plan.plan = {**plan.plan, "modules": new_modules}
            db.commit()
            resources_to_revisit.append({
                "id": remedial_resource.get("id"),
                "title": remedial_resource.get("title"),
                "type": remedial_resource.get("type"),
                "url": remedial_resource.get("url"),
            })

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
    # Reflects the resource's current done-state in the response even when
    # this request only rates a video and never touches "done" (see below).
    done = bool(entry.get("done"))

    if "done" in body:
        done = bool(body["done"])
        was_done = bool(entry.get("done"))
        entry["done"] = done
        entry["done_at"] = datetime.now(timezone.utc).isoformat() if done else None

        if _resource_xp_awardable(done, was_done):
            # award_xp() already fires on generic-roadmap stage completion but was
            # never wired up here — the job-specific plan most users actually
            # touch gave zero XP.
            try:
                from app.modules.xp.service import award_xp
                award_xp(user.id, "lesson_complete", ref_id=resource_id,
                         note="Completed a job-plan resource", db=db)
            except Exception as exc:
                logger.warning("XP award failed for resource %s: %s", resource_id, exc, exc_info=True)

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
