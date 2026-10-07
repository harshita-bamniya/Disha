"""Personalisation, honest hours and the weekly schedule — deterministic code.

The LLM is only used for the short "why this matters for you" lines. Which
skills are skipped, how many hours they take, and whether the deadline is
realistic are computed here so they can be trusted and tested.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

import numpy as np

from app.modules.recommendations import embedder
from app.modules.roadmap_engine.schema import topo_order

# Embedding cosine is compressed (unrelated skills score ~0.55-0.65), so it can only
# safely identify a *direct* match. Everything nuanced goes through the LLM classifier.
KNOWN_SIM = 0.80
DEFAULT_WEEKLY_HOURS = 8
READ_MINUTES = 15     # per verified reference
GATE_HOURS = 1.0
MAX_COMFORTABLE_HOURS_PER_DAY = 6
MULT = {"learn": 1.0, "partial": 0.75, "review": 0.4, "known": 0.0}


def _unit(v: list[float]) -> np.ndarray:
    a = np.asarray(v, dtype=np.float32)
    n = float(np.linalg.norm(a))
    return a / n if n else a


def classify_skills(
    skills: list[dict[str, Any]],
    user_skills: list[str],
    proficiency: dict[str, str] | None,
    mastered: set[str],
) -> dict[str, dict[str, Any]]:
    """status per blueprint skill id: known | review | partial | learn (+ matched user skill)."""
    proficiency = proficiency or {}
    out: dict[str, dict[str, Any]] = {}
    user_vecs = embedder.embed_batch(user_skills) if user_skills else []
    user_pairs = [(u, _unit(v)) for u, v in zip(user_skills, user_vecs) if v]
    sk_vecs = embedder.embed_batch([s["name"] for s in skills])

    for s, sv in zip(skills, sk_vecs):
        status, matched, sim = "learn", None, 0.0
        if s["id"] in mastered:
            out[s["id"]] = {"status": "known", "matched": "quiz passed", "sim": 1.0}
            continue
        if sv is not None and user_pairs:
            q = _unit(sv)
            sims = [(float(q @ uv), u) for u, uv in user_pairs]
            sim, matched = max(sims)
            if sim >= KNOWN_SIM:
                status = "known"
                if str(proficiency.get(matched, "")).lower() == "beginner":
                    status = "review"          # they list it but rate themselves a beginner
        out[s["id"]] = {"status": status, "matched": matched if status != "learn" else None, "sim": round(sim, 3)}
    return out


def node_hours(base_hours: float, status: str, resource_minutes: float) -> tuple[float, float]:
    """(total_hours, practice_hours). Hours are the sum of what the learner will actually do:
    resource time + practice/proof time, never less than the level-scaled base estimate."""
    scaled = base_hours * MULT[status]
    practice_min = max(0.35 * scaled * 60, scaled * 60 - resource_minutes)
    total_min = resource_minutes + practice_min
    return round(total_min / 60 * 2) / 2, round(practice_min / 60 * 2) / 2


def build_schedule(
    modules: list[dict[str, Any]],
    phases: list[dict[str, Any]],
    weekly_hours: int | None,
    target_date: date | None,
    today: date | None = None,
    *,
    session_hours: float | None = None,
    study_days: list[str] | None = None,
    practice_type: str | None = "project",
    deadline_reason: str | None = None,
) -> dict[str, Any]:
    """Pack tasks into weeks of `weekly_hours`; report feasibility against the deadline.

    session_hours: the learner's usual sitting; each task reports how many sessions it takes.
    study_days: the days they study; each task is labelled with the day it starts on.
    practice_type: "project", "quiz" or None (no practice task) for the per-module practice step.
    deadline_reason: "interview" / "application" adds a summary of what fits before the date."""
    today = today or date.today()
    cap = float(weekly_hours or DEFAULT_WEEKLY_HOURS)

    tasks: list[dict[str, Any]] = []
    for mod in modules:
        for res in mod["resources"]:
            if res.get("duration_minutes"):
                tasks.append({
                    "type": "watch" if res["type"] == "youtube" else "read",
                    "module_id": mod["id"], "resource_id": res["id"],
                    "title": res["title"], "hours": round(res["duration_minutes"] / 60, 2),
                })
        if practice_type and mod["practice_hours"] > 0:
            quiz = practice_type == "quiz"
            tasks.append({
                "type": "quiz" if quiz else "project", "module_id": mod["id"], "resource_id": f"proof-{mod['id']}",
                "title": f"Self-check quiz: {mod['skill']}" if quiz else (mod["proof"]["title"] or f"Practice: {mod['skill']}"),
                "hours": mod["practice_hours"],
            })
        # phase gate after the last module of a phase
        phase_mods = [m for m in modules if m["phase_id"] == mod["phase_id"]]
        if phase_mods and phase_mods[-1]["id"] == mod["id"]:
            phase = next((p for p in phases if p["id"] == mod["phase_id"]), None)
            if phase:
                tasks.append({
                    "type": "gate", "module_id": None, "resource_id": f"gate-{phase['id']}",
                    "title": f"Exit gate — {phase['name']}: {phase['gate']['description']}"[:200], "hours": GATE_HOURS,
                })

    # Fill each week to capacity, splitting a task across the week boundary when needed.
    weeks: list[dict[str, Any]] = []
    cur: list[dict[str, Any]] = []
    room = cap
    for t in tasks:
        remaining = t["hours"]
        pieces: list[dict[str, Any]] = []
        while remaining > 1e-6:
            take = min(room, remaining)
            piece = {**t, "hours": round(take, 2)}
            pieces.append(piece)
            cur.append(piece)
            remaining -= take
            room -= take
            if room <= 1e-6:
                weeks.append({"tasks": cur, "hours": round(cap, 2)})
                cur, room = [], cap
        for i, piece in enumerate(pieces, 1):
            piece["part"] = i if len(pieces) > 1 else None
            piece["parts"] = len(pieces) if len(pieces) > 1 else None
    if cur:
        weeks.append({"tasks": cur, "hours": round(sum(c["hours"] for c in cur), 2)})
    days = study_days or []
    per_day = cap / len(days) if days else None
    for i, w in enumerate(weeks, 1):
        w["week"] = i
        w["starts_on"] = (today + timedelta(days=7 * (i - 1))).isoformat()
        used = 0.0
        for t in w["tasks"]:
            if days and per_day:
                t["day"] = days[min(int(used / per_day + 1e-9), len(days) - 1)]
            if session_hours:
                t["sessions"] = max(1, math.ceil(t["hours"] / session_hours - 1e-9))
            used += t["hours"]
        if session_hours:
            w["sessions"] = sum(t["sessions"] for t in w["tasks"])

    total_hours = round(sum(t["hours"] for t in tasks), 1)
    weeks_needed = len(weeks)
    result: dict[str, Any] = {
        "weekly_hours": cap, "total_hours": total_hours, "weeks_needed": weeks_needed,
        "projected_finish": (today + timedelta(days=7 * weeks_needed)).isoformat(),
        "weeks": weeks, "target_date": target_date.isoformat() if target_date else None,
        "weeks_available": None, "feasible": True, "options": [],
        "session_hours": session_hours, "study_days": days or None,
        "sessions_per_week": math.ceil(cap / session_hours - 1e-9) if session_hours else None,
        "focus": None,
    }
    if per_day and per_day > MAX_COMFORTABLE_HOURS_PER_DAY:
        result["day_note"] = (f"{cap:g} h a week over {len(days)} day{'s' if len(days) != 1 else ''} is about "
                              f"{per_day:.1f} h per day. Adding study days would make this easier to keep up.")
    if target_date and target_date > today:
        available = max(1, math.ceil((target_date - today).days / 7))
        result["weeks_available"] = available
        if weeks_needed > available:
            result["feasible"] = False
            result["options"] = [
                {"type": "extend_date", "label": f"Extend your target to {(today + timedelta(days=7 * weeks_needed)).strftime('%d %b %Y')}",
                 "new_date": (today + timedelta(days=7 * weeks_needed)).isoformat()},
                {"type": "raise_hours", "label": f"Study {math.ceil(total_hours / available)} h/week to finish by your date",
                 "hours_per_week": math.ceil(total_hours / available)},
            ]
    if target_date and target_date > today and deadline_reason in ("interview", "application"):
        result["focus"] = _deadline_focus(modules, phases, weeks, result["weeks_available"] or 0)
        result["deadline_reason"] = deadline_reason
    return result


def _deadline_focus(modules: list[dict[str, Any]], phases: list[dict[str, Any]], weeks: list[dict[str, Any]], available: int) -> dict[str, Any]:
    """Modules completely finished inside the weeks before the date (a module counts only when all its tasks fit)."""
    last_week: dict[str, int] = {}
    for w in weeks:
        for t in w["tasks"]:
            if t["module_id"]:
                last_week[t["module_id"]] = w["week"]
    covered_ids = {m["id"] for m in modules if m["id"] in last_week and last_week[m["id"]] <= available}
    covered_phases = [p["name"] for p in phases if p.get("module_ids") and all(mid in covered_ids for mid in p["module_ids"])]
    return {"weeks_available": available, "modules_covered": len(covered_ids), "modules_total": len(modules),
            "phases_covered": covered_phases}


def order_modules(skills: list[dict[str, Any]], phase_order: list[str]) -> list[dict[str, Any]]:
    """Prerequisites first, then by phase order, keeping blueprint order inside a phase."""
    rank = {p: i for i, p in enumerate(phase_order)}
    by_phase = sorted(skills, key=lambda s: (rank.get(s["phase"], 99), skills.index(s)))
    # topo_order pulls a prerequisite ahead of its dependent if phases disagree.
    return topo_order(by_phase)


CLASSIFY_SYSTEM = "You are a strict skills assessor for a job-preparation platform. Output ONLY JSON."


async def classify_with_llm(
    skills: list[dict[str, Any]],
    user_skills: list[str],
    proficiency: dict[str, str] | None,
    facts: dict[str, Any],
    mastered: set[str],
) -> dict[str, dict[str, Any]]:
    """Conservative known/review/partial/learn judgment per blueprint skill.

    Defaults to `learn`. `known` requires a listed user skill that directly covers the
    skill AND is not self-rated beginner; quiz-mastered skills are always known."""
    from app.modules.roadmap_engine.llm import complete_json

    proficiency = proficiency or {}
    have = "\n".join(f"- {u} (self-rated: {proficiency.get(u, 'not rated')})" for u in user_skills) or "- (none listed)"
    background = "\n".join(f"- {k}: {v}" for k, v in facts.items() if v and k != "Current skills")
    listing = "\n".join(f"- id={s['id']} | {s['name']}" for s in skills)
    prompt = (
        f"Learner's listed skills:\n{have}\n\nLearner background:\n{background or '- (none)'}\n\n"
        f"Skills required for the target role:\n{listing}\n\n"
        "Classify EACH required skill:\n"
        "- known: a listed skill DIRECTLY covers it at working level (must name that skill; not self-rated beginner)\n"
        "- review: directly covered but rated beginner/unrated and only broadly, so a refresher is enough\n"
        "- partial: a genuinely related strength transfers, but this skill itself was never practised\n"
        "- learn: no meaningful overlap. THIS IS THE DEFAULT. Be conservative: general study of a subject does NOT mean "
        "they can perform a professional task (e.g. 'Ethics' does not cover 'compliance audit').\n"
        'Return {"classes":{"<id>":{"status":"known|review|partial|learn","matched":"<listed skill or null>","reason":"<=12 words"}}}'
    )
    data = await complete_json(CLASSIFY_SYSTEM, prompt, 3000, 0.1, effort="low")
    listed = {u.lower(): u for u in user_skills}
    out: dict[str, dict[str, Any]] = {}
    for s in skills:
        c = (data.get("classes") or {}).get(s["id"]) or {}
        status = c.get("status") if c.get("status") in MULT else "learn"
        matched = listed.get(str(c.get("matched") or "").lower())
        if status in ("known", "review") and not matched:
            status = "partial"                       # cannot claim knowledge without naming the skill
        if status == "known" and str(proficiency.get(matched, "")).lower() == "beginner":
            status = "review"
        if s["id"] in mastered:
            status, matched = "known", "quiz passed"
        out[s["id"]] = {"status": status, "matched": matched if status != "learn" else None,
                        "sim": 0.0, "reason": str(c.get("reason", ""))[:120]}
    return out
