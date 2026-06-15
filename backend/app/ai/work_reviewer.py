"""AI Work Reviewer — Stage 4 ticket submission evaluator.

Evaluates a user's work ticket submission against the ticket's rubric.
Gives specific, line-level feedback — not generic scoring.

Returns:
  - overall_score (0-100)
  - strengths: list of 2-3 things done well
  - improvements: list of 2-3 specific things to fix
  - specific_edits: [{location, issue, suggestion}] — actionable fixes
  - grade_label: "Excellent" | "Good" | "Needs Work" | "Incomplete"
"""
from __future__ import annotations

import json
import logging
import re

from app.ai.providers.groq import GroqProvider

logger = logging.getLogger(__name__)

_SYSTEM = """You are a senior private-sector manager reviewing work submitted by a candidate transitioning from civil services to corporate roles.

You evaluate submissions the way a real hiring manager would — looking for:
1. Commercial framing (outcomes, metrics, ROI) not bureaucratic framing (procedures, compliance)
2. Structured thinking (clear problem → analysis → recommendation)
3. Specificity (concrete numbers, not vague statements)
4. Actionability (recommendations that can be implemented)
5. Appropriate brevity (no padding, no unnecessary jargon)

SCORING:
90-100: Exceptional. Would impress a Fortune 500 hiring manager.
75-89:  Strong. Minor improvements needed.
60-74:  Adequate. Clear gaps but solid foundation.
40-59:  Needs significant work. Core thinking is there but execution is weak.
0-39:   Incomplete or fundamentally off-track.

RESPOND ONLY WITH VALID JSON. No markdown, no prose outside the JSON object."""

_USER_TEMPLATE = """Evaluate this work ticket submission:

TICKET TITLE: {title}
TICKET CONTEXT: {context}
DELIVERABLE REQUIRED: {deliverable}
CAREER TRACK: {career_track}
DIFFICULTY: {difficulty}

RUBRIC CRITERIA:
{rubric}

USER SUBMISSION:
---
{submission}
---

Return a JSON object with exactly these keys:
{{
  "overall_score": <integer 0-100>,
  "grade_label": "<one of: Exceptional|Strong|Adequate|Needs Work|Incomplete>",
  "strengths": [<2-3 specific things done well — quote from the submission>],
  "improvements": [<2-3 specific things to fix — be precise, not generic>],
  "specific_edits": [
    {{
      "location": "<quote or describe where in the submission>",
      "issue": "<what is wrong and why it would concern a hiring manager>",
      "suggestion": "<exact rewrite or specific fix>"
    }}
  ],
  "rubric_scores": {{<criterion: score 0-100 for each rubric criterion>}},
  "hiring_manager_verdict": "<one sentence — would you shortlist this candidate based on this submission? Be honest.>"
}}"""


async def review_ticket_submission(
    submission_text: str,
    ticket_title: str,
    ticket_context: str,
    ticket_deliverable: str,
    rubric: dict,
    career_track: str,
    difficulty: str,
) -> dict:
    """Evaluate a ticket submission. Returns structured AI review dict.

    Never raises — falls back to error dict so the endpoint stays up.
    """
    if len(submission_text.strip()) < 50:
        return _too_short_response()

    rubric_text = "\n".join(
        f"- {criterion}: {details.get('description', '')} (weight: {details.get('weight', 1)})"
        for criterion, details in (rubric or {}).items()
    ) or "- Quality of analysis\n- Clarity of recommendations\n- Use of data/evidence"

    prompt = _USER_TEMPLATE.format(
        title=ticket_title,
        context=ticket_context[:1000],
        deliverable=ticket_deliverable[:500],
        career_track=career_track,
        difficulty=difficulty,
        rubric=rubric_text,
        submission=submission_text[:4000],
    )

    provider = GroqProvider()
    try:
        msg = await provider.complete(
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.3,
        )
        raw = msg.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        result["overall_score"] = max(0, min(100, int(result.get("overall_score", 0))))
        return result
    except json.JSONDecodeError as exc:
        logger.warning("[WORK_REVIEWER] JSON parse failed: %s", exc)
        return _error_response("AI returned malformed JSON.")
    except Exception as exc:
        logger.error("[WORK_REVIEWER] AI call failed: %s", exc)
        return _error_response(str(exc))


def _too_short_response() -> dict:
    return {
        "overall_score": 0,
        "grade_label": "Incomplete",
        "strengths": [],
        "improvements": ["Submission is too short. A minimum of 50 characters is required."],
        "specific_edits": [],
        "rubric_scores": {},
        "hiring_manager_verdict": "Would not shortlist — submission is incomplete.",
        "error": "too_short",
    }


def _error_response(detail: str) -> dict:
    return {
        "overall_score": 0,
        "grade_label": "Incomplete",
        "strengths": [],
        "improvements": [],
        "specific_edits": [],
        "rubric_scores": {},
        "hiring_manager_verdict": "Review temporarily unavailable.",
        "error": detail,
    }
