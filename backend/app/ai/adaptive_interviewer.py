"""Adaptive Interviewer AI — decides next action after each candidate response.

After each response the AI evaluates:
  - Should we probe deeper (follow-up)?
  - Should we challenge the answer?
  - Should we move on to the next question?

Returns structured decision so the interview service can route accordingly.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert interview evaluator and adaptive interview conductor.

Your job: after each candidate response in a mock interview, decide the optimal next action.

You will receive:
- The question that was asked
- The candidate's response
- The interview type (hr/technical/stress)
- How many questions remain
- The question topic/skill being assessed

Evaluate the response and return a JSON decision with this exact structure:
{
  "action": "follow_up" | "challenge" | "next_question",
  "follow_up_question": "string (only if action is follow_up or challenge, otherwise null)",
  "score_signals": {
    "depth": 1-10,
    "clarity": 1-10,
    "specificity": 1-10,
    "impact": 1-10
  },
  "provisional_score": 1-10,
  "coaching_note": "one sentence on the key gap in this response",
  "skip_reason": "null or string explaining why we skip if action is next_question"
}

DECISION RULES:
- "follow_up": Response was vague, generic, or missed the core of the question. Probe with a specific follow-up that forces a concrete example or number.
- "challenge": Response was decent but has a claim that can be stress-tested. Challenge a specific statement.
- "next_question": Response was satisfactory (score ≥ 7) OR we've already probed once on this question OR only 1-2 questions remain and time matters.

CRITICAL: If follow_up_question is set, make it sound natural and conversational — like a real interviewer, not a checklist.

UPSC context: Many candidates will use bureaucratic language (notings, district administration, IAS, etc.).
For "hr" interviews, gently reflect that commercial framing is better.
For "technical" interviews, probe whether they can translate public-sector skills to private-sector outputs.

Return ONLY the JSON. No explanation outside JSON."""


async def decide_next_action(
    question_text: str,
    response_text: str,
    interview_type: str,
    questions_remaining: int,
    skill_topic: str | None = None,
    already_probed: bool = False,
) -> dict:
    """
    Returns decision dict. Falls back to next_question on any AI failure.
    """
    from app.ai.providers.groq import GroqProvider

    # Always move on if we already probed or very few questions left
    if already_probed or questions_remaining <= 1:
        return _fast_next(question_text, response_text)

    user_msg = f"""INTERVIEW TYPE: {interview_type}
SKILL/TOPIC: {skill_topic or 'General'}
QUESTIONS REMAINING: {questions_remaining}
ALREADY PROBED THIS QUESTION: {already_probed}

QUESTION ASKED:
{question_text}

CANDIDATE RESPONSE:
{response_text}

Evaluate and return your decision JSON."""

    try:
        provider = GroqProvider()
        result = await provider.complete(
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=500,
            temperature=0.3,
        )
        raw = result.content.strip()
        # Strip markdown code fences
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        decision = json.loads(raw)

        # Validate required keys
        if "action" not in decision or decision["action"] not in ("follow_up", "challenge", "next_question"):
            raise ValueError("Invalid action")

        return decision

    except Exception as exc:
        logger.warning("[ADAPTIVE_INTERVIEW] AI decision failed: %s", exc)
        return _fast_next(question_text, response_text)


def _fast_next(question_text: str, response_text: str) -> dict:
    """Fallback: move to next question with a neutral score."""
    return {
        "action": "next_question",
        "follow_up_question": None,
        "score_signals": {"depth": 5, "clarity": 5, "specificity": 5, "impact": 5},
        "provisional_score": 5,
        "coaching_note": "AI evaluation unavailable — response recorded.",
        "skip_reason": "fallback",
    }
