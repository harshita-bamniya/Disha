"""The career-transition question, Disha's own interview competency.

Every candidate is asked how they got from years of civil-services
preparation to this role, because it is the question they will face and fear
most. It is asked first (replacing the generic "tell me about yourself"), is
scored on its own rubric (feedback_ai.build_transition_prompt) and counts as a
normal competency; the career gap itself is never scored.
"""
from __future__ import annotations

from typing import Any

TRANSITION_SKILL = "Career transition story"
# Relative weight next to the role's other competencies (which sum to 100).
TRANSITION_WEIGHT = 10

_QUESTIONS = {
    "en": (
        "You spent several years preparing for the civil services. Tell me about that journey, what you "
        "built along the way, and why you are now moving into {role}."
    ),
    "hinglish": (
        "Aapne kai saal civil services ki tayyari mein lagaye. Us safar ke baare mein bataiye, us dauraan "
        "aapne kya seekha ya banaya, aur ab {role} mein kyun aana chahte hain?"
    ),
    "hi": (
        "आपने कई साल सिविल सेवा की तैयारी में लगाए। उस सफ़र के बारे में बताइए, उस दौरान आपने क्या सीखा "
        "या बनाया, और अब आप {role} में क्यों आना चाहते हैं?"
    ),
}


def question(language: str | None, role: str | None) -> str:
    template = _QUESTIONS.get(language or "en", _QUESTIONS["en"])
    return template.format(role=(role or "this role").strip() or "this role")


def with_competency(competencies: list[dict]) -> list[dict]:
    """The role's competency matrix plus the transition story (added once)."""
    if any(c.get("skill") == TRANSITION_SKILL for c in competencies):
        return list(competencies)
    return [*competencies, {"skill": TRANSITION_SKILL, "weight": TRANSITION_WEIGHT}]


def is_transition_answer(blueprint: dict | None, response: Any) -> bool:
    """True for the answer to the fixed transition question: the first answer,
    id-less (it isn't a bank row), whose question text is the one stored on the
    blueprint."""
    asked = ((blueprint or {}).get("_transition_question") or "").strip()
    if not asked:
        return False
    return (
        getattr(response, "sequence_num", None) == 1
        and getattr(response, "question_id", None) is None
        and (getattr(response, "dynamic_question_text", None) or "").strip() == asked
    )
