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
    return json.loads(raw[start:end + 1])


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
        max_tokens=4000,
        temperature=0.4,  # low temp for structured output
    )

    plan = _extract_json(msg.content)
    plan = _fix_youtube_urls(plan)

    # Validate minimal structure
    if "modules" not in plan or not isinstance(plan["modules"], list):
        raise ValueError("AI response missing 'modules' list")

    return plan


def count_youtube_resources(plan: dict[str, Any]) -> int:
    """Total number of youtube-type resources across all modules."""
    return sum(
        1
        for module in plan.get("modules", [])
        for res in module.get("resources", [])
        if res.get("type") == "youtube"
    )


def is_plan_stale(plan: dict[str, Any] | None) -> bool:
    """True if this plan predates real-video enrichment (old hallucinated-link format)."""
    if not plan:
        return False
    for module in plan.get("modules", []):
        for res in module.get("resources", []):
            if res.get("type") == "youtube" and not res.get("video_options"):
                return True
    return False


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
