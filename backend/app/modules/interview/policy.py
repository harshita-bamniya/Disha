"""Interview flow rules, in code.

The LLM may *suggest* a follow-up, but whether one happens, when the interview
ends and which question comes next are decided here, deterministically, so a
session's shape never depends on a model's mood. Everything in this module is
pure (no DB, no LLM) so it is trivially testable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence

# One probe per question, and a cap across the whole interview so follow-ups
# can't swallow the session.
MAX_FOLLOWUPS_PER_QUESTION = 1

# Target length per session type (seconds). Past HARD_LIMIT_FACTOR x target the
# interview wraps up instead of asking more.
SESSION_TARGET_SECONDS = {"practice": 10 * 60, "timed": 15 * 60, "full_mock": 20 * 60, "stress": 15 * 60, "drill": 5 * 60}
HARD_LIMIT_FACTOR = 1.5
MIN_SECONDS_FOR_FOLLOWUP = 45

_DIFFICULTY_RANK = {"easy": 0, "medium": 1, "hard": 2}


def followup_cap_total(total_questions: int) -> int:
    """At most half as many follow-ups as planned questions (minimum 1)."""
    return max(1, total_questions // 2)


def max_responses(total_questions: int) -> int:
    """Hard ceiling on answers accepted for one session."""
    return total_questions + followup_cap_total(total_questions)


def hard_limit_seconds(session_type: str | None) -> int:
    target = SESSION_TARGET_SECONDS.get(session_type or "practice", SESSION_TARGET_SECONDS["practice"])
    return int(target * HARD_LIMIT_FACTOR)


def main_answered(responses: Iterable[Any]) -> int:
    """Answers to planned questions (follow-ups don't use up the question budget)."""
    return sum(1 for r in responses if not getattr(r, "is_followup", False))


def followups_used(responses: Iterable[Any]) -> int:
    return sum(1 for r in responses if getattr(r, "is_followup", False))


@dataclass(frozen=True)
class Decision:
    action: str          # follow_up | challenge | next_question | close
    reason: str


def choose_action(
    llm_action: str | None,
    has_followup_text: bool,
    *,
    main_remaining: int,
    followups_used_total: int,
    followup_cap: int,
    already_probed: bool,
    elapsed_sec: float | None,
    hard_limit_sec: int,
) -> Decision:
    """Code wins over the model. `llm_action` is only a suggestion."""
    if elapsed_sec is not None and elapsed_sec >= hard_limit_sec:
        return Decision("close", "time_limit")

    wants_probe = llm_action in ("follow_up", "challenge") and has_followup_text
    if wants_probe:
        if already_probed:
            blocked = "probe_cap_per_question"
        elif followups_used_total >= followup_cap:
            blocked = "probe_cap_total"
        elif elapsed_sec is not None and hard_limit_sec - elapsed_sec < MIN_SECONDS_FOR_FOLLOWUP:
            blocked = "low_time"
        else:
            return Decision(llm_action or "follow_up", "probe_allowed")
        if main_remaining <= 0:
            return Decision("close", blocked)
        return Decision("next_question", blocked)

    if main_remaining <= 0:
        return Decision("close", "coverage_complete")
    return Decision("next_question", "advance")


def pick_next_question(candidates: Sequence[Any], difficulty_ramp: str | None, generation_order: Sequence[str] | None = None):
    """Next planned question: follow the blueprint's difficulty ramp (easy to
    hard by default, so a candidate starts with a win), breaking ties by the
    order the questions were generated in. Never random."""
    if not candidates:
        return None
    ramp = (difficulty_ramp or "").lower()
    hard_at, easy_at = ramp.find("hard"), ramp.find("easy")
    descending = hard_at != -1 and (easy_at == -1 or hard_at < easy_at)
    order = {qid: i for i, qid in enumerate(generation_order or [])}

    def key(q: Any):
        rank = _DIFFICULTY_RANK.get((getattr(q, "difficulty", None) or "medium"), 1)
        return (-rank if descending else rank, order.get(str(q.id), 10_000))

    return sorted(candidates, key=key)[0]
