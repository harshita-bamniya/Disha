"""The evidence a blueprint is grounded in.

Primary source: `market_roles` (the research catalogue of roles organisations hire UPSC aspirants for).
Secondary source: the live posting itself plus any similar live postings.

Both are matched to the role family by embedding, but only roles that clear a relevance floor count: when
the catalogue has nothing for a family (it holds no software roles, say) the corpus honestly stays small
and the blueprint says so, instead of padding it with unrelated roles.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.market_role import MarketRole
from app.models.user import JobPosting
from app.modules.recommendations import embedder

ROLE_MAX = 12                   # catalogue roles fed to the drafting prompt and counted as evidence
ROLE_FLOOR = 0.70               # relevance floor (embedding + title overlap); in-family roles score 0.74+, others <= 0.60
MIN_ROLES = 3                   # fewer than this and the catalogue is not treated as covering the family
POSTING_MAX = 4                 # live postings kept as a secondary source (plus the job itself)
POSTING_FLOOR = 0.70
MATCH_SHARE = 0.6               # share of a skill's significant words that must appear in a role's text

_STOP = {"and", "the", "for", "with", "of", "to", "in", "on", "a", "an", "&", "using", "basics", "introduction"}


def tokens(text: str) -> set[str]:
    return {t[:6] for t in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if t not in _STOP}


def _cos(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    return float(embedder.cosine_similarity(a, b))


def role_text(r: MarketRole) -> str:
    """What a catalogue role asks for, as one string (used for evidence)."""
    return " ".join([
        r.job_role or "", ", ".join(r.required_skills or []), ", ".join(r.preferred_skills or []),
        r.key_responsibilities or "", r.job_description or "",
    ])


def role_query_text(r: MarketRole) -> str:
    return f"{r.job_role}. {', '.join(r.required_skills or [])}. {(r.key_responsibilities or '')[:600]}"


def _job_text(job: JobPosting) -> str:
    return f"{job.title}. {', '.join(job.required_skills or [])}. {(job.description or '')[:1200]}"


def _score(job_title: str, job_vec, title: str, vec) -> float:
    jt = tokens(job_title)
    return _cos(job_vec, vec) + 0.15 * len(jt & tokens(title)) / max(1, len(jt))


def select_roles(
    job_title: str, job_vec: list[float] | None, roles: list[MarketRole], vecs: list[list[float] | None],
    limit: int = ROLE_MAX, floor: float = ROLE_FLOOR,
) -> list[MarketRole]:
    """Catalogue roles of the same family, best first. Roles under the relevance floor are never included."""
    scored = sorted(((_score(job_title, job_vec, r.job_role, v), r) for r, v in zip(roles, vecs)), key=lambda p: p[0], reverse=True)
    return [r for s, r in scored[:limit] if s >= floor]


def similar_roles(db: Session, job: JobPosting) -> list[MarketRole]:
    roles = db.query(MarketRole).all()
    if not roles:
        return []
    jv = embedder.embed(_job_text(job))
    vecs = embedder.embed_batch([role_query_text(r) for r in roles])
    picked = select_roles(job.title, jv, roles, vecs)
    return picked if len(picked) >= MIN_ROLES else []


def similar_live_postings(db: Session, job: JobPosting) -> list[JobPosting]:
    """The job itself plus a few genuinely similar live postings (secondary source)."""
    others = db.query(JobPosting).filter(JobPosting.id != job.id).all()
    picked: list[JobPosting] = []
    if others:
        jv = embedder.embed(_job_text(job))
        vecs = embedder.embed_batch([_job_text(o) for o in others])
        scored = sorted(((_score(job.title, jv, o.title, v), o) for o, v in zip(others, vecs)), key=lambda p: p[0], reverse=True)
        picked = [o for s, o in scored if s >= POSTING_FLOOR][:POSTING_MAX]
    return [job, *picked]


def _mentions(skill: dict[str, Any], text: str) -> bool:
    low = (text or "").lower()
    for label in (skill.get("name"), skill.get("core_topic")):
        toks = tokens(label or "")
        if toks and len({t for t in toks if t in low}) / len(toks) >= MATCH_SHARE:
            return True
    return False


def compute_evidence(skills: list[dict[str, Any]], role_texts: list[str], posting_texts: list[str]) -> None:
    """Per skill: in how many of the matched catalogue roles (and live postings) it is mentioned.

    `postings_*` keys are kept because the plan and the grounding rule already read them; they now describe
    live postings only, while `roles_*` describes the catalogue."""
    for s in skills:
        s["evidence"] = {
            "roles_matched": sum(1 for t in role_texts if _mentions(s, t)),
            "roles_total": len(role_texts),
            "postings_matched": sum(1 for t in posting_texts if _mentions(s, t)),
            "postings_total": len(posting_texts),
        }


def roles_block(roles: list[MarketRole], postings: list[JobPosting]) -> str:
    lines = []
    for i, r in enumerate(roles, 1):
        lines.append(
            f"[R{i}] {r.job_role} at {r.company_name} ({r.industry}) — required: {', '.join(r.required_skills or [])}; "
            f"preferred: {', '.join(r.preferred_skills or [])}\n    {(r.key_responsibilities or r.job_description or '')[:600]}"
        )
    for i, p in enumerate(postings, 1):
        lines.append(
            f"[P{i}] LIVE POSTING {p.title} ({p.sector or 'n/a'}) — skills: {', '.join(p.required_skills or [])}\n"
            f"    {(p.description or '')[:600]}"
        )
    return "\n".join(lines)


def sources_record(roles: list[MarketRole], postings: list[JobPosting]) -> dict[str, Any]:
    """What grounded the blueprint, so a reviewer can see it. Nothing is listed that was not in the prompt."""
    return {
        "roles_used": [{"id": str(r.id), "company": r.company_name, "role": r.job_role} for r in roles],
        "roles_total": len(roles),
        "postings_used": [{"id": str(p.id), "title": p.title} for p in postings],
        "postings_total": len(postings),
        "corpus": "market_roles" if roles else "live_postings_only",
    }
