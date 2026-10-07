"""Tailor a role blueprint to THIS posting, and describe how much to trust the blueprint.

A blueprint is a role-family skeleton drafted from general market knowledge. A learner applying
to one posting should be prepared for what that posting asks for, so skills the posting does not
ask for (and no duty needs) are moved to an optional "beyond this posting" list instead of being
scheduled as required work. Prerequisites of required skills are always kept.

Inputs to the roadmap are only: the learner's profile skills and setup answers, the posting's own
requirements and duties, and the blueprint. Resume content is never an input.
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Phases that are about getting hired (not a posting-specific skill) are always kept.
_ALWAYS_CORE_PHASE = re.compile(r"job[\s\-]?search|interview|apply|application", re.I)
MIN_CORE_SKILLS = 4

TARGET_SYSTEM = "You map role-skill modules to what ONE job posting actually asks for. Output ONLY JSON."


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


# ── how far the blueprint is backed by real postings ─────────────────────────

def grounding(skills: list[dict[str, Any]]) -> dict[str, Any]:
    """How many blueprint skills appear in postings we actually hold (evidence computed at draft time)."""
    total = len(skills)
    def _backed(s: dict[str, Any]) -> bool:
        ev = s.get("evidence") or {}
        return ev.get("roles_matched", 0) >= 1 or ev.get("postings_matched", 0) >= 1
    backed = sum(1 for s in skills if _backed(s))
    share = backed / total if total else 0.0
    level = "grounded" if share >= 0.6 else "partial" if share >= 0.3 else "unverified"
    return {"level": level, "skills_with_postings": backed, "skills_total": total}


def grounding_warning(g: dict[str, Any]) -> str | None:
    if g["level"] == "grounded":
        return None
    return (f"Only {g['skills_with_postings']} of {g['skills_total']} skills in this role's blueprint appear in the reference roles and postings we "
            "hold; the rest come from general market knowledge. Treat the detail as a guide, not a job requirement.")


def judge_flags(sources: dict[str, Any] | None) -> dict[str, list[str]]:
    """Findings the blueprint's own reviewer step recorded, so they are shown instead of ignored."""
    judge = (sources or {}).get("judge") or {}
    return {
        "weak_or_generic": [str(x) for x in judge.get("weak_or_generic") or []],
        "missing_skills": [str(x) for x in judge.get("missing_skills") or []],
    }


def flag_modules(modules: list[dict[str, Any]], weak: list[str]) -> int:
    """Mark modules the blueprint reviewer called weak or generic. Returns how many were marked."""
    weak_keys = {norm(w) for w in weak}
    n = 0
    for m in modules:
        if norm(m["skill"]) in weak_keys:
            m["review_flag"] = "The blueprint reviewer called this module generic or weak. Treat it as optional detail."
            n += 1
    return n


# ── which skills does this posting actually need? ────────────────────────────

def build_target_prompt(job_title: str, targets: list[str], skills: list[dict[str, Any]]) -> str:
    listing = "\n".join(f"- id={s['id']} | {s['name']} | {s.get('why_for_role', '')[:140]}" for s in skills)
    items = "\n".join(f"{i}. {t}" for i, t in enumerate(targets, 1))
    return (
        f"Job posting: {job_title}\n\nWHAT THE POSTING ASKS FOR (its requirements and duties):\n{items}\n\n"
        f"ROLE MODULES:\n{listing}\n\n"
        "For each module list the items above that completing it would DIRECTLY produce evidence for (at most 2). "
        "Use the items' exact text. The module's own topic must be named by, or clearly part of, the item: a broad "
        "item (for example 'liaise with teams') is NOT served by a technical module just because it is related. "
        "Return an empty list when the posting does not ask for what the module teaches. Do NOT add modules because "
        "they are common in this kind of role: only what THIS posting says counts.\n"
        'Return {"modules": {"<module id>": ["<item text>", ...]}}'
    )


