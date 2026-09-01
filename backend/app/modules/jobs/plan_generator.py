"""AI service that generates a job-specific learning roadmap.

Given a job posting and a user's current skills, asks Groq to produce
a structured, prioritised list of skill modules each with concrete
YouTube / article resources and time estimates.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import urllib.parse
from typing import Any, Awaitable, Callable

import sentry_sdk

from app.ai.article_search import resolve_article_url
from app.ai.providers import create_provider
from app.ai.youtube_search import search_youtube

logger = logging.getLogger(__name__)

_groq = create_provider()

_PLAN_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


def _plan_cache_key(
    job_id: str,
    gap_skills: list[str],
    k_score: int | None = None,
    burnout_score: int | None = None,
    confidence_score: int | None = None,
    preferred_learning_format: str | None = None,
    learning_challenge: str | None = None,
) -> str:
    # Bucket continuous scores into bands so minor fluctuations don't bust the cache
    # while still separating meaningfully different profiles.
    def _band(score: int | None) -> str:
        if score is None:
            return "x"
        if score >= 75:
            return "h"
        if score >= 50:
            return "m"
        if score >= 30:
            return "d"
        return "l"

    payload = "|".join([
        job_id,
        ",".join(sorted(s.lower().strip() for s in gap_skills)),
        _band(k_score),
        _band(burnout_score),
        _band(confidence_score),
        preferred_learning_format or "x",
        learning_challenge or "x",
    ])
    return "plan:cache:" + hashlib.sha256(payload.encode()).hexdigest()[:24]


def _redis():
    import redis as redis_lib
    from app.config import get_settings
    return redis_lib.from_url(get_settings().redis_url, decode_responses=True)

SYSTEM_PROMPT = """\
You are BeginablAI's career learning planner. You create hyper-specific, actionable
learning roadmaps for UPSC aspirants transitioning to private-sector careers.

Given a target job and the user's skill gaps, produce a JSON learning plan.
Be concrete: name real YouTube channels and real search queries people actually use.
Prioritise breadth-first (most impactful skills first) then depth.

Return ONLY valid JSON — no markdown fences, no commentary."""

PLAN_PROMPT = """\
Job Title: {job_title}
Company: {company}
Sector: {sector}
Job Description: {description}
Skills Required by Employer: {required_skills}

User's Current Skills: {user_skills}
Identified Skill Gaps: {gap_skills}
{interaction_history_block}
CANDIDATE PROFILE:
- Knowledge Readiness (K-score): {k_score_label} ({k_score}/100)
- Readiness to Switch (R-score): {r_score_label} ({r_score}/100)
- Skills Match (S-score): {s_score_label} ({s_score}/100)
- Burnout Level: {burnout_label} ({burnout_score}/100)
- Confidence in Transition: {confidence_label} ({confidence_score}/100)
- Work Experience: {work_experience}
- Preferred Learning Format: {learning_format_label}
- Biggest Learning Challenge: {learning_challenge_label}

UPSC BACKGROUND (use this to recognise what knowledge the candidate already has):
- Exam: {upsc_exam_label}
- Highest Stage Cleared: {upsc_stage_label}
- Years Preparing: {years_preparing_label}
- Optional Subject: {optional_subject_label}
- Target Sectors: {preferred_sectors_label}

Apply these CONCRETE rules — do not ignore them:

BURNOUT RULES (based on burnout score above):
- Score ≥ 70 (High): cap every module's estimated_hours at 4; keep project_deliverable completable in one 90-minute sitting; prefer "beginner", "intro", or "crash course" resource titles
- Score 40–69 (Moderate): cap estimated_hours at 6; mix one intro resource with one intermediate per module
- Score < 40 (Low): estimated_hours up to 12; include at least one advanced or deep-dive resource per module

CONFIDENCE RULES (based on confidence score above):
- Score < 65 (Low confidence): start every why_important sentence by naming a concrete UPSC skill they already have that transfers (e.g. "Your UPSC essay writing directly applies here because..."); end the why_important with one small, achievable first step; use warm and encouraging tone throughout
- Score ≥ 65 (High confidence): why_important should be direct and outcome-focused; highlight business impact of the skill rather than reassurance

