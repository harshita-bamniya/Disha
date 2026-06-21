"""AI service that generates a job-specific learning roadmap.

Given a job posting and a user's current skills, asks Groq to produce
a structured, prioritised list of skill modules each with concrete
YouTube / article resources and time estimates.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.parse
from typing import Any, Awaitable, Callable

from app.ai.providers.groq import GroqProvider
from app.ai.youtube_search import search_youtube

logger = logging.getLogger(__name__)

_groq = GroqProvider()

SYSTEM_PROMPT = """\
You are DISHA's career learning planner. You create hyper-specific, actionable
learning roadmaps for UPSC aspirants transitioning to private-sector careers.

Given a target job and the user's skill gaps, produce a JSON learning plan.
Be concrete: name real YouTube channels and real search queries people actually use.
Prioritise breadth-first (most impactful skills first) then depth.

Return ONLY valid JSON — no markdown fences, no commentary."""

PLAN_PROMPT = """\
Job Title: {job_title}
Company: {company}
Sector: {sector}
Job Description (excerpt): {description}
Skills Required by Employer: {required_skills}

User's Current Skills: {user_skills}
Identified Skill Gaps: {gap_skills}

Generate a learning roadmap JSON exactly matching this schema:
{{
  "job_title": "<string>",
  "company": "<string>",
  "summary": "<one sentence: what this plan achieves>",
  "total_estimated_hours": <int>,
  "modules": [
    {{
      "id": "mod-1",
      "skill": "<skill name>",
      "priority": 1,
      "why_important": "<1 sentence: why this skill matters specifically for this job>",
      "estimated_hours": <int>,
      "resources": [
        {{
          "id": "mod-1-res-1",
          "type": "youtube",
          "title": "<descriptive video/playlist title>",
          "channel_or_source": "<channel name>",
          "search_query": "<exact YouTube search query to find this>",
          "url": "<https://www.youtube.com/results?search_query=URL-encoded-query>",
          "duration_minutes": <int>,
          "description": "<one sentence: what the learner will gain>"
        }},
        {{
          "id": "mod-1-res-2",
          "type": "youtube",
          "title": "<title>",
          "channel_or_source": "<channel>",
          "search_query": "<query>",
          "url": "<youtube search url>",
          "duration_minutes": <int>,
          "description": "<description>"
        }},
        {{
          "id": "mod-1-res-3",
          "type": "article",
          "title": "<article/book title>",
          "channel_or_source": "<publisher/author>",
          "search_query": "<google search query>",
          "url": "<https://www.google.com/search?q=URL-encoded-query>",
          "duration_minutes": <int>,
          "description": "<description>"
        }}
      ]
    }}
  ]
}}

Rules:
- Create 4-7 modules covering ALL skill gaps, ordered by priority (1 = most critical for getting the job)
- Each module has exactly 3 resources (2 YouTube + 1 article/read minimum)
- YouTube URLs must be https://www.youtube.com/results?search_query=<url-encoded-search-query>
- Article URLs should be Google search links: https://www.google.com/search?q=<url-encoded-query>
- estimated_hours per module: 2-12 hours realistic learning time
- Be specific to the sector ({sector}) and role ({job_title}) — not generic
- Return ONLY the JSON object, nothing else
"""

QUIZ_SYSTEM_PROMPT = """\
You are DISHA's career learning planner. You write short, targeted quizzes that
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


def _url_encode(q: str) -> str:
    return urllib.parse.quote_plus(q)


def _fix_youtube_urls(plan: dict) -> dict:
    """Ensure all YouTube resource URLs are properly formed search URLs."""
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") == "youtube" and res.get("search_query"):
                res["url"] = f"https://www.youtube.com/results?search_query={_url_encode(res['search_query'])}"
            elif res.get("type") == "article" and res.get("search_query"):
                if not res.get("url", "").startswith("http"):
                    res["url"] = f"https://www.google.com/search?q={_url_encode(res['search_query'])}"
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


async def generate_job_plan(
    job_title: str,
    company: str,
    sector: str,
    description: str,
    required_skills: list[str],
    user_skills: list[str],
    gap_skills: list[str],
) -> dict[str, Any]:
    """Call Groq and return the structured learning plan dict."""

    prompt = PLAN_PROMPT.format(
        job_title=job_title,
        company=company,
        sector=sector,
        description=(description or "")[:800],
        required_skills=", ".join(required_skills) if required_skills else "Not specified",
        user_skills=", ".join(user_skills) if user_skills else "None listed",
        gap_skills=", ".join(gap_skills) if gap_skills else "No gaps identified",
    )

    msg = await _groq.complete(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=6500,
        temperature=0.4,  # low temp for structured output
    )

    plan = _extract_json(msg.content)
    plan = _fix_youtube_urls(plan)

    # Validate minimal structure
    if "modules" not in plan or not isinstance(plan["modules"], list):
        raise ValueError("AI response missing 'modules' list")

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


async def enrich_plan_with_real_videos(
    plan: dict[str, Any],
    on_progress: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> dict[str, Any]:
    """For every youtube resource, search real videos and attach up to 2 candidates.

    Adds `video_options` (list of real {video_id, title, channel, duration_minutes,
    thumbnail_url, url}) and `recommended_video_id` (first/best match) to each
    youtube-type resource. Falls back gracefully — if search finds nothing, the
    resource keeps its original LLM-suggested search-link `url`.

    If `on_progress` is given, it's awaited after every resource with a live
    snapshot: {"resources_done": int, "resources_total": int, "current_skill": str,
    "last_found": str | None} — so callers can report real progress, not a fake step.
    """
    total = count_youtube_resources(plan)
    done = 0
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") != "youtube":
                continue
            query = res.get("search_query") or res.get("title") or ""
            found_title: str | None = None
            if query:
                candidates = await search_youtube(query, n=2)
                if candidates:
                    res["video_options"] = candidates
                    res["recommended_video_id"] = candidates[0]["video_id"]
                    # Point the primary url at the recommended real video.
                    res["url"] = candidates[0]["url"]
                    if not res.get("duration_minutes"):
                        res["duration_minutes"] = candidates[0]["duration_minutes"]
                    found_title = candidates[0]["title"]
            done += 1
            if on_progress:
                await on_progress({
                    "resources_done": done,
                    "resources_total": total,
                    "current_skill": module.get("skill"),
                    "last_found": found_title,
                })
    return plan
