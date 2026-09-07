"""Validates a typed custom skill before it's trusted enough to (a) go on a
user's profile and (b) join skill_taxonomy for everyone else's suggestions.

Two-stage check, cheapest first:
  1. ESCO (free, public, no key) — fast path for skills that map cleanly onto
     a taxonomy entry (programming languages, named software, etc).
  2. Our own LLM — ESCO is phrased as competency statements ("adapt
     leadership styles in healthcare"), not flat skill names, so common terms
     like "Excel" or "Leadership" often have no clean ESCO match despite
     being obviously real. The LLM is the actual arbiter for those; ESCO
     just avoids paying an LLM call for the easy majority.
Both stages can fail closed (network hiccup, quota exhausted) — a skill only
ever gets added on a confirmed "yes", never on a technicality.
"""
from __future__ import annotations

import logging
import re

import httpx
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import SkillTaxonomy

logger = logging.getLogger(__name__)

ESCO_SEARCH_URL = "https://ec.europa.eu/esco/api/search"

# Trivial pre-filter so a stopword never even reaches ESCO/the LLM — ESCO's
# full-text search matches "the" against 1000+ unrelated descriptions.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
    "with", "is", "are", "was", "were", "be", "been", "this", "that", "it",
    "as", "by", "from", "love", "like", "hate", "yes", "no",
}


def find_known_skill(name: str, db: Session) -> str | None:
    """Case-insensitive exact lookup — the fast path for anything already
    validated (curated, platform-seeded, or a prior user's custom skill)."""
    row = db.query(SkillTaxonomy).filter(func.lower(SkillTaxonomy.name) == name.strip().lower()).first()
    return row.name if row else None


async def _check_esco(name: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                ESCO_SEARCH_URL,
                params={"text": name, "language": "en", "type": "skill", "limit": 10},
            )
        resp.raise_for_status()
        results = resp.json().get("_embedded", {}).get("results", [])
    except Exception as exc:
        logger.warning("[SKILL_VALIDATE] ESCO lookup failed for %r: %s", name, exc)
        return False

    pattern = re.compile(r"\b" + re.escape(name.strip().lower()) + r"\b")
    return any(pattern.search((r.get("title") or "").lower()) for r in results)


_VALIDATE_SYSTEM = (
    "You are a strict skill-taxonomy validator for a career platform. Given a "
    "single candidate skill name, decide whether it is a genuine, recognized "
    "professional, technical, academic, or soft skill that a real person "
    "could plausibly list on a resume or job profile — not a random word, "
    "a full sentence, or gibberish.\n\n"
    'Respond with ONLY one word: "yes" or "no". No punctuation, no explanation.'
)


async def _check_llm(name: str) -> bool:
    from app.ai.providers import create_provider
    from app.ai.providers.groq import LIGHT_MODEL, RateLimitedError

    provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")
    try:
        # gpt-oss reasons before answering, and those reasoning tokens draw
        # from the same max_tokens budget as the actual answer (see
        # GroqProvider's own docstring) — an ambiguous single word like
        # "Excel" can burn the whole budget on deliberation and leave
        # content empty at anything under ~100 tokens, even though the
        # final answer is always just one word.
        response = await provider.complete(
            _VALIDATE_SYSTEM,
            [{"role": "user", "content": f'Candidate skill: "{name}"'}],
            max_tokens=200,
            temperature=0.0,
        )
    except (RateLimitedError, RuntimeError) as exc:
        # Fail closed — an unreachable validator should never silently pass
        # unvalidated text into the taxonomy.
        logger.warning("[SKILL_VALIDATE] LLM check unavailable for %r: %s", name, exc)
        return False
    content = response.content.strip().lower()
    if not content:
        logger.warning("[SKILL_VALIDATE] LLM returned empty content for %r — treating as unverified", name)
        return False
    return content.startswith("yes")


async def validate_and_register_skill(name: str, db: Session) -> str | None:
    """Returns the canonical name to save if `name` is a real skill, else None.
    A confirmed skill is inserted into skill_taxonomy so it's a one-time
    validation cost, not a per-user one."""
    text = name.strip()
    if not (2 <= len(text) <= 60) or not re.search(r"[A-Za-z]", text):
        return None
    if text.lower() in _STOPWORDS:
        return None

    existing = find_known_skill(text, db)
    if existing:
        return existing

    source = "esco"
    ok = await _check_esco(text)
    if not ok:
        source = "llm"
        ok = await _check_llm(text)
    if not ok:
        return None

    db.add(SkillTaxonomy(name=text, source=source))
    try:
        db.commit()
    except IntegrityError:
        # Race: another request validated the same skill concurrently.
        db.rollback()
        existing = find_known_skill(text, db)
        return existing or text
    return text
