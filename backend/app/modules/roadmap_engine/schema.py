"""Blueprint graph schema, normalisation and code-level validation.

The blueprint is the source of truth for a role's roadmap. Everything the LLM
drafts is normalised here and then checked *in code* — prerequisite ordering,
phase coverage, proof tasks — before it is stored or shown to anyone.
"""
from __future__ import annotations

import re
from typing import Any

PHASE_NAMES = ["Foundations", "Core skills", "Specialization", "Portfolio", "Job search"]
PROOF_TYPES = {"project", "quiz", "exercise", "case_study", "mock_test", "portfolio_piece"}
CONCEPT_TYPES = {"concept", "tool", "practice"}
MAX_SKILLS = 24
MIN_SKILLS = 8


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:80] or "item"


def _s(v: Any, limit: int = 400) -> str:
    return str(v).strip()[:limit] if v is not None else ""


def _list_of_str(v: Any, limit: int = 10, item_limit: int = 240) -> list[str]:
    if not isinstance(v, list):
        return []
    return [_s(x, item_limit) for x in v if _s(x, item_limit)][:limit]


def _ref_candidate(r: Any) -> dict[str, str] | None:
    """LLMs return references either as {title, url} objects or as bare URL strings."""
    if isinstance(r, str):
        r = {"url": r}
    if not isinstance(r, dict):
        return None
    url = _s(r.get("url"), 400)
    if not url.startswith("http"):
        return None
    return {"title": _s(r.get("title"), 160), "url": url}


def normalise_graph(raw: dict[str, Any]) -> dict[str, Any]:
    """Coerce raw LLM JSON into the canonical blueprint shape (lossy but safe)."""
    phases_in = raw.get("phases") if isinstance(raw.get("phases"), list) else []
    phases: list[dict[str, Any]] = []
    for i, p in enumerate(phases_in[:5]):
        if not isinstance(p, dict):
            continue
        gate = p.get("gate") if isinstance(p.get("gate"), dict) else {}
        gate_type = _s(gate.get("type"), 30)
        phases.append({
            "id": _s(p.get("id"), 40) or f"phase-{i + 1}",
            "name": _s(p.get("name"), 80) or PHASE_NAMES[min(i, 4)],
            "goal": _s(p.get("goal"), 300),
            "gate": {
                "type": gate_type if gate_type in PROOF_TYPES else "quiz",
                "description": _s(gate.get("description"), 300),
                "pass_criteria": _list_of_str(gate.get("pass_criteria"), 5),
            },
        })
    phase_ids = {p["id"] for p in phases}

    skills: list[dict[str, Any]] = []
    seen: set[str] = set()
    raw_skills = raw.get("skills") if isinstance(raw.get("skills"), list) else []
    for s in raw_skills[:MAX_SKILLS]:
        if not isinstance(s, dict):
            continue
        name = _s(s.get("name"), 120)
        if not name:
            continue
        sid = slugify(_s(s.get("id")) or name)
        if sid in seen:
            continue
        seen.add(sid)
        proof = s.get("proof") if isinstance(s.get("proof"), dict) else {}
        try:
            hours = float(s.get("base_hours") or 0)
        except (TypeError, ValueError):
            hours = 0.0
        try:
            shelf = float(s.get("shelf_life_years") or 5)
        except (TypeError, ValueError):
            shelf = 5.0
        phase = _s(s.get("phase"), 40)
        proof_type = _s(proof.get("type"), 30)
        concept = _s(s.get("concept_type"))
        refs = s.get("references") if isinstance(s.get("references"), list) else []
        skills.append({
            "id": sid,
            "name": name,
            "phase": phase if phase in phase_ids else (phases[0]["id"] if phases else ""),
            "prerequisites": [slugify(x) for x in _list_of_str(s.get("prerequisites"), 6, 80)],
            "base_hours": round(min(max(hours, 0), 60), 1),
            "why_for_role": _s(s.get("why_for_role"), 400),
            "concept_type": concept if concept in CONCEPT_TYPES else "concept",
            "shelf_life_years": min(max(shelf, 0.5), 15),
            "core_topic": _s(s.get("core_topic"), 60),
            # Queries are a search helper, so derive them when the model forgot (common for practice skills
            # like mock interviews) instead of rejecting an otherwise good blueprint.
            "search_queries": _list_of_str(s.get("search_queries"), 3, 120)
            or [f"{_s(s.get('core_topic'), 60) or name} tutorial for beginners"[:120]],
            "vetted_channels": _list_of_str(s.get("vetted_channels"), 5, 80),
            "proof": {
                "type": proof_type if proof_type in PROOF_TYPES else "project",
                "title": _s(proof.get("title"), 160),
                "brief": _s(proof.get("brief"), 600),
                "rubric": _list_of_str(proof.get("rubric"), 6, 200),
            },
            "references": [],  # filled + verified by blueprint.verify_references
            "reference_candidates": [c for c in (_ref_candidate(r) for r in refs[:3]) if c],
            "evidence": {"roles_matched": 0, "roles_total": 0, "postings_matched": 0, "postings_total": 0},
        })

    kit_in = raw.get("job_search_kit") if isinstance(raw.get("job_search_kit"), dict) else {}
    return {
        "role_title": _s(raw.get("role_title"), 160),
        "summary": _s(raw.get("summary"), 500),
        "job_ready_definition": _list_of_str(raw.get("job_ready_definition"), 6),
        "phases": phases,
        "skills": skills,
        "job_search_kit": {
            "resume_bullet_templates": _list_of_str(kit_in.get("resume_bullet_templates"), 6, 300),
            "interview_questions": _list_of_str(kit_in.get("interview_questions"), 20, 300),
            "where_to_apply": _list_of_str(kit_in.get("where_to_apply"), 8, 160),
            "profile_checklist": _list_of_str(kit_in.get("profile_checklist"), 8, 200),
        },
    }