LEARNING FORMAT RULES (based on preferred format above — this sets the video/article SPLIT; total resource count is still set by the burnout rule below):
- Prefers videos: at least two-thirds of each module's resources must be type "youtube"; only include an "article" resource if the module's total count is more than 1
- Prefers reading/articles: at least two-thirds of each module's resources must be type "article"; only include a "youtube" resource if the module's total count is more than 1
- Prefers hands-on practice: split resources evenly between "youtube"/"article", but every resource's search_query and description must point at something build-along (include words like "practice", "exercise", "walkthrough", or "hands-on" where natural), and project_deliverable must be more substantial than the default — a real mini-build, not a reading recap
- Mixed / no strong preference: split resources as evenly as possible between "youtube" and "article"

LEARNING CHALLENGE RULES (based on biggest challenge above):
- Staying motivated/consistent: project_deliverable must be phrased as 2-3 small numbered sub-steps (not one big task) so progress is visible early; why_important should open with the nearest, smallest win, not the long-term outcome
- Understanding concepts deeply: regardless of the burnout/K-score resource tier, prefer resources explicitly aimed at beginners or explainers ("explained", "for beginners", "fundamentals"); project_deliverable must restate the core concept in one plain sentence before stating the task
- Not knowing where to start: order each module's resources from most foundational to most applied — the FIRST resource listed must be the most basic entry point available for that skill
- Applying knowledge practically: project_deliverable must be a specific, realistic mini-deliverable tied to {job_title}'s actual day-to-day responsibilities (not a generic exercise); prefer resources with "tutorial", "walkthrough", or "example" in their framing

Generate a learning roadmap JSON exactly matching this schema:
{{
  "job_title": "<string>",
  "company": "<string>",
  "summary": "<one sentence: what this plan achieves>",
  "explanation": "<one sentence: why THESE specific skills were prioritised — reference the candidate's top 2 gap skills and their KRS profile, e.g. 'This plan focuses on SQL and Stakeholder Management because they are your top 2 missing skills and your S-score of 40 shows room to grow in technical alignment.'>",
  "total_estimated_hours": <int>,
  "modules": [
    {{
      "id": "mod-1",
      "skill": "<skill name>",
      "priority": 1,
      "why_important": "<1 sentence: why this skill matters specifically for THIS job at {company}>",
      "estimated_hours": <int>,
      "project_deliverable": "<short hands-on task that proves mastery — e.g. 'Build a pivot table report from a sample CSV dataset'>",
      "resources": [
        {{
          "id": "mod-1-res-1",
          "type": "youtube",
          "title": "<descriptive video/playlist title>",
          "channel_or_source": "<real YouTube channel name>",
          "search_query": "<SPECIFIC YouTube search query: include the skill name + job context + 'tutorial' or 'explained' — e.g. 'Python pandas data wrangling product analyst tutorial' not just 'Python tutorial'>",
          "url": "<https://www.youtube.com/results?search_query=URL-encoded-query>",
          "duration_minutes": <int — realistic estimate for the type of content>,
          "description": "<one sentence: exactly what the learner will be able to DO after watching>"
        }},
        {{
          "id": "mod-1-res-2",
          "type": "youtube",
          "title": "<title — a different angle or subtopic of the same skill>",
          "channel_or_source": "<channel>",
          "search_query": "<SPECIFIC query covering a different subtopic of this skill for {job_title}>",
          "url": "<youtube search url>",
          "duration_minutes": <int>,
          "description": "<description>"
        }},
        {{
          "id": "mod-1-res-3",
          "type": "article",
          "title": "<title of a real article, guide, or documentation page>",
          "channel_or_source": "<publisher — e.g. GeeksforGeeks, Investopedia, HBR, official docs, Towards Data Science>",
          "search_query": "<search query>",
          "url": "<direct URL to a real article — GeeksforGeeks, Investopedia, official docs, HBR, etc. NOT a Google/YouTube search page>",
          "duration_minutes": <int — reading time estimate>,
          "description": "<one sentence: what concept this reading covers>"
        }}
      ]
    }}
  ]
}}

