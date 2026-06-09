"""AI feedback generation for interview responses."""
from __future__ import annotations

import json
import logging
import re

from app.core.exceptions import BadRequestException

logger = logging.getLogger(__name__)

_MIN_RESPONSE_CHARS = 30
_MAX_RESPONSE_CHARS = 5000


def validate_response_text(text: str) -> None:
    """Raise BadRequestException if the response is too short/long for meaningful AI feedback."""
    stripped = text.strip()
    if len(stripped) < _MIN_RESPONSE_CHARS:
        raise BadRequestException(
            f"Response is too short for meaningful feedback. "
            f"Please write at least {_MIN_RESPONSE_CHARS} characters."
        )
    if len(stripped) > _MAX_RESPONSE_CHARS:
        raise BadRequestException(
            f"Response exceeds the maximum length of {_MAX_RESPONSE_CHARS} characters."
        )

_SYSTEM_PROMPT = """You are an expert interview coach specialising in helping UPSC civil services
aspirants transition to private sector roles.

Evaluate the interview response and provide structured coaching feedback.

The candidate has a UPSC background — they tend to be formal, verbose, and policy-oriented.
Coach them toward: concise, impact-focused, result-oriented corporate communication.
Specifically encourage STAR method (Situation, Task, Action, Result).

Output ONLY valid JSON matching this exact schema:
{
  "clarity_score": <0-10>,
  "conciseness_score": <0-10>,
  "impact_score": <0-10>,
  "relevance_score": <0-10>,
  "star_adherence": <0-10>,
  "overall_score": <0-10>,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "rewritten_answer": "A better version of the answer using STAR method and corporate language"
}"""

_USER_PROMPT_TEMPLATE = """INTERVIEW QUESTION:
{question}

CANDIDATE'S ANSWER:
{response}

Career Track Context: {career_track}
Session Type: {session_type}

Evaluate the answer and provide detailed coaching feedback."""


def build_feedback_prompt(
    question: str,
    response: str,
    career_track: str,
    session_type: str,
) -> tuple[str, str]:
    user_msg = _USER_PROMPT_TEMPLATE.format(
        question=question,
        response=response,
        career_track=career_track or "General private sector",
        session_type=session_type,
    )
    return _SYSTEM_PROMPT, user_msg


def parse_feedback_response(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if match:
            data = json.loads(match.group(0))
        else:
            raise ValueError("AI feedback response did not contain valid JSON")

    # Clamp scores to 0-10
    score_keys = ["clarity_score", "conciseness_score", "impact_score", "relevance_score", "star_adherence", "overall_score"]
    for key in score_keys:
        if key in data and data[key] is not None:
            data[key] = max(0, min(10, int(data[key])))

    return data
