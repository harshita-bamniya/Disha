"""Resume text -> CandidateProfile.

The LLM reads (with an enforced JSON schema); code then verifies and derives.
Evidence bullets must exist verbatim in the resume, otherwise they are dropped,
and each skill's "last used" year is computed from the role that contains its
evidence, not taken from the model.
"""
from __future__ import annotations

import re
from datetime import date

from .llm import complete_structured
from .redact import redact_resume_text
from .schemas import CandidateProfile

PARSER_VERSION = "1"

SYSTEM = """You convert a resume into structured JSON for a job-matching system. The name and contact \
details have been removed on purpose.
Rules:
- Use ONLY what is written in the resume. Never infer or add skills, employers, dates or degrees.
- roles: one per job, newest first. start/end as "YYYY-MM" (or "YYYY" if only a year is given); end "present" \
if current. Copy each bullet VERBATIM into that role's bullets.
- projects: personal/academic projects with their bullets copied verbatim.
- skills: every distinct hard skill (tools, languages, frameworks, methods) and soft skill the resume shows, \
whether listed in a skills section or used in a bullet. category "hard" or "soft". For each, evidence = the \
bullets (copied VERBATIM, up to 3) in which the skill was actually used; leave evidence empty if it is only \
listed. Use the skill's common name (e.g. "PostgreSQL", "Project management").
- education: degree_level is one of none, diploma, bachelor, master, doctorate; field as written; year of completion.
- certifications: names of certifications and licences as written.
- industries: the industries/domains of the employers (e.g. "fintech", "healthcare", "e-commerce"); at most 4."""


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", s.lower()).strip()


def _year_of(value: str | None, today: date) -> int | None:
    if not value:
        return None
    if value.strip().lower() in {"present", "current", "now", "ongoing"}:
        return today.year
    m = re.match(r"\s*(\d{4})", value)
    return int(m.group(1)) if m else None


def verify_profile(profile: CandidateProfile, resume_text: str, today: date | None = None) -> CandidateProfile:
    """Drop unverifiable evidence and derive recency. Pure; safe to unit test."""
    today = today or date.today()
    corpus = _norm(resume_text)

    def in_resume(bullet: str) -> bool:
        b = _norm(bullet)
        return bool(b) and b in corpus

    for role in profile.roles:
        role.bullets = [b for b in role.bullets if in_resume(b)]
    for proj in profile.projects:
        proj.bullets = [b for b in proj.bullets if in_resume(b)]

    # bullet -> most recent year it appears in (projects have no dates: treated as current)
    bullet_year: dict[str, int] = {}
    for role in profile.roles:
        year = _year_of(role.end, today) or _year_of(role.start, today)
        for b in role.bullets:
            if year is not None:
                bullet_year[_norm(b)] = max(year, bullet_year.get(_norm(b), 0))
    for proj in profile.projects:
        for b in proj.bullets:
            bullet_year.setdefault(_norm(b), today.year)

    for skill in profile.skills:
        skill.evidence = [b for b in skill.evidence if in_resume(b)][:3]
        years = [bullet_year[_norm(b)] for b in skill.evidence if _norm(b) in bullet_year]
        skill.last_used_year = max(years) if years else None
    return profile


async def parse_resume(resume_text: str, today: date | None = None) -> CandidateProfile:
    redacted = redact_resume_text(resume_text)[:12000]
    profile = await complete_structured(SYSTEM, f"RESUME:\n{redacted}", CandidateProfile, max_tokens=6000)
    # Verify against the redacted text the model actually saw.
    return verify_profile(profile, redacted, today)