Rules:
- Create 4-7 modules covering ALL identified skill gaps, ordered by priority (1 = most critical for getting the job)
- If there are more gap skills than modules allow, group closely related skills into a single module (e.g. "SQL & Data Analysis", "Written Communication & Report Writing") — never silently omit a gap skill; every gap must appear in at least one module's skill name or resources
- Each module must include a project_deliverable: a concrete, completable mini-project that proves mastery (not just "read about X")
- Resource COUNT per module is determined by the burnout score above:
    - High burnout (score ≥ 70): exactly 2 resources — keep it light
    - Moderate burnout (40–69): exactly 3 resources — standard load
    - Low burnout (score < 40) AND K-score ≥ 50: exactly 4 resources — go deeper
    - Low burnout (score < 40) AND K-score < 50: exactly 3 resources
  The video/article SPLIT of that count is set by the LEARNING FORMAT RULES above, not by burnout.
- YouTube search_query MUST be specific: always include the skill AND the job/sector context (e.g. "{sector} {job_title} <skill> tutorial" not just "<skill> tutorial")
- YouTube URLs must be https://www.youtube.com/results?search_query=<url-encoded-search-query>
- Article URL must be a DIRECT link to a real page (GeeksforGeeks.org, Investopedia.com, docs.python.org, hbr.org, towardsdatascience.com, etc.) — never a Google/YouTube search page
- estimated_hours per module: 2-12 hours realistic learning time
- why_important must mention the specific role ({job_title}) or company ({company}), not be generic
- Return ONLY the JSON object, nothing else
"""

QUIZ_SYSTEM_PROMPT = """\
You are BeginablAI's career learning planner. You write short, targeted quizzes that
check whether a learner actually understood ONE specific skill module — not
generic trivia. Return ONLY valid JSON — no markdown fences, no commentary."""

QUIZ_PROMPT = """\
Job Title: {job_title}
Sector: {sector}
Module Skill: {skill}
Why this skill matters for the job: {why_important}

This module's learning resources cover:
{resource_summary}

Write 6-8 multiple-choice questions that together cover everything a learner
should take away from THIS module — spread questions across all the resource
topics listed above, not just one narrow angle. Test real understanding (not
just recall), specifically as it applies to {job_title}. Return JSON exactly
matching this schema:
{{
  "questions": [
    {{
      "id": "q1",
      "text": "<question>",
      "options": [
        {{"id": "a", "text": "<option>"}},
        {{"id": "b", "text": "<option>"}},
        {{"id": "c", "text": "<option>"}},
        {{"id": "d", "text": "<option>"}}
      ],
      "correct_option_id": "<a|b|c|d>",
      "explanation": "<one short sentence explaining why the correct answer is right>"
    }}
  ]
}}

Rules:
- 6-8 questions total, covering all the resource topics listed above between them, 4 options each, exactly one correct per question
- Questions must be specific to "{skill}" in the context of {job_title} — not generic
- Keep every string SHORT and concise
- Return ONLY the JSON object, nothing else
"""


REMEDIAL_SYSTEM_PROMPT = """\
You are BeginablAI's career learning planner. A learner just failed a quiz on one
skill module. Generate ONE additional learning resource that targets exactly what
they got wrong, from a different angle than a standard intro resource.
Return ONLY valid JSON — no markdown fences, no commentary."""

REMEDIAL_PROMPT = """\
Job Title: {job_title}
Sector: {sector}
Skill: {skill}
Why this skill matters for the job: {why_important}

The learner just failed this module's quiz. Here's what they got wrong:
{missed_summary}

Generate ONE resource (youtube video or article) that specifically re-teaches the
concepts above from a different angle than a typical first-pass intro — assume
they already tried a beginner resource once and it didn't stick.

Return JSON exactly matching this schema:
{{
  "type": "youtube" | "article",
  "title": "<descriptive title>",
  "channel_or_source": "<real channel or publisher>",
  "search_query": "<specific search query including the skill and job context>",
  "duration_minutes": <int>,
  "description": "<one sentence: what this resource clarifies that the learner missed>"
}}