def parse_target_answer(data: dict[str, Any], skills: list[dict[str, Any]], targets: list[str]) -> dict[str, list[str]]:
    """Keep only mappings to real items; an unknown item or module id never counts."""
    allowed = {norm(t): t for t in targets}
    raw = data.get("modules") if isinstance(data, dict) else None
    out: dict[str, list[str]] = {}
    for s in skills:
        served = []
        for item in (raw or {}).get(s["id"], []) if isinstance(raw, dict) else []:
            hit = allowed.get(norm(str(item)))
            if hit and hit not in served:
                served.append(hit)
        out[s["id"]] = served
    return out


# Abilities every job lists. An item made only of these can be served by a module that IS that ability, but it
# must not drag in a technical module that merely shares a word ("Report Writing" -> "Annual cybersecurity incident report").
_GENERIC_WORDS = {
    "report", "writing", "written", "verbal", "communication", "communicate", "analytical", "analysis", "analytic", "thinking",
    "research", "attention", "detail", "critical", "ethics", "ethical", "integrity", "problem", "solving", "team", "teamwork",
    "skills", "skill", "ability", "strong", "good", "excellent", "knowledge", "understanding", "basic", "general", "management",
    "time", "organisational", "organizational", "interpersonal", "presentation", "documentation",
}


def _distinct(text: str) -> set[str]:
    return {w[:6] for w in re.findall(r"[a-z]{3,}", (text or "").lower())}


_GENERIC_STEMS = {w[:6] for w in _GENERIC_WORDS}


def is_generic_item(text: str) -> bool:
    toks = _distinct(text)
    return bool(toks) and toks <= _GENERIC_STEMS


def drop_loose_mappings(skills: list[dict[str, Any]], serves: dict[str, list[str]]) -> dict[str, list[str]]:
    """A generic posting item (only generic-ability words) keeps a module only when the module is itself that
    generic skill: every distinctive word of the module's name is generic too."""
    out: dict[str, list[str]] = {}
    for s in skills:
        module_generic = _distinct(s["name"]) <= _GENERIC_STEMS
        out[s["id"]] = [t for t in serves.get(s["id"], []) if not is_generic_item(t) or module_generic]
    return out


def select_core(
    skills: list[dict[str, Any]],
    phase_names: dict[str, str],
    serves: dict[str, list[str]],
) -> tuple[set[str], set[str]]:
    """Split blueprint skills into (core, beyond). Core = serves the posting, is part of the job-search phase,
    or is a prerequisite of a core skill. Too few core skills means the mapping can't be trusted: keep all."""
    by_id = {s["id"]: s for s in skills}
    serves = drop_loose_mappings(skills, serves)
    wanted = {s["id"] for s in skills if serves.get(s["id"])}
    # Prerequisites are pulled in for skills the POSTING needs, ONE level only: following them transitively
    # (the capstone depends on everything) would bring the whole blueprint back.
    core = set(wanted)
    for sid in wanted:
        for pre in by_id[sid].get("prerequisites", []):
            if pre in by_id:
                core.add(pre)
    if len(core) < MIN_CORE_SKILLS:
        return set(by_id), set()
    core |= {s["id"] for s in skills if _ALWAYS_CORE_PHASE.search(phase_names.get(s["phase"], ""))}
    return core, set(by_id) - core


async def map_skills_to_posting(
    job_title: str, targets: list[str], skills: list[dict[str, Any]], cache_key: str | None = None,
) -> dict[str, list[str]] | None:
    """One cached LLM call. Returns None when it cannot be done (the caller then keeps every skill)."""
    if not targets or not skills:
        return None
    import json

    try:
        from app.modules.jobs.plan_router import _redis
        cached = _redis().get(cache_key) if cache_key else None
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    from app.modules.roadmap_engine.llm import complete_json
    try:
        data = await complete_json(TARGET_SYSTEM, build_target_prompt(job_title, targets, skills), 4000, 0.0, effort="low")
    except Exception as exc:
        logger.warning("posting targeting failed (%s); keeping every blueprint skill", exc)
        return None
    result = parse_target_answer(data, skills, targets)
    if cache_key:
        try:
            from app.modules.jobs.plan_router import _redis
            _redis().set(cache_key, json.dumps(result), ex=60 * 60 * 24 * 14)
        except Exception:
            pass
    return result
