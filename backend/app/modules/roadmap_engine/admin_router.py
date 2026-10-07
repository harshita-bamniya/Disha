"""Admin review workflow for role blueprints.

A blueprint starts as `draft` (machine-drafted from real postings, judged, validated).
A domain reviewer reads it, edits anything wrong, and approves it -> `reviewed`.
Learners see the badge, so approval is a real quality gate, not a formality.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rbac import require_admin
from app.database import get_db
from app.models.role_blueprint import RoleBlueprint, SkillResource
from app.models.user import User
from app.modules.recommendations import embedder
from app.modules.roadmap_engine import targeting
from app.modules.roadmap_engine.blueprint import blueprint_text
from app.modules.roadmap_engine.schema import normalise_graph, validate_graph
from app.modules.roadmap_engine.video_library import _cache_key

router = APIRouter(prefix="/admin/roadmap-blueprints", tags=["Admin Roadmap Blueprints"])


def _get(db: Session, bp_id: UUID) -> RoleBlueprint:
    bp = db.query(RoleBlueprint).filter(RoleBlueprint.id == bp_id).first()
    if not bp:
        raise HTTPException(status_code=404, detail="Blueprint not found.")
    return bp


def _checklist(bp: RoleBlueprint) -> list[dict[str, Any]]:
    """What a reviewer should look at first — computed, so nothing depends on memory."""
    g, src = bp.graph, bp.sources or {}
    items: list[dict[str, Any]] = []
    judge = src.get("judge") or {}
    for gap in judge.get("missing_skills") or []:
        items.append({"kind": "missing_skill", "text": f"Hiring-manager review says this may be missing: {gap}"})
    for name in judge.get("weak_or_generic") or []:
        items.append({"kind": "generic_skill", "text": f"Flagged as vague or generic: {name}"})
    for s in g.get("skills", []):
        if not s.get("references"):
            items.append({"kind": "no_reference", "skill_id": s["id"], "text": f"No verified reference for '{s['name']}'"})
        elif any(not r.get("verified", True) for r in s["references"]):
            items.append({"kind": "unchecked_reference", "skill_id": s["id"], "text": f"Reference for '{s['name']}' could not be auto-checked — open it"})
    for e in src.get("validation_errors") or []:
        items.append({"kind": "validation", "text": e})
    evidence_n = src.get("roles_total", 0) + src.get("postings_total", 0)
    if evidence_n < 10:
        items.append({"kind": "thin_evidence", "text": f"Only {src.get('roles_total', 0)} reference roles and {src.get('postings_total', 0)} live postings behind this blueprint — market claims are hidden until 10+ roles."})
    items.append({"kind": "always", "text": "Check laws/regulations are current (e.g. renamed or replaced acts) and proof tasks are realistic."})
    return items


def _summary(bp: RoleBlueprint) -> dict[str, Any]:
    g, src = bp.graph or {}, bp.sources or {}
    skills = g.get("skills", [])
    return {
        "id": str(bp.id), "slug": bp.slug, "title": bp.title, "version": bp.version,
        "review_status": bp.review_status, "is_current": bp.is_current,
        "skills": len(skills), "total_base_hours": round(sum(s.get("base_hours", 0) for s in skills), 1),
        "postings_analyzed": src.get("postings_total", 0),
        "roles_analyzed": src.get("roles_total", 0),
        "grounding": targeting.grounding(skills),
        "judge_score": (src.get("judge") or {}).get("score"),
        "skills_without_reference": sum(1 for s in skills if not s.get("references")),
        "reviewed_by": bp.reviewed_by, "reviewed_at": bp.reviewed_at.isoformat() if bp.reviewed_at else None,
        "updated_at": bp.updated_at.isoformat() if bp.updated_at else None,
    }


@router.get("")
def list_blueprints(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(RoleBlueprint).order_by(RoleBlueprint.is_current.desc(), RoleBlueprint.title, RoleBlueprint.version.desc()).all()
    return [_summary(b) for b in rows]


@router.get("/{bp_id}")
def get_blueprint(bp_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    bp = _get(db, bp_id)
    return {**_summary(bp), "graph": bp.graph, "sources": bp.sources, "review_notes": bp.review_notes, "checklist": _checklist(bp)}


class GraphEdit(BaseModel):
    graph: dict[str, Any]


@router.put("/{bp_id}/graph")
def edit_graph(bp_id: UUID, body: GraphEdit, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Reviewer edits. The graph is re-normalised and must pass the same structural checks as a draft."""
    bp = _get(db, bp_id)
    graph = normalise_graph(body.graph)
    # Keep already-verified references unless the editor supplied new candidates for that skill.
    old = {s["id"]: s for s in bp.graph.get("skills", [])}
    for s in graph["skills"]:
        if not s["references"] and s["id"] in old:
            s["references"] = old[s["id"]].get("references", [])
        if s["id"] in old:
            s["evidence"] = old[s["id"]].get("evidence", s["evidence"])
    errors = validate_graph(graph)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Blueprint failed validation.", "errors": errors})
    bp.graph = graph
    bp.embedding = embedder.embed(blueprint_text(bp.title, graph))
    bp.review_status = "draft"          # any edit needs a fresh approval
    bp.reviewed_by, bp.reviewed_at = None, None
    db.commit()
    return _summary(bp)


class ReviewDecision(BaseModel):
    decision: Literal["approve", "needs_changes", "retire"]
    notes: str | None = None


@router.post("/{bp_id}/review")
def review(bp_id: UUID, body: ReviewDecision, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    bp = _get(db, bp_id)
    if body.decision in ("approve", "needs_changes") and len((body.notes or "").strip()) < 10:
        raise HTTPException(status_code=422, detail="Write a short review note (what you checked or what must change) before saving this decision.")
    if body.decision == "approve":
        errors = validate_graph(bp.graph)
        if errors:
            raise HTTPException(status_code=422, detail={"message": "Cannot approve a blueprint with validation errors.", "errors": errors})
        bp.review_status = "reviewed"
        bp.reviewed_by = user.email or str(user.id)
        bp.reviewed_at = datetime.now(timezone.utc)
    elif body.decision == "retire":
        bp.is_current = False
        bp.review_status = "draft"
    else:
        bp.review_status = "draft"
        bp.reviewed_by, bp.reviewed_at = None, None
    bp.review_notes = body.notes
    db.commit()
    return _summary(bp)


@router.post("/{bp_id}/refresh-videos")
def refresh_videos(bp_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Drop the cached video picks for this blueprint's skills so the next roadmap re-searches them."""
    bp = _get(db, bp_id)
    keys: list[str] = []
    for s in bp.graph.get("skills", []):
        q = (s.get("search_queries") or [s["name"]])[0]
        for level in ("beginner", "intermediate"):
            keys.append(_cache_key(q, "en", level))
    n = db.query(SkillResource).filter(SkillResource.cache_key.in_(keys)).delete(synchronize_session=False)
    db.commit()
    return {"cleared": n}
