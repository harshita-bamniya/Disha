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
- Optionally, recent conversation history from earlier in this same interview

If recent history is provided, use it: don't ask a follow-up that's effectively already been
asked, and if the candidate's current answer plainly repeats or contradicts something they said
earlier, you may probe that naturally as your follow-up — phrase it as a normal curious question,
not an accusation.

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
    recent_history: str | None = None,
) -> dict:
    """
    Returns decision dict. Falls back to next_question on any AI failure.
    """
    from app.ai.providers import create_provider

    # Always move on if we already probed or very few questions left
    if already_probed or questions_remaining <= 1:
        return _fast_next(question_text, response_text)

    history_section = (
        f"\nRECENT CONVERSATION HISTORY (earlier in this same interview):\n{recent_history}\n"
        if recent_history else ""
    )

    user_msg = f"""INTERVIEW TYPE: {interview_type}
SKILL/TOPIC: {skill_topic or 'General'}
QUESTIONS REMAINING: {questions_remaining}
ALREADY PROBED THIS QUESTION: {already_probed}
{history_section}
QUESTION ASKED:
{question_text}

CANDIDATE RESPONSE:
{response_text}

Evaluate and return your decision JSON."""

    try:
        provider = create_provider()
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

        # Defensive clamp — never trust an unvalidated numeric score from the LLM.
        try:
            decision["provisional_score"] = max(1, min(10, int(float(decision.get("provisional_score", 5)))))
        except (TypeError, ValueError):
            decision["provisional_score"] = 5
        signals = decision.get("score_signals")
        if isinstance(signals, dict):
            for key, val in list(signals.items()):
                try:
                    signals[key] = max(1, min(10, int(float(val))))
                except (TypeError, ValueError):
                    signals[key] = 5

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