Rules:
- Must be a REAL channel/publisher, not invented
- search_query must include the skill name and "{job_title}" or "{sector}" context
- description must directly reference what the learner got wrong, not be generic
- Return ONLY the JSON object, nothing else
"""


def _url_encode(q: str) -> str:
    return urllib.parse.quote_plus(q)


# Ordered list of (source-name fragment → search URL template).
# Checked against channel_or_source (lowercase). First match wins.
_SOURCE_SEARCH_URLS: list[tuple[str, str]] = [
    # ── UPSC / IAS prep ──────────────────────────────────────────────────────
    ("insight",         "https://www.insightsonindia.com/?s={q}"),
    ("mrunal",          "https://mrunal.org/?s={q}"),
    ("clearias",        "https://www.clearias.com/?s={q}"),
    ("drishti",         "https://www.drishtiias.com/search?q={q}"),
    ("vision ias",      "https://www.visionias.in/resources/?q={q}"),
    ("forum ias",       "https://forumias.com/?s={q}"),
    ("byju",            "https://byjus.com/free-ias-prep/?s={q}"),
    ("unacademy",       "https://unacademy.com/search?q={q}"),
    ("testbook",        "https://testbook.com/blog/?s={q}"),
    ("gradeup",         "https://gradeup.co/search?q={q}"),
    ("studyiq",         "https://www.studyiq.com/articles?q={q}"),
    # ── Policy / Governance / Legal ───────────────────────────────────────────
    ("prs india",          "https://prsindia.org/prscore/search?q={q}"),
    ("prs legislative",    "https://prsindia.org/prscore/search?q={q}"),
    ("india kanoon",       "https://indiankanoon.org/search/?formInput={q}"),
    # ── Sustainability / CSR / ESG ────────────────────────────────────────────
    ("triplepundit",       "https://www.triplepundit.com/?s={q}"),
    ("greenbiz",           "https://www.greenbiz.com/search?keywords={q}"),
    ("esg today",          "https://www.esgtoday.com/?s={q}"),
    ("csr wire",           "https://www.csrwire.com/search?q={q}"),
    ("responsible investor","https://www.responsible-investor.com/search/?q={q}"),
    # ── News / Newspapers ─────────────────────────────────────────────────────
    ("the hindu",          "https://www.thehindu.com/search/?q={q}"),
    ("indian express",     "https://indianexpress.com/?s={q}"),
    ("livemint",           "https://www.livemint.com/search#gsc.q={q}"),
    ("economic times",     "https://economictimes.indiatimes.com/searchresult.cms?query={q}"),
    ("business standard",  "https://www.business-standard.com/search?q={q}"),
    ("hindustan times",    "https://www.hindustantimes.com/search?q={q}"),
    ("down to earth",      "https://www.downtoearth.org.in/search?q={q}"),
    ("forbes",             "https://www.forbes.com/search/?q={q}"),
    ("bloomberg",          "https://www.bloomberg.com/search?query={q}"),
    ("reuters",            "https://www.reuters.com/search/news?blob={q}"),
    # ── General education ─────────────────────────────────────────────────────
    ("wikipedia",          "https://en.wikipedia.org/wiki/Special:Search?search={q}"),
    ("britannica",         "https://www.britannica.com/search?query={q}"),
    ("khan academy",       "https://www.khanacademy.org/search?page_search_query={q}"),
    ("investopedia",       "https://www.investopedia.com/search?q={q}"),
    ("geeksforgeeks",      "https://www.geeksforgeeks.org/search/?q={q}"),
    ("coursera",           "https://www.coursera.org/search?query={q}"),
    ("udemy",              "https://www.udemy.com/courses/search/?q={q}"),
    ("edx",                "https://www.edx.org/search?q={q}"),
    ("nptel",              "https://nptel.ac.in/search?q={q}"),
    ("stanford",           "https://plato.stanford.edu/search/searcher.py?query={q}"),
    ("hbr",                "https://hbr.org/search?term={q}"),
    ("harvard business",   "https://hbr.org/search?term={q}"),
    ("mckinsey",           "https://www.mckinsey.com/search#q={q}"),
    ("deloitte",           "https://www2.deloitte.com/search.html#q={q}"),
    ("shrm",               "https://www.shrm.org/search#q={q}"),
    ("world bank",         "https://www.worldbank.org/en/search?q={q}"),
    ("imf",                "https://www.imf.org/en/search#q={q}"),
    ("niti aayog",         "https://www.niti.gov.in/search/node/{q}"),
    ("un ",                "https://search.un.org/results.asp?query={q}"),
    ("united nations",     "https://search.un.org/results.asp?query={q}"),
]

def _build_article_url(res: dict) -> str:
    """Return the most targeted fallback URL for a non-YouTube resource.

    This is the static fallback set at plan-generation time. The async enrichment
    pass (enrich_plan_with_real_videos) subsequently tries to replace it with a
    real direct article URL via Wikipedia API or DuckDuckGo site: search.
    Falls back to a plain Google search only for sources not in the known map.
    """
    source = (res.get("channel_or_source") or "").lower().strip()
    raw_query = res.get("search_query") or res.get("title") or source
    q = _url_encode(raw_query)

    for keyword, template in _SOURCE_SEARCH_URLS:
        if keyword in source:
            return template.format(q=q)

    return f"https://www.google.com/search?q={q}"


def _fix_youtube_urls(plan: dict) -> dict:
    """Normalise all resource URLs before persisting the plan.

    YouTube → always build a deterministic YouTube search URL from search_query.
    Article / Course → route to the source platform's own search page using
                       channel_or_source so the user lands on the actual site.
    """
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") == "youtube" and res.get("search_query"):
                res["url"] = f"https://www.youtube.com/results?search_query={_url_encode(res['search_query'])}"
            elif res.get("type") in ("article", "course"):
                res["url"] = _build_article_url(res)
    return plan


def _repair_truncated_json(raw: str) -> dict | None:
    """Best-effort recovery when the LLM response got cut off mid-JSON (e.g. hit
    max_tokens). Walks the string tracking open brackets, trims any trailing
    incomplete value, and closes whatever's still open. Returns None if it still
    doesn't parse — the caller should fall back to raising the original error."""
    depth_stack: list[str] = []
    in_string = False
    escape = False
    for ch in raw:
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in "{[":
            depth_stack.append(ch)
        elif ch in "}]":
            if depth_stack:
                depth_stack.pop()

    if not depth_stack:
        return None  # brackets already balanced — real error is something else

    repaired = raw.rstrip()
    # Drop a dangling open string, key, or trailing comma left by the cut-off.
    repaired = re.sub(r',\s*"[^"]*"?\s*:?\s*"?[^"{\[]*$', '', repaired) if in_string else repaired
    repaired = re.sub(r',\s*$', '', repaired)

    closers = {"{": "}", "[": "]"}
    for opener in reversed(depth_stack):
        repaired += closers[opener]

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def _extract_json(raw: str) -> dict:
    """Extract JSON from AI response even if there's surrounding text."""
    raw = raw.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    # Find outermost {...}
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in AI response")

    candidate = raw[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # The response may have been truncated by max_tokens before the closing
        # brace `rfind` found was actually the real end — try the whole tail.
        repaired = _repair_truncated_json(raw[start:])
        if repaired is not None:
            logger.warning("Repaired truncated JSON from AI plan response.")
            return repaired
        raise


def _score_label(score: int | None) -> str:
    if score is None:
        return "not assessed"
    if score >= 75:
        return "Strong"
    if score >= 50:
        return "Moderate"
    if score >= 30:
        return "Developing"
    return "Early stage"


async def generate_job_plan(
    job_title: str,
    company: str,
    sector: str,
    description: str,
    required_skills: list[str],
    user_skills: list[str],
    gap_skills: list[str],
    *,
    job_id: str | None = None,
    k_score: int | None = None,
    r_score: int | None = None,
    s_score: int | None = None,
    burnout_score: int | None = None,
    confidence_score: int | None = None,
    work_experience_years: int | None = None,
    work_experience_domain: str | None = None,
    upsc_exam: str | None = None,
    highest_stage_cleared: str | None = None,
    years_preparing: int | None = None,
    optional_subject: str | None = None,
    preferred_sectors: list[str] | None = None,
    preferred_learning_format: str | None = None,
    learning_challenge: str | None = None,
    interaction_history: str | None = None,
) -> dict[str, Any]:
    """Call Groq and return the structured learning plan dict.

    When job_id is provided, the raw LLM output (before video enrichment)
    is cached in Redis for 7 days to avoid redundant generation for the
    same job + gap-skill combination. Caching is skipped when interaction_history
    is set (a regeneration informed by this user's own progress) since that
    context is user-specific and shouldn't be reused across users or served
    stale to the same user on a later regeneration.
    """
    # ── Cache lookup ──────────────────────────────────────────────────────────
    cache_key = (
        _plan_cache_key(job_id, gap_skills, k_score, burnout_score, confidence_score, preferred_learning_format, learning_challenge)
        if job_id and not interaction_history else None
    )
    if cache_key:
        try:
            cached = _redis().get(cache_key)
            if cached:
                logger.info("[PLAN_CACHE] Hit for %s", cache_key)
                return json.loads(cached)
        except Exception as exc:
            logger.warning("[PLAN_CACHE] Redis read failed: %s", exc)

    work_exp_str = (
        f"{work_experience_years} year(s) in {work_experience_domain or 'an unspecified field'}"
        if work_experience_years
        else "No prior work experience"
    )

    _UPSC_EXAM_LABELS = {
        "cse": "UPSC CSE (Civil Services)", "capf": "CAPF", "cds": "CDS",
        "ies": "IES (Engineering Services)", "cms": "CMS (Medical Services)",
        "state_pcs": "State PCS", "other": "Other competitive exam",
    }
    _STAGE_LABELS = {
        "none": "No attempt yet", "prelims": "Cleared Prelims",
        "mains": "Cleared Mains", "interview": "Appeared in Interview",
    }
    _FORMAT_LABELS = {
        "video": "Prefers video content",
        "reading": "Prefers reading/articles",
        "hands_on": "Prefers hands-on practice/building",
        "mixed": "No strong preference — mix of formats",
    }
    _CHALLENGE_LABELS = {
        "motivation": "Staying motivated/consistent",
        "understanding_concepts": "Understanding concepts deeply",
        "getting_started": "Not knowing where to start",
        "applying_practically": "Applying knowledge practically",
    }

    interaction_history_block = ""
    if interaction_history:
        interaction_history_block = (
            "\nWHAT'S ALREADY BEEN TRIED (this is a regeneration — use this to avoid "
            "repeating what's already covered):\n"
            f"{interaction_history}\n\n"
            "CONCRETE RULES for regeneration:\n"
            "- Skills marked \"mastered\" above must NOT get a new module — they're done.\n"
            "- Skills marked \"failed quiz\" must be reprioritized near the top (priority "
            "1-2) and use a different resource angle (different channels/sources or "
            "resource types) than what's listed as already tried.\n"
        )

    prompt = PLAN_PROMPT.format(
        job_title=job_title,
        company=company,
        sector=sector,
        description=(description or "")[:4000],
        required_skills=", ".join(required_skills) if required_skills else "Not specified",
        user_skills=", ".join(user_skills) if user_skills else "None listed",
        gap_skills=", ".join(gap_skills) if gap_skills else "No gaps identified",
        interaction_history_block=interaction_history_block,
        k_score=k_score if k_score is not None else "N/A",
        k_score_label=_score_label(k_score),
        r_score=r_score if r_score is not None else "N/A",
        r_score_label=_score_label(r_score),
        s_score=s_score if s_score is not None else "N/A",
        s_score_label=_score_label(s_score),
        burnout_score=burnout_score if burnout_score is not None else "N/A",
        burnout_label=("High — exhausted" if (burnout_score or 0) >= 70 else "Moderate" if (burnout_score or 0) >= 40 else "Low — fresh"),
        confidence_score=confidence_score if confidence_score is not None else "N/A",
        confidence_label=("High confidence" if (confidence_score or 0) >= 65 else "Low confidence — needs encouragement"),
        work_experience=work_exp_str,
        upsc_exam_label=_UPSC_EXAM_LABELS.get(upsc_exam or "", upsc_exam or "Not specified"),
        upsc_stage_label=_STAGE_LABELS.get(highest_stage_cleared or "", highest_stage_cleared or "Not specified"),
        years_preparing_label=f"{years_preparing} year(s)" if years_preparing else "Not specified",
        optional_subject_label=optional_subject or "Not specified",
        preferred_sectors_label=", ".join(preferred_sectors) if preferred_sectors else "Not specified",
        learning_format_label=_FORMAT_LABELS.get(preferred_learning_format or "", "No strong preference — mix of formats"),
        learning_challenge_label=_CHALLENGE_LABELS.get(learning_challenge or "", "Not specified"),
    )

    msg = await _groq.complete(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8000,
        temperature=0.4,  # low temp for structured output
    )

    plan = _extract_json(msg.content)
    plan = _fix_youtube_urls(plan)

    # Validate minimal structure
    if "modules" not in plan or not isinstance(plan["modules"], list):
        raise ValueError("AI response missing 'modules' list")

    # ── Cache write ───────────────────────────────────────────────────────────
    if cache_key:
        try:
            _redis().setex(cache_key, _PLAN_CACHE_TTL, json.dumps(plan))
            logger.info("[PLAN_CACHE] Stored for %s", cache_key)
        except Exception as exc:
            logger.warning("[PLAN_CACHE] Redis write failed: %s", exc)

    return plan


async def generate_module_quiz(
    job_title: str,
    sector: str,
    skill: str,
    why_important: str,
    resources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Generate a quiz for ONE module, on demand — scoped to just that module's
    skill and resources rather than the whole plan, so it's both cheaper (small
    prompt, no risk of blowing the main plan's token budget) and tightly on-topic,
    while still covering everything that module actually taught."""
    resource_lines = [
        f"- {r.get('title', '')}: {r.get('description', '')}"
        for r in (resources or [])
        if r.get("title")
    ]
    resource_summary = "\n".join(resource_lines) if resource_lines else f"- General overview of {skill}"

    prompt = QUIZ_PROMPT.format(
        job_title=job_title,
        sector=sector,
        skill=skill,
        why_important=why_important,
        resource_summary=resource_summary,
    )

    msg = await _groq.complete(
        system=QUIZ_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.4,
    )

    quiz = _extract_json(msg.content)
    if "questions" not in quiz or not isinstance(quiz["questions"], list):
        raise ValueError("AI response missing 'questions' list")
    return quiz


def count_youtube_resources(plan: dict[str, Any]) -> int:
    """Total number of youtube-type resources across all modules."""
    return sum(
        1
        for module in plan.get("modules", [])
        for res in module.get("resources", [])
        if res.get("type") == "youtube"
    )


def count_article_resources(plan: dict[str, Any]) -> int:
    """Total number of article/course resources across all modules."""
    return sum(
        1
        for module in plan.get("modules", [])
        for res in module.get("resources", [])
        if res.get("type") in ("article", "course")
    )


def is_plan_stale(plan: dict[str, Any] | None) -> bool:
    """True if this plan predates real-video enrichment (old hallucinated-link format).

    Note: missing quizzes (old plans generated before that feature) deliberately do
    NOT count as stale — auto-regenerating every old plan the moment it's viewed caused
    a burst of simultaneous Groq calls and tripped the API rate limit. Users can backfill
    a quiz via the existing manual "regenerate" button instead.
    """
    if not plan:
        return False
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") == "youtube" and not res.get("video_options"):
                return True
    return False


def redact_quiz_answers(plan: dict[str, Any] | None) -> dict[str, Any] | None:
    """Strip correct_option_id/explanation before sending a plan to the frontend
    for quiz-taking — answers are only revealed in the grading response."""
    if not plan:
        return plan
    redacted = json.loads(json.dumps(plan))
    for module in redacted.get("modules", []):
        for q in module.get("quiz", {}).get("questions", []):
            q.pop("correct_option_id", None)
            q.pop("explanation", None)
    return redacted


class _EnrichmentCircuitBreaker:
    """Tracks consecutive resolution failures per resource type within one
    enrichment pass. yt-dlp and the DDG-backed article search are unofficial,
    scrape-based tools — when one breaks (network block, markup change), it
    breaks for every remaining call in the pass, not just one. Without this,
    a plan with 7 modules would retry the same doomed call up to ~28 times,
    inflating generation latency during exactly the outage where the user is
    already getting a degraded result. After a few consecutive failures for
    a type, stop attempting live resolution for the rest of this pass and
    keep the LLM-set fallback URL instead."""

    THRESHOLD = 3

    def __init__(self) -> None:
        self._consecutive_failures: dict[str, int] = {}
        self._tripped: set[str] = set()

    def is_open(self, res_type: str) -> bool:
        return res_type in self._tripped

    def record(self, res_type: str, success: bool) -> None:
        if success:
            self._consecutive_failures[res_type] = 0
            return
        count = self._consecutive_failures.get(res_type, 0) + 1
        self._consecutive_failures[res_type] = count
        if count >= self.THRESHOLD and res_type not in self._tripped:
            self._tripped.add(res_type)
            logger.warning(
                "[PLAN_ENRICH] %d consecutive %s resolution failures — "
                "skipping live resolution for the rest of this pass",
                count, res_type,
            )


async def _enrich_resource(
    res: dict[str, Any], breaker: "_EnrichmentCircuitBreaker | None" = None
) -> tuple[bool, str | None]:
    """Resolve one resource's real URL in place. Returns (resolved, found_title).

    YouTube → searches for real video candidates (up to 2), attaches
              video_options + recommended_video_id, keeps fallback search URL.
    Article/Course → resolves the actual article URL via Wikipedia REST API or
              DuckDuckGo site: search so "View Resource" lands on the real page.
              Falls back to the site-specific search URL already set by
              _build_article_url if live resolution fails.

    `breaker` is optional — omitted for the single-resource remedial-resource
    path, where there's no batch of calls to protect and a fresh breaker would
    never trip on just one attempt anyway.
    """
    res_type = res.get("type", "")
    query = res.get("search_query") or res.get("title") or ""
    if not query:
        return False, None

    breaker = breaker or _EnrichmentCircuitBreaker()
    breaker_key = "youtube" if res_type == "youtube" else "article"
    if breaker.is_open(breaker_key):
        return False, None

    if res_type == "youtube":
        candidates = await search_youtube(query, n=2)
        if candidates:
            res["video_options"] = candidates
            res["recommended_video_id"] = candidates[0]["video_id"]
            res["url"] = candidates[0]["url"]
            if not res.get("duration_minutes"):
                res["duration_minutes"] = candidates[0]["duration_minutes"]
            breaker.record(breaker_key, success=True)
            return True, candidates[0]["title"]
        breaker.record(breaker_key, success=False)
        return False, None

    elif res_type in ("article", "course"):
        source = res.get("channel_or_source") or ""
        real_url = await resolve_article_url(query, source)
        if real_url:
            res["url"] = real_url
            breaker.record(breaker_key, success=True)
            return True, res.get("title")
        breaker.record(breaker_key, success=False)
        # If resolution fails, _build_article_url already set a
        # site-specific search URL — keep it as the fallback.
        return False, None

    return False, None


async def enrich_plan_with_real_videos(
    plan: dict[str, Any],
    on_progress: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> dict[str, Any]:
    """Enrich all resources with real URLs resolved at generation time.

    If `on_progress` is given, it's awaited after every resource with a live
    snapshot: {"resources_done": int, "resources_total": int, "current_skill": str,
    "last_found": str | None}.
    """
    total = count_youtube_resources(plan) + count_article_resources(plan)
    done = 0
    resolved = 0
    breaker = _EnrichmentCircuitBreaker()
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") not in ("youtube", "article", "course"):
                continue  # skip unknown types; don't count in progress

            was_resolved, found_title = await _enrich_resource(res, breaker)
            if was_resolved:
                resolved += 1

            done += 1
            if on_progress:
                await on_progress({
                    "resources_done": done,
                    "resources_total": total,
                    "current_skill": module.get("skill"),
                    "last_found": found_title,
                })

    failed = total - resolved
    logger.info("[PLAN_ENRICH] resolved=%d/%d failed=%d", resolved, total, failed)
    if total > 0 and failed / total > 0.5:
        sentry_sdk.capture_message(
            f"[PLAN_ENRICH] high resolution failure rate: {failed}/{total} resources "
            "failed to resolve a real URL — yt-dlp/DDG scraping may be broken",
            level="warning",
        )
    return plan


async def generate_remedial_resource(
    job_title: str,
    sector: str,
    skill: str,
    why_important: str,
    missed_explanations: list[str],
    resource_id: str,
) -> dict[str, Any]:
    """Generate one follow-up resource after a failed module quiz — targeting
    what the learner actually got wrong, from a different angle than the
    module's existing resources, rather than letting them silently move on."""
    missed_summary = (
        "\n".join(f"- {m}" for m in missed_explanations)
        if missed_explanations
        else "General understanding of the topic."
    )
    prompt = REMEDIAL_PROMPT.format(
        job_title=job_title,
        sector=sector,
        skill=skill,
        why_important=why_important,
        missed_summary=missed_summary,
    )

    msg = await _groq.complete(
        system=REMEDIAL_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000,
        temperature=0.4,
    )

    resource = _extract_json(msg.content)
    resource["id"] = resource_id
    if resource.get("type") == "youtube" and resource.get("search_query"):
        resource["url"] = f"https://www.youtube.com/results?search_query={_url_encode(resource['search_query'])}"
    elif resource.get("type") in ("article", "course"):
        resource["url"] = _build_article_url(resource)

    await _enrich_resource(resource)
    return resource
