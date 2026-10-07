"""Read-only API for the reference catalogue of roles organisations hire UPSC aspirants for.

These are research records, NOT vacancies: there is no apply action and no opening behind them. Every response
carries `reference_notice` so a client cannot show one without saying so.
"""
from __future__ import annotations

import uuid
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Text, cast, func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.market_role import MarketRole
from app.models.reference_data import CandidateSegment
from app.models.user import User
from app.modules.market_roles import fit as fit_mod

router = APIRouter(prefix="/reference-roles", tags=["Reference roles"])

NOTICE = ("This is a reference role from research data on what organisations hire UPSC aspirants for. "
          "It is not an open vacancy and cannot be applied to here. Salaries and fit scores are research estimates.")
SORTS = {"fit": MarketRole.candidate_fit_score.desc().nullslast(), "salary": MarketRole.entry_salary_max.desc().nullslast(),
         "company": func.lower(MarketRole.company_name), "role": func.lower(MarketRole.job_role)}


def _salary(r: MarketRole) -> dict[str, Any]:
    f = lambda v: float(v) if v is not None else None  # noqa: E731
    return {lvl: {"text": getattr(r, f"{lvl}_salary_text"), "min": f(getattr(r, f"{lvl}_salary_min")),
                  "max": f(getattr(r, f"{lvl}_salary_max"))} for lvl in ("entry", "mid", "senior")} | {"notes": r.salary_notes or {}}


def _card(r: MarketRole) -> dict[str, Any]:
    return {
        "id": str(r.id), "company_name": r.company_name, "job_role": r.job_role, "industry": r.industry,
        "company_type": r.company_type, "headquarters": r.headquarters, "hiring_locations": r.hiring_locations_list,
        "website_url": r.website_url, "required_skills": r.required_skills,
        "entry_salary": {"text": r.entry_salary_text, "min": float(r.entry_salary_min) if r.entry_salary_min is not None else None,
                         "max": float(r.entry_salary_max) if r.entry_salary_max is not None else None},
        "candidate_fit_score": r.candidate_fit_score,
        "suitable_candidate_categories": r.suitable_candidate_categories,
        "is_reference": True, "reference_notice": NOTICE,
    }


def _detail(r: MarketRole) -> dict[str, Any]:
    return _card(r) | {
        "sub_industry": r.sub_industry, "department": r.department, "job_description": r.job_description,
        "key_responsibilities": r.responsibilities_list, "preferred_skills": r.preferred_skills,
        "transferable_upsc_skills": r.transferable_upsc_skills, "upsc_skill_mapping": r.upsc_skill_mapping,
        "employability_score": r.employability_score, "hiring_suitability_score": r.hiring_suitability_score,
        "salary": _salary(r), "career_path_steps": r.career_path_steps, "future_growth": r.future_growth,
        "why_suitable": r.why_suitable, "additional_notes": r.additional_notes, "full_description": r.full_description,
    }


def _query(db: Session, q, industry, company_type, location, salary_min, salary_max, skill, category):
    qs = db.query(MarketRole)
    if q and q.strip():
        like = f"%{q.strip()}%"
        qs = qs.filter(or_(MarketRole.company_name.ilike(like), MarketRole.job_role.ilike(like), MarketRole.industry.ilike(like),
                           cast(MarketRole.required_skills, Text).ilike(like)))
    if industry:
        qs = qs.filter(MarketRole.industry == industry)
    if company_type:
        qs = qs.filter(MarketRole.company_type == company_type)
    if location:
        qs = qs.filter(MarketRole.hiring_locations_list.contains([location]))
    if salary_min is not None:        # entry-level band overlaps [salary_min, salary_max]
        qs = qs.filter(MarketRole.entry_salary_max >= salary_min)
    if salary_max is not None:
        qs = qs.filter(MarketRole.entry_salary_min <= salary_max)
    if skill and skill.strip():
        s = f"%{skill.strip()}%"
        qs = qs.filter(or_(cast(MarketRole.required_skills, Text).ilike(s), cast(MarketRole.preferred_skills, Text).ilike(s)))
    if category:
        qs = qs.filter(MarketRole.suitable_candidate_categories.contains([category]))
    return qs


@router.get("")
def list_roles(
    q: str | None = None, industry: str | None = None, company_type: str | None = None, location: str | None = None,
    salary_min: float | None = Query(None, ge=0, le=500), salary_max: float | None = Query(None, ge=0, le=500),
    skill: str | None = None, category: str | None = None,
    sort: str = Query("fit", pattern="^(fit|salary|company|role)$"),
    page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=50),
    _: User = Depends(get_current_aspirant), db: Session = Depends(get_db),
):
    qs = _query(db, q, industry, company_type, location, salary_min, salary_max, skill, category)
    total = qs.count()
    rows = qs.order_by(SORTS[sort], MarketRole.company_name).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_card(r) for r in rows], "total": total, "page": page, "page_size": page_size, "reference_notice": NOTICE}


@router.get("/filters")
def filters(_: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    rows = db.query(MarketRole).all()
    top = lambda c: [{"value": v, "count": n} for v, n in c.most_common()]  # noqa: E731
    segs = db.query(CandidateSegment).order_by(CandidateSegment.category_no).all()
    return {
        "industries": top(Counter(r.industry for r in rows if r.industry)),
        "company_types": top(Counter(r.company_type for r in rows if r.company_type)),
        "locations": top(Counter(l for r in rows for l in r.hiring_locations_list or [])),
        "categories": top(Counter(c for r in rows for c in r.suitable_candidate_categories or [])),
        "candidate_segments": [{"no": s.category_no, "name": s.category_name} for s in segs],
        "total": len(rows),
    }


def _get(db: Session, role_id: str) -> MarketRole:
    try:
        key = uuid.UUID(role_id)
    except ValueError:
        raise NotFoundException("Role not found")
    r = db.get(MarketRole, key)
    if not r:
        raise NotFoundException("Role not found")
    return r


@router.get("/{role_id}")
def role_detail(role_id: str, _: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    return _detail(_get(db, role_id)) | {"reference_notice": NOTICE}


@router.get("/{role_id}/skill-fit")
def role_skill_fit(role_id: str, user: User = Depends(get_current_aspirant), db: Session = Depends(get_db)):
    """Profile skills vs this role's required/preferred skills. Profile only: the resume is not read here."""
    from app.models.user import AspirantProfile
    from app.modules.roadmap_engine import skill_bridge
    r = _get(db, role_id)
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    skills = [s for s in (profile.skills or []) if isinstance(s, str) and s.strip()] if profile else []
    if not skills:
        return {"needs_profile_skills": True, "based_on": "your profile skills", "reference_notice": NOTICE,
                "message": "Add skills to your profile to see how they line up with this role."}
    out = fit_mod.skill_fit(r.required_skills or [], r.preferred_skills or [], skills, skill_bridge.load_rows(db))
    return out | {"needs_profile_skills": False, "profile_skill_count": len(skills),
                  "transferable_upsc_skills": r.transferable_upsc_skills, "reference_notice": NOTICE}
