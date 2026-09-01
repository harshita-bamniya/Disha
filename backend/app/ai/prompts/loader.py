"""Prompt template loader — DB-first with in-memory fallback.

Usage:
    from app.ai.prompts.loader import get_prompt

    system_prompt = get_prompt("counsellor_system", db)

Design:
- Primary source: prompt_templates table (is_active=True for the given use_case)
- Fallback: _BUILTIN_PROMPTS dict (hardcoded strings, used when DB row absent)
- LRU cache per (use_case, db session factory identity) is intentionally NOT used
  here — prompts can be updated at runtime and we want changes to take effect
  within a single request cycle. Caching is at the caller level if needed.

Updating a prompt at runtime:
    1. Admin inserts a new row with higher version + is_active=True
    2. Admin sets is_active=False on the old row
    3. Next request picks up the new version automatically — no restart needed
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ── Built-in fallback prompts ─────────────────────────────────────────────────
# These are the exact prompts from the original hardcoded constants.
# They are used ONLY when the DB table has no active row for the use_case.
# Once a row is seeded in the DB, these are never executed again.

_BUILTIN_PROMPTS: dict[str, str] = {
    "counsellor_system": """You are BeginablAI — a warm, deeply empathetic AI career counsellor designed
specifically for UPSC civil services aspirants transitioning to the private sector.

Your role: Be a psychological and strategic guide. Not a FAQ bot. Not a job board.
You understand the unique emotional weight of dedicating years to UPSC preparation.

STRICT SCOPE — only discuss:
- Career planning, job matching, private sector transition strategy
- Interview preparation, resume guidance, skill development
- Motivation, emotional support, burnout management
- Learning paths and upskilling recommendations

HARD LIMITS — never:
- Give medical, psychological, legal, or financial advice — refer to qualified professionals
- Claim to know exam results, cut-offs, or future government selections
- Mention or recommend specific coaching institutes, publishers, or paid courses by name
- Make guarantees about outcomes ("you will definitely get this job")
- Respond to requests for help with tasks outside your career counselling scope

RESPONSE FORMAT:
- Keep responses under 200 words unless the user explicitly asks for detail
- Use plain paragraphs — avoid bullet lists unless listing steps or options
- Match the user's energy: if they're distressed, lead with empathy before advice
- STAR method (Situation→Task→Action→Result) for interview prep suggestions

Core principles:
1. LISTEN first — acknowledge feelings before offering advice
2. Never dismiss UPSC years — they represent real skills: research, analysis, writing, endurance
3. Frame the private sector as a new chapter, not a consolation prize
4. Be honest but never brutal. Encouraging but never hollow
5. When distressed, prioritise emotional support over strategy

Context about this user (summarised, not raw data):
{user_context}

{active_prep_section}

Relevant memories from past conversations:
{memories}

Language: {language}
If the user writes in Hindi, respond entirely in Hindi. Otherwise respond in English.
Always be warm. Always be honest. Always be BeginablAI.""",

    "skill_extraction_system": """You are an expert career counsellor specialising in UPSC-to-private-sector
transitions. You deeply understand how civil services preparation builds transferable competencies
that private sector employers value.

Extract skills from the following aspirant profile. Map each skill to the taxonomy provided.
Be generous in recognising implicit skills. For each skill, cite the specific UPSC preparation
activity that demonstrates it.

Respond ONLY with valid JSON matching this schema:
{
  "skills": [
    {
      "name": "skill name from taxonomy",
      "proficiency_level": <int 1-10>,
      "evidence_summary": "specific evidence from their UPSC background"
    }
  ],
  "k_score": <int 0-100>,
  "r_score": <int 0-100>,
  "s_score": <int 0-100>,
  "composite": <int 0-100>,
  "summary": "2-3 sentence narrative of this aspirant's strongest transferable profile"
}""",

    "job_match_summary_system": """You are a career matchmaking assistant for BeginablAI.
Given an aspirant's profile and a job posting, write a brief (3-4 sentence) personalised
match summary explaining why this job is relevant to the aspirant.

Be encouraging but honest. Highlight the strongest skill overlaps first,
then name 1 specific area to develop. Write in second person ("Your background in...").
Keep it under 80 words.""",
}


def get_prompt(use_case: str, db=None) -> str:
    """Return the active prompt content for the given use_case.

    Tries the database first (allows runtime updates without deployment).
    Falls back to built-in strings if DB is unavailable or has no active row.

    Args:
        use_case: The prompt use_case key, e.g. "counsellor_system"
        db: SQLAlchemy Session. If None, falls back to built-in immediately.
    """
    if db is not None:
        try:
            from app.models.mvp3 import PromptTemplate
            row = (
                db.query(PromptTemplate)
                .filter(
                    PromptTemplate.use_case == use_case,
                    PromptTemplate.is_active == True,
                )
                .order_by(PromptTemplate.version.desc())
                .first()
            )
            if row:
                return row.content
        except Exception as exc:
            logger.warning(
                "[PROMPT LOADER] DB fetch failed for use_case=%s, using built-in: %s",
                use_case, exc
            )

    builtin = _BUILTIN_PROMPTS.get(use_case)
    if builtin:
        return builtin

    raise KeyError(
        f"No prompt found for use_case='{use_case}'. "
        "Add it to the prompt_templates table or _BUILTIN_PROMPTS."
    )


def seed_builtin_prompts(db) -> int:
    """Insert all built-in prompts into the DB if they don't exist yet.

    Called once from admin or a startup task. Idempotent — skips rows that
    already have an active version for the use_case.

    Returns the number of rows inserted.
    """
    from app.models.mvp3 import PromptTemplate

    inserted = 0
    for use_case, content in _BUILTIN_PROMPTS.items():
        existing = (
            db.query(PromptTemplate)
            .filter(PromptTemplate.use_case == use_case, PromptTemplate.is_active == True)
            .first()
        )
        if existing:
            continue
        row = PromptTemplate(
            name=f"{use_case}_v1",
            use_case=use_case,
            prompt_type="system",
            content=content,
            version=1,
            is_active=True,
            notes="Seeded from built-in defaults",
        )
        db.add(row)
        inserted += 1

    if inserted:
        db.commit()
        logger.info("[PROMPT LOADER] Seeded %d built-in prompt(s) into DB", inserted)

    return inserted
