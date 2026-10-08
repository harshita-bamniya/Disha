"""Roadmap engine v2 orchestrator.

blueprint (curated skeleton) -> tailor to THIS posting -> classify against the learner -> ranked videos
-> honest hours + weekly schedule -> personal lines (from verified facts only) -> validate -> plan JSON.

Inputs are only: the learner's profile skills and setup answers, the posting's own requirements and
duties, and the blueprint. Resume content is never read here (a roadmap is built for a job the
candidate may have nothing on their resume for yet).

The plan JSON is a superset of the v1 shape (`modules[].resources[]` with ids,
`video_options`, `recommended_video_id`) so progress, quizzes, ratings and the
tutor keep working, and adds goal / phases / schedule / proof / job-search kit.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import AspirantProfile, JobPosting
from app.modules.roadmap_engine import blueprint as bp_mod
from app.modules.roadmap_engine import facts as facts_mod
from app.modules.roadmap_engine import personal
from app.modules.roadmap_engine import prefs
from app.modules.roadmap_engine import personalizer as pz
from app.modules.roadmap_engine import ratings as rt
from app.modules.roadmap_engine import salary
from app.modules.roadmap_engine import skill_bridge
from app.modules.roadmap_engine import targeting
from app.modules.roadmap_engine.video_library import get_ranked_videos

logger = logging.getLogger(__name__)

ENGINE_VERSION = "v2"
VIDEO_CONCURRENCY = 4

StepFn = Callable[[str, dict[str, Any]], None]


def _mastered_skill_ids(progress: dict[str, Any]) -> set[str]:
    out = set()
    for key, entry in (progress or {}).items():
        if key.startswith("quiz_m-") and isinstance(entry, dict) and entry.get("passed"):
            out.add(key[len("quiz_m-"):])
    return out


def _rejected_video_ids(progress: dict[str, Any]) -> set[str]:
    out = set()
    for entry in (progress or {}).values():
        if isinstance(entry, dict):
            r = entry.get("video_rating") or {}
            if r.get("rating") == "not_relevant" and r.get("video_id"):
                out.add(r["video_id"])
    return out


def _video_option(v: dict[str, Any]) -> dict[str, Any]:
    return {
        "video_id": v["video_id"], "title": v["title"], "channel": v["channel"],
        "duration_minutes": v["duration_minutes"], "thumbnail_url": v["thumbnail_url"], "url": v["url"],
        "views": v.get("views"), "likes": v.get("likes"), "score": v.get("score"),
        "reason": v.get("reason"), "channel_subscribers": v.get("channel_subscribers"),
    }


async def _posting_targets(db: Session, job: JobPosting) -> tuple[list[str], list[str]]:
    """(requirement names, all targets) for THIS posting: what it says it requires and what it says the job does.

    Both come from the posting parser, which extracts only what the text states. If the parse is unavailable
    we fall back to the employer-selected skills. Never uses candidate data."""
    names: list[str] = []
    duties: list[str] = []
    try:
        from app.modules.resume_match.jd_parser import get_or_parse_requirements  # parses the posting only

        parsed = await get_or_parse_requirements(db, job)
        # specific requirements (named law, tool, method) first: they say more about fit than generic traits
        names = [r.name for r in sorted((r for r in parsed.requirements if r.type != "eligibility"),
                                        key=lambda r: r.specificity == "generic")]
        duties = list(parsed.responsibilities)
    except Exception as exc:
        logger.warning("posting requirement parse failed (%s); using the employer's selected skills", exc)
    if not names:
        names = [str(x) for x in (job.required_skills or [])]
    seen: set[str] = set()
    targets = [t for t in [*names, *duties] if t and not (targeting.norm(t) in seen or seen.add(targeting.norm(t)))]
    return names, targets


async def _requirement_strengths(
    names: list[str], user_skills: list[str], proficiency: dict[str, str], facts: dict[str, Any],
) -> list[tuple[str, str]]:
    """(posting requirement, the learner's own listed skill that covers it). Same classifier as the modules."""
    if not names or not user_skills:
        return []
    pseudo = [{"id": f"req-{i}", "name": n} for i, n in enumerate(names)]
    try:
        st = await pz.classify_with_llm(pseudo, user_skills, proficiency, facts, set())
    except Exception as exc:
        logger.warning("requirement classification failed (%s) - using embedding fallback", exc)
        st = await asyncio.to_thread(pz.classify_skills, pseudo, user_skills, proficiency, set())
    return [(p["name"], st[p["id"]]["matched"]) for p in pseudo
            # only solid matches: "partial" (loosely related) is too weak to present as something the learner brings
            if st[p["id"]]["status"] in ("known", "review") and st[p["id"]].get("matched")]


def validate_plan(plan: dict[str, Any], known_ids: set[str]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    mods = plan["modules"]
    if not mods:
        errors.append("Roadmap has no modules (learner already covers every skill?).")
    position = {m["skill_id"]: i for i, m in enumerate(mods)}
    for i, m in enumerate(mods):
        for pre in m["prerequisites"]:
            if pre in known_ids:
                continue
            if pre in position and position[pre] > i:
                errors.append(f"'{m['skill']}' is scheduled before its prerequisite '{pre}'.")
        if m["estimated_hours"] <= 0:
            errors.append(f"'{m['skill']}' has no estimated hours.")
        if not m["proof"]["title"]:
            errors.append(f"'{m['skill']}' has no proof task.")
        if m.get("kind") != "practice":      # capstones / practice modules are legitimately project-only
            if not any(r["type"] == "youtube" and r.get("video_options") for r in m["resources"]):
                warnings.append(f"No ranked video found for '{m['skill']}' yet.")
            if not m["resources"]:
                warnings.append(f"'{m['skill']}' has no resources.")
    if round(sum(m["estimated_hours"] for m in mods), 1) != round(plan["modules_hours"], 1):
        errors.append("Module hours do not add up to the plan total.")
    if not plan["schedule"]["feasible"]:
        warnings.append("Target date is not achievable at the current weekly hours (options provided).")
    return errors, warnings


async def build_plan(
    db: Session,
    job: JobPosting,
    profile: AspirantProfile | None,
    facts: dict[str, Any],
    burnout: float | None,
    old_progress: dict[str, Any] | None,
    set_step: StepFn,
    cancelled: Callable[[], bool],
    self_ratings: dict[str, int] | None = None,
) -> dict[str, Any]:
    old_progress = old_progress or {}
    facts = dict(facts)
    browser_language = facts.pop("_browser_language", None)
    company = job.employer.company_name if job.employer else "the company"

    # 1 ── blueprint ──────────────────────────────────────────────────────────
    set_step("agenda", {"message": "Finding the blueprint for this role"})

    async def on_bp(msg: str) -> None:
        set_step("agenda", {"message": msg})

    blueprint = await bp_mod.get_or_draft_blueprint(db, job, on_bp)
    if cancelled():
        raise asyncio.CancelledError()
    if get_settings().roadmap_require_reviewed_blueprint and blueprint.review_status != "reviewed":
        raise RuntimeError(
            "This role's skill blueprint has not been reviewed by an expert yet, so a roadmap is not available for it.")
    graph = blueprint.graph
    skills = graph["skills"]
    phases_bp = graph["phases"]

    # 2 ── classify against the learner ───────────────────────────────────────
    set_step("agenda", {"message": "Comparing the blueprint with your skills"})
    user_skills = list(profile.skills or []) if profile else []
    proficiency = dict(profile.skill_proficiency or {}) if profile else {}
    mastered = _mastered_skill_ids(old_progress)
    try:
        status = await pz.classify_with_llm(skills, user_skills, proficiency, facts, mastered)
    except Exception as exc:
        logger.warning("LLM skill classification failed (%s) — using embedding fallback", exc)
        status = await asyncio.to_thread(pz.classify_skills, skills, user_skills, proficiency, mastered)
    # "partial" only where the research Skill Framework links the learner's skill to the module's skill
    bridged = skill_bridge.apply(skills, status, user_skills, await asyncio.to_thread(skill_bridge.load_rows, db))
    logger.info("[SKILL_BRIDGE] %s", bridged)
    ordered = pz.order_modules(skills, [p["id"] for p in phases_bp])

    # 2b ── tailor to THIS posting (its own requirements and duties) ───────────────
    set_step("agenda", {"message": "Matching the blueprint to what this posting asks for"})
    requirement_names, targets = await _posting_targets(db, job)
    from app.modules.resume_match.jd_parser import source_hash as _posting_hash  # hash of the posting text only
    serves = await targeting.map_skills_to_posting(
        job.title, targets, skills, f"rm:target:v1:{_posting_hash(job)}:{blueprint.id}:{blueprint.version}")
    if serves is None:
        core_ids, beyond_ids = {s["id"] for s in skills}, set()
    else:
        core_ids, beyond_ids = targeting.select_core(skills, {p["id"]: p["name"] for p in phases_bp}, serves)
    ratings = rt.clean_ratings(self_ratings, requirement_names)
    profile_strengths = await _requirement_strengths(requirement_names, user_skills, proficiency, facts)
    strengths = rt.strengths(profile_strengths, requirement_names, ratings)
    if serves is not None:
        rt.apply_to_status(skills, status, serves, ratings)     # the learner's own ratings shorten modules they already do

    active = [s for s in ordered if status[s["id"]]["status"] != "known" and s["id"] in core_ids]
    stretch = [s for s in ordered if status[s["id"]]["status"] != "known" and s["id"] in beyond_ids]
    known = [s for s in ordered if status[s["id"]]["status"] == "known"]
    known_ids = {s["id"] for s in known}

    # 3 ── ranked videos (cached per skill) ───────────────────────────────────
    total = len(active)
    counters = {"done": 0}
    rejected = _rejected_video_ids(old_progress)
    sem = asyncio.Semaphore(VIDEO_CONCURRENCY)
    # The learner's explicit choice wins; the browser's language is only a fallback when none is saved.
    saved_language = profile.preferred_language if profile else None
    language = prefs.language_for(saved_language or prefs.language_from_header(browser_language))
    stage = profile.learning_stage if profile else None
    budget = profile.learning_budget if profile else None
    lang_fallback: set[str] = set()
    videos_by_skill: dict[str, list[dict[str, Any]]] = {}

    def resources_detail(current: str | None, last: str | None) -> dict[str, Any]:
        return {"resources_done": counters["done"], "resources_total": total, "current_skill": current,
                "last_found": last, "modules_planned": total}

    set_step("resources", resources_detail(None, None))

    async def fetch(s: dict[str, Any]) -> None:
        async with sem:
            if cancelled():
                raise asyncio.CancelledError()
            level = prefs.video_level(stage, status[s["id"]]["status"])
            try:
                vids = await get_ranked_videos(db, s, job.title, language, level)
                if not vids and language != prefs.DEFAULT_LANGUAGE:
                    lang_fallback.add(s["id"])          # preferred language has nothing for this skill: say so, use English
                    vids = await get_ranked_videos(db, s, job.title, prefs.DEFAULT_LANGUAGE, level)
            except Exception as exc:
                logger.warning("video library failed for %s: %s", s["name"], exc, exc_info=True)
                vids = []
            vids = [v for v in vids if v["video_id"] not in rejected] or vids
            videos_by_skill[s["id"]] = vids
            counters["done"] += 1
            set_step("resources", resources_detail(s["name"], vids[0]["title"] if vids else None))

    # sqlalchemy Session is not concurrency-safe: serialise DB access via a lock inside get_ranked_videos
    # callers by running fetches one after another when the session is shared.
    for s in active:
        await fetch(s)

    # 4 ── assemble modules with honest hours ─────────────────────────────────
    set_step("finalizing", {"modules_planned": total, "message": "Building your schedule"})
    fmt = (profile.preferred_learning_format if profile else None) or "mixed"
    practice_style = profile.practice_style if profile else None
    practice_mult = prefs.practice_factor(practice_style, fmt)
    quiz_cap = prefs.QUIZ_MAX_HOURS if prefs.practice_task_type(practice_style, fmt) == "quiz" else None
    modules: list[dict[str, Any]] = []
    hidden_paid = 0
    for i, s in enumerate(active, 1):
        st = status[s["id"]]["status"]
        mod_id = f"m-{s['id']}"
        vids = videos_by_skill.get(s["id"], [])
        refs = s["references"][: (1 if fmt == "video" else 2)]

        resources: list[dict[str, Any]] = []
        n_video = 0 if not vids else (2 if (s["base_hours"] * pz.MULT[st] >= 8 or fmt == "video") and len(vids) >= 2 else 1)
        if fmt == "reading" and refs:
            n_video = min(n_video, 1)
        for k in range(n_video):
            rec = vids[k]
            options = [rec] + [v for v in vids if v["video_id"] != rec["video_id"]][:2]
            resources.append({
                "id": f"{mod_id}-v{k + 1}", "type": "youtube", "title": rec["title"],
                "channel_or_source": rec["channel"], "search_query": s["search_queries"][0],
                "url": rec["url"], "duration_minutes": rec["duration_minutes"],
                "description": rec.get("reason") or "", "why": rec.get("reason") or "",
                "video_options": [_video_option(v) for v in options], "recommended_video_id": rec["video_id"],
                "is_verified": True,
            })
        for k, ref in enumerate(refs):
            resources.append({
                "id": f"{mod_id}-a{k + 1}", "type": "article", "title": ref["title"],
                "channel_or_source": ref["source"], "search_query": "", "url": ref["url"],
                "duration_minutes": pz.READ_MINUTES, "description": f"Primary source from {ref['source']}",
                "why": ("Authoritative source verified to load and match this topic." if ref.get("verified", True)
                        else "Official source (its site blocks automatic checks, so we could not confirm the page loads)."),
                "is_verified": bool(ref.get("verified", True)),
            })

        resources, hidden = prefs.filter_resources(resources, budget)
        hidden_paid += hidden
        res_min = sum(r["duration_minutes"] for r in resources)
        hours, practice = pz.node_hours(s["base_hours"], st, res_min)
        hours, practice = prefs.adjust_practice(hours, practice, practice_mult, quiz_cap)   # practice style / hands-on format
        modules.append({
            "id": mod_id, "skill_id": s["id"], "skill": s["name"], "priority": i, "phase_id": s["phase"],
            "kind": s.get("concept_type", "concept"),
            "status": st, "matched_skill": status[s["id"]]["matched"],
            "matched_source": status[s["id"]].get("source", "profile"), "matched_rating": status[s["id"]].get("rating"),
            "prerequisites": s["prerequisites"], "why_important": s["why_for_role"], "why_for_role": s["why_for_role"],
            "why_for_you": "", "estimated_hours": hours, "practice_hours": practice,
            "watch_minutes": sum(r["duration_minutes"] for r in resources if r["type"] == "youtube"),
            "project_deliverable": s["proof"]["brief"], "proof": s["proof"],
            "evidence": s["evidence"], "resources": resources,
        })

    phases: list[dict[str, Any]] = []
    for p in phases_bp:
        ids = [m["id"] for m in modules if m["phase_id"] == p["id"]]
        phases.append({
            "id": p["id"], "name": p["name"], "goal": p["goal"], "gate": {**p["gate"], "hours": pz.GATE_HOURS},
            "module_ids": ids, "skipped": not ids,
            "hours": round(sum(m["estimated_hours"] for m in modules if m["id"] in ids) + (pz.GATE_HOURS if ids else 0), 1),
        })

    cap_hours = profile.weekly_study_hours if profile else None
    load_note = None
    if burnout is not None and burnout >= 70 and cap_hours:
        cap_hours = max(3, round(cap_hours * 0.75))
        load_note = f"Weekly load lowered to {cap_hours} h because your burnout score is high."
    deadline_reason = profile.deadline_reason if profile else None
    schedule = pz.build_schedule(
        modules, [p for p in phases if not p["skipped"]], cap_hours, profile.target_completion_date if profile else None,
        session_hours=prefs.session_hours(profile.session_length if profile else None),
        study_days=prefs.study_day_names(profile.study_days) if profile and profile.study_days else None,
        practice_type=prefs.practice_task_type(practice_style, fmt),
        deadline_reason=deadline_reason,
    )
    if load_note:
        schedule["load_note"] = load_note
    schedule["deadline_note"] = prefs.deadline_note(deadline_reason, schedule.get("focus"))

    # 5 ── personal lines: built in code from verified facts, never free-written by the AI ──────────
    lines = personal.module_lines(modules)
    for m in modules:
        m["why_for_you"] = lines[m["id"]]
    summary = personal.summary(strengths, modules, len(stretch))
    flagged = targeting.flag_modules(modules, targeting.judge_flags(blueprint.sources)["weak_or_generic"])

    kit = dict(graph["job_search_kit"])
    sal = [(p.salary_min, p.salary_max) for p in db.query(JobPosting).filter(JobPosting.title.ilike(f"%{job.title.split(' – ')[0]}%")).all() if p.salary_min and p.salary_max]
    if sal:
        kit["salary_range_lpa"] = {"min": min(a for a, _ in sal), "max": max(b for _, b in sal), "based_on_postings": len(sal)}
    role_ids = [r["id"] for r in (blueprint.sources or {}).get("roles_used") or [] if r.get("id")]
    if role_ids and profile and profile.preferred_locations:
        from app.models.market_role import MarketRole
        locs = [r.hiring_locations_list or [] for r in db.query(MarketRole).filter(MarketRole.id.in_(role_ids)).all()]
        loc = prefs.location_note(profile.preferred_locations, locs)
        if loc:
            kit["location_fit"] = loc
    bench = salary.entry_benchmark(db, job.title, blueprint.title, blueprint.sources)
    if bench:
        kit["salary_benchmark"] = bench
    kit["resume_bullets_from_proofs"] = [
        f"{m['proof']['title']} — {m['proof']['brief']}"[:300] for m in modules if m["proof"]["title"]
    ][:6]

    modules_hours = round(sum(m["estimated_hours"] for m in modules), 1)
    total_hours = round(modules_hours + sum(p["gate"]["hours"] for p in phases if not p["skipped"]), 1)
    plan: dict[str, Any] = {
        "engine": ENGINE_VERSION, "enriched": True,
        "job_title": job.title, "company": company,
        "summary": summary or graph["summary"], "explanation": graph["summary"],
        "goal": {
            "role": job.title, "company": company, "target_date": schedule["target_date"],
            "total_hours": total_hours, "weeks_needed": schedule["weeks_needed"],
            "weeks_available": schedule["weeks_available"], "feasible": schedule["feasible"],
            "job_ready_definition": graph["job_ready_definition"],
        },
        "blueprint": {"id": str(blueprint.id), "slug": blueprint.slug, "version": blueprint.version,
                      "review_status": blueprint.review_status, "postings_analyzed": blueprint.sources.get("postings_total", 0),
                      "roles_analyzed": blueprint.sources.get("roles_total", 0)},
        "phases": phases, "modules": modules, "modules_hours": modules_hours,
        "total_estimated_hours": total_hours, "schedule": schedule,
        "known_skills": [{"skill": s["name"], "matched_from": status[s["id"]]["matched"]} for s in known],
        "strengths_for_posting": [{"requirement": r, "covered_by": k} for r, k in strengths],
        "self_ratings": ratings,
        "stretch_modules": [
            {"skill": s["name"], "why_for_role": s["why_for_role"], "base_hours": s["base_hours"]} for s in stretch
        ],
        "targeting": {
            "source": "posting", "requirements": requirement_names, "tailored": serves is not None,
            "inputs": ["profile skills", "setup answers", "posting requirements and duties"],
        },
        "job_search_kit": kit,
    }
    plan["blueprint"]["grounding"] = targeting.grounding(skills)
    plan, corrections, statute_warnings = facts_mod.apply_statute_checks(plan)

    # 6 ── validate ───────────────────────────────────────────────────────────
    errors, warnings = validate_plan(plan, known_ids)
    notice = targeting.grounding_warning(plan["blueprint"]["grounding"])
    if notice:
        warnings.append(notice)
    if serves is None:
        warnings.append("Could not match the blueprint to this posting, so every blueprint skill is included.")
    flags = targeting.judge_flags(blueprint.sources)
    if flags["missing_skills"]:
        warnings.append("The blueprint reviewer noted missing areas: " + "; ".join(flags["missing_skills"][:4]) + ".")
    if flagged:
        warnings.append(f"{flagged} module(s) were called generic or weak by the blueprint reviewer and are marked.")
    warnings.extend(statute_warnings)
    for note in (prefs.language_note(language, len(modules), sum(1 for m in modules if m["skill_id"] in lang_fallback)),
                 prefs.budget_note(budget, hidden_paid)):
        if note:
            warnings.append(note)
    plan["quality"] = {
        "validated": not errors, "errors": errors, "warnings": warnings,
        "videos_resolved": sum(1 for m in modules if any(r["type"] == "youtube" for r in m["resources"])),
        "modules": len(modules), "blueprint_review_status": blueprint.review_status,
        "blueprint_judge_score": (blueprint.sources.get("judge") or {}).get("score"),
        "corrections": corrections,
    }
    if errors:
        raise RuntimeError("Roadmap failed validation: " + "; ".join(errors[:4]))
    plan.pop("modules_hours", None)
    return plan
