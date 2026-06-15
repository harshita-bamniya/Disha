"""AI Narrative Coach — Stage 1 of the Roadmap system.

Evaluates a user's professional narrative and rewrites UPSC-bureaucratic language
into private-sector commercial vocabulary.

Returns a structured evaluation with:
  - overall score (0-100)
  - commercial_language_pct: how much of the narrative already uses commercial framing
  - upsc_jargon_found: list of bureaucratic phrases detected
  - specific_improvements: actionable, line-level rewrites
  - rewritten_version: full improved narrative
"""
from __future__ import annotations

import json
import logging
import re

from app.ai.providers.groq import GroqProvider

logger = logging.getLogger(__name__)

_SYSTEM = """You are an expert career transition coach who specialises in helping Indian Civil Services (UPSC) aspirants reframe their experiences for private-sector roles.

You deeply understand:
- UPSC vocabulary: district administration, IAS/IPS/IFS, policy drafting, prelims/mains, competitive examination, Section Officer, Under Secretary, notings, files, representations, public grievances, scheme implementation, DPDP, SDG, district magistrate, tehsildar, etc.
- Private-sector vocabulary: stakeholder management, P&L, OKRs, go-to-market, ROI, product roadmap, sprint, customer acquisition, churn, NPS, revenue, margin, data-driven decisions, agile, cross-functional teams, etc.

Your job is to evaluate a user's narrative and provide a structured JSON response.

SCORING:
- 90-100: Excellent. Primarily commercial language. Quantified outcomes. No UPSC jargon.
- 70-89:  Good. Mostly commercial but some bureaucratic phrases remain.
- 50-69:  Moderate. Mix. Needs reframing of specific sections.
- 30-49:  Weak. Dominated by UPSC framing. Major rewrite needed.
- 0-29:   Very weak. Almost entirely bureaucratic or vague.

RESPOND ONLY WITH VALID JSON. No markdown, no prose outside the JSON object."""

_USER_TEMPLATE = """Evaluate this professional narrative from a UPSC aspirant transitioning to private sector:

---
{narrative}
---

User background:
- UPSC attempts: {attempts}
- Work experience: {work_exp} years
- Target career track: {career_track}

Return a JSON object with exactly these keys:
{{
  "overall_score": <integer 0-100>,
  "commercial_language_pct": <integer 0-100, % of text already using commercial framing>,
  "upsc_jargon_found": [<list of specific bureaucratic phrases found, max 8>],
  "strengths": [<2-3 things done well in the narrative>],
  "specific_improvements": [
    {{
      "original": "<exact phrase or sentence from the narrative>",
      "issue": "<why this is weak for private sector>",
      "rewrite": "<improved version using commercial language>"
    }}
  ],
  "rewritten_version": "<full improved narrative, 2-4 paragraphs, written in first person, using commercial vocabulary, with quantified outcomes where possible>",
  "coaching_note": "<one sentence of encouragement + one actionable next step>"
}}"""


async def evaluate_narrative(
    narrative_text: str,
    upsc_attempts: int,
    work_exp_years: int,
    career_track: str,
) -> dict:
    """Evaluate a user's narrative and return structured AI feedback.

    Returns dict matching the JSON schema above.
    Falls back to a safe default dict on any AI error so the route never crashes.
    """
    if len(narrative_text.strip()) < 100:
        return _too_short_response()

    prompt = _USER_TEMPLATE.format(
        narrative=narrative_text[:3000],
        attempts=upsc_attempts,
        work_exp=work_exp_years,
        career_track=career_track,
    )

    provider = GroqProvider()
    try:
        msg = await provider.complete(
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.4,
        )
        raw = msg.content.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        # Clamp score to valid range
        result["overall_score"] = max(0, min(100, int(result.get("overall_score", 0))))
        return result
    except json.JSONDecodeError as exc:
        logger.warning("[NARRATIVE_COACH] JSON parse failed: %s", exc)
        return _error_response("AI returned malformed JSON. Please try again.")
    except Exception as exc:
        logger.error("[NARRATIVE_COACH] AI call failed: %s", exc)
        return _error_response(str(exc))


def _too_short_response() -> dict:
    return {
        "overall_score": 0,
        "commercial_language_pct": 0,
        "upsc_jargon_found": [],
        "strengths": [],
        "specific_improvements": [],
        "rewritten_version": "",
        "coaching_note": "Your narrative is too short (minimum 100 characters). Please write at least 2 paragraphs describing your background and career goals.",
        "error": "too_short",
    }


def _error_response(detail: str) -> dict:
    return {
        "overall_score": 0,
        "commercial_language_pct": 0,
        "upsc_jargon_found": [],
        "strengths": [],
        "specific_improvements": [],
        "rewritten_version": "",
        "coaching_note": "AI evaluation temporarily unavailable. Your narrative has been saved.",
        "error": detail,
    }
