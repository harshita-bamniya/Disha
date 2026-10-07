"""Safety net for candidate answers during an interview.

Two levels:
  crisis   - first-person self-harm language. The interview is halted, never
             scored, a safety event is recorded for the human team, and the
             candidate is shown helplines.
  distress - signs of being overwhelmed. The interview continues, the answer
             is excluded from scoring, and the candidate is offered a break.

Deliberately NOT the counsellor's keyword list (app.core.safety): that list is
tuned for a chat where any mention of "suicide" or "wasted years" is a signal,
but interview answers legitimately discuss policy topics ("farmer suicides")
and career-transition stories ("I never felt those years were wasted"). A
false halt there would be a bad experience, so crisis matching here needs
first-person phrasing. Pure functions; no DB.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.safety import CRISIS_RESPONSE

_CRISIS = [re.compile(p, re.IGNORECASE) for p in (
    r"\bkill\s+myself\b",
    r"\bwant\s+to\s+die\b",
    r"\bwish\s+i\s+(?:was|were)\s+dead\b",
    r"\bend\s+my\s+(?:own\s+)?life\b",
    r"\bend\s+it\s+all\b",
    r"\b(?:harm|hurt)\s+myself\b",
    r"\bno\s+reason\s+to\s+(?:live|go\s+on)\b",
    r"\bnot\s+want\s+to\s+(?:be\s+)?(?:alive|live)\b",
    r"\b(?:i(?:'m|\s+am)?|i\s+want\s+to|i\s+will|i\s+feel\s+like)\b[^.?!]{0,25}\bsuicid",
    # Hinglish / Hindi
    r"\bmar\s*jaa?na\s+chah",
    r"\bmarna\s+chah",
    r"\bjaan\s+de\s*(?:du|dun|dena)\b",
    r"\bkhud\s+ko\s+(?:khatam|maar)",
    r"\bzindagi\s+khatam\b",
    r"\b(?:jeena|jeene|jina|jine)\s+(?:nahi|nahin|ka\s+mann?\s+nahi)",
    r"\bmar\s*ja(?:u|un|aun|ana)\b",
    r"\bkhudkushi\b|\bkhudkhushi\b|\bsuicide\s+kar",
    r"\bapni\s+jaan\s+(?:de|le)",
    r"आत्महत्या\s*कर",
    r"आत्महत्या\s*(?:करने|करूँ|करूं)",
    r"खुदकुशी",
    r"मरना\s*चाहत",
    r"मर\s*जा(?:ना|ऊँ|ऊं|ऊ)\b",
    r"जान\s*दे",
    r"अपनी\s+जान\s+(?:दे|ले)",
    r"खुद\s+को\s+(?:खत्म|ख़त्म|मार|नुकसान|चोट)",
    r"(?:जीना|जीने)\s+(?:नहीं|नही|का\s+मन\s+नहीं|की\s+इच्छा\s+नहीं)",
    r"जिंदगी\s+(?:खत्म|ख़त्म)|ज़िंदगी\s+(?:खत्म|ख़त्म)",
    r"जीवन\s+(?:खत्म|ख़त्म)\s+कर",
)]

_DISTRESS = [re.compile(p, re.IGNORECASE) for p in (
    r"\bi\s+can'?t\s+do\s+this\s+(?:anymore|any\s+more)\b",
    r"\bcan'?t\s+(?:go\s+on|take\s+it|cope)\b",
    r"\bno\s+(?:hope|point\s+in\s+(?:living|going\s+on))\b",
    r"\bfeel\s+(?:so\s+)?(?:hopeless|worthless|broken)\b",
    r"\bi'?m\s+(?:falling\s+apart|breaking\s+down)\b",
    r"\bmujhse\s+nahi\s+ho\s+(?:payega|payegi|raha)\b",
    r"\bbahut\s+(?:tension|dukhi|udaas)\b",
    r"मुझसे\s+नहीं\s+हो\s+(?:पाएगा|पायेगा|पाएगी|पायेगी|रहा|रही)",
    r"बहुत\s+(?:टेंशन|दुखी|उदास|परेशान)",
    r"(?:थक|हार)\s+गय(?:ा|ी)\s+हूँ|(?:थक|हार)\s+गय(?:ा|ी)\s+हूं",
)]

HELPLINES = [
    {"name": "iCall (TISS)", "contact": "9152987821"},
    {"name": "Vandrevala Foundation (24x7, free)", "contact": "1860-2662-345"},
    {"name": "Snehi India", "contact": "044-24640050"},
]

CRISIS_MESSAGE = (
    "We've stopped this interview. What you wrote matters more than any practice session, "
    "and you don't have to carry this alone. Please talk to someone today."
)
DISTRESS_MESSAGE = (
    "It sounds like this is getting heavy. This is only practice, so take a break whenever you "
    "like, or end the interview now. Nothing is lost."
)


@dataclass(frozen=True)
class AnswerSafety:
    level: str                 # none | distress | crisis
    trigger: str | None = None


def assess_answer(text: str | None) -> AnswerSafety:
    value = text or ""
    for pattern in _CRISIS:
        m = pattern.search(value)
        if m:
            return AnswerSafety("crisis", m.group(0)[:200])
    for pattern in _DISTRESS:
        m = pattern.search(value)
        if m:
            return AnswerSafety("distress", m.group(0)[:200])
    return AnswerSafety("none")


__all__ = ["assess_answer", "AnswerSafety", "HELPLINES", "CRISIS_MESSAGE", "DISTRESS_MESSAGE", "CRISIS_RESPONSE"]