def validate_graph(g: dict[str, Any]) -> list[str]:
    """Deterministic structural checks. Returns human-readable error strings."""
    errors: list[str] = []
    phases, skills = g.get("phases") or [], g.get("skills") or []
    if not (3 <= len(phases) <= 5):
        errors.append(f"Need 3-5 phases, got {len(phases)}.")
    if not (MIN_SKILLS <= len(skills) <= MAX_SKILLS):
        errors.append(f"Need {MIN_SKILLS}-{MAX_SKILLS} skills, got {len(skills)}.")
    if not g.get("job_ready_definition"):
        errors.append("job_ready_definition is empty.")

    ids = {s["id"] for s in skills}
    order = {s["id"]: i for i, s in enumerate(skills)}
    for p in phases:
        if not any(s["phase"] == p["id"] for s in skills):
            errors.append(f"Phase '{p['name']}' has no skills.")
        if not p["gate"]["description"]:
            errors.append(f"Phase '{p['name']}' has no exit-gate description.")
    for s in skills:
        if s["base_hours"] <= 0:
            errors.append(f"'{s['name']}' has no base_hours.")
        if not s["proof"]["title"] or not s["proof"]["brief"]:
            errors.append(f"'{s['name']}' has no proof task.")
        if not s["search_queries"]:
            errors.append(f"'{s['name']}' has no search_queries.")
        if not s["why_for_role"]:
            errors.append(f"'{s['name']}' has no why_for_role.")
        for pre in s["prerequisites"]:
            if pre not in ids:
                errors.append(f"'{s['name']}' has unknown prerequisite '{pre}'.")
            elif order[pre] >= order[s["id"]]:
                errors.append(f"'{s['name']}' lists prerequisite '{pre}' that comes after it.")
    if _has_cycle(skills):
        errors.append("Prerequisite graph has a cycle.")
    kit = g.get("job_search_kit") or {}
    if len(kit.get("interview_questions") or []) < 8:
        errors.append("job_search_kit needs at least 8 interview_questions.")
    return errors


def validate_graph_skeleton(g: dict[str, Any]) -> list[str]:
    """Checks that apply before proofs and the kit exist (skills, phases, ordering, hours)."""
    return [e for e in validate_graph(g)
            if "proof task" not in e and "interview_questions" not in e and "exit-gate" not in e]


def _has_cycle(skills: list[dict[str, Any]]) -> bool:
    graph = {s["id"]: list(s["prerequisites"]) for s in skills}
    state: dict[str, int] = {}

    def visit(n: str) -> bool:
        if state.get(n) == 1:
            return True
        if state.get(n) == 2 or n not in graph:
            return False
        state[n] = 1
        if any(visit(m) for m in graph[n]):
            return True
        state[n] = 2
        return False

    return any(visit(n) for n in graph)


def topo_order(skills: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Stable topological order: prerequisites first, otherwise original order."""
    by_id = {s["id"]: s for s in skills}
    done: set[str] = set()
    out: list[dict[str, Any]] = []

    def add(s: dict[str, Any], stack: tuple[str, ...] = ()) -> None:
        if s["id"] in done or s["id"] in stack:
            return
        for p in s["prerequisites"]:
            if p in by_id:
                add(by_id[p], stack + (s["id"],))
        done.add(s["id"])
        out.append(s)

    for s in skills:
        add(s)
    return out


def apply_repair(graph: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Apply a targeted LLM repair to a skeleton: `add_skills` (full skill objects for empty phases) and
    `fix_skills` ({id: {field: value}} for missing text fields). Returns a new normalised graph; anything
    malformed in the patch is ignored rather than trusted."""
    patch = patch if isinstance(patch, dict) else {}
    existing = {sk["id"] for sk in graph["skills"]}
    raw_skills: list[dict[str, Any]] = []
    for sk in graph["skills"]:
        raw = {k: v for k, v in sk.items() if k not in ("references", "reference_candidates", "evidence")}
        fix = (patch.get("fix_skills") or {}).get(sk["id"]) if isinstance(patch.get("fix_skills"), dict) else None
        if isinstance(fix, dict):
            for field in ("why_for_role", "search_queries", "base_hours", "concept_type", "core_topic"):
                if fix.get(field):
                    raw[field] = fix[field]
        raw_skills.append(raw)
    added = patch.get("add_skills") if isinstance(patch.get("add_skills"), list) else []
    for sk in added:
        if isinstance(sk, dict) and slugify(_s(sk.get("id")) or _s(sk.get("name"))) not in existing:
            raw_skills.append(sk)
            existing.add(slugify(_s(sk.get("id")) or _s(sk.get("name"))))
    rebuilt = normalise_graph({
        "role_title": graph.get("role_title"), "summary": graph.get("summary"),
        "job_ready_definition": graph.get("job_ready_definition"),
        "phases": graph["phases"], "skills": raw_skills, "job_search_kit": graph.get("job_search_kit"),
    })
    # normalise_graph keeps the first MAX_SKILLS; carry over proof/reference data of untouched skills
    old = {sk["id"]: sk for sk in graph["skills"]}
    for sk in rebuilt["skills"]:
        if sk["id"] in old:
            sk["proof"] = old[sk["id"]]["proof"]
            sk["references"] = old[sk["id"]]["references"]
            sk["reference_candidates"] = old[sk["id"]].get("reference_candidates", [])
    return rebuilt
