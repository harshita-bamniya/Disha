"""Compliance filter for employer-written interview questions.

An employer may add up to three questions of their own. Questions about
protected personal characteristics (age, marital status, family plans,
religion, caste, gender, disability, health, nationality or origin) are
refused: they are unfair to ask and expose the employer to legal risk. This is
a keyword safety net, not a substitute for the employer's own judgement, so it
is deliberately conservative and always tells the employer why a question was
blocked.
"""
from __future__ import annotations

import re

MAX_CUSTOM_QUESTIONS = 3
MAX_QUESTION_CHARS = 400

# (reason shown to the employer, patterns). Phrases rather than single words, so
# "single point of failure" or "community engagement" don't trip it.
_RULES: list[tuple[str, list[str]]] = [
    ("age", [
        r"\bhow\s+old\b", r"\byour\s+age\b", r"\bdate\s+of\s+birth\b", r"\bbirth\s*(?:day|year|date)\b",
        "उम्र", "आयु कितनी", "जन्म तिथि", r"\bumar\s+kitni\b", r"\bkitne\s+saal\s+ke\b",
        r"\bwhat\s+year\s+were\s+you\s+born\b", r"\bage\s+(?:group|limit|bracket)\b",
    ]),
    ("marital status or family plans", [
        r"\bmarital\b", r"\bmarried\b", r"\bunmarried\b", r"\bare\s+you\s+single\b", r"\bhusband\b", r"\bwife\b",
        r"\bspouse\b", r"\bpartner(?:ship)?\s+status\b", r"\bdivorc", r"\bpregnan", r"\bplan(?:ning)?\s+(?:to\s+)?(?:have|start)\s+(?:a\s+)?(?:baby|babies|children|kids|family)\b",
        r"\bfamily\s+plans?\b", r"\bhave\s+(?:any\s+)?(?:children|kids)\b", r"\bchildcare\b", r"\bshaadi\b", r"\bvivah\b",
        r"\bgirlfriend\b", r"\bboyfriend\b", r"\bfianc", r"\brelationship\s+status\b", r"\bdating\b",
        r"\bin\s+a\s+relationship\b",
        "शादी", "विवाह", "कुंवारे", "पत्नी", "गर्भवती",
    ]),
    ("religion", [
        r"\breligio", r"\bwhich\s+(?:god|faith)\b", r"\bchurch\b", r"\btemple\b", r"\bmosque\b", r"\bhijab\b",
        r"\bturban\b", r"\bdharm\b", r"\bfasting\b", r"\bhindu\b", r"\bmuslim\b", r"\bchristian\b", r"\bsikh\b",
    ]),
    ("caste or community", [
        r"\bcaste\b", r"\bsub-?caste\b", r"\bjaati\b", r"\bjati\b", r"\bgotra\b", r"\bscheduled\s+(?:caste|tribe)\b",
        r"\bwhich\s+community\b", r"\byour\s+community\b", "जाति", "गोत्र", "धर्म", "मज़हब",
    ]),
    ("gender", [
        r"\bgender\b", r"\bare\s+you\s+(?:a\s+)?(?:male|female|man|woman)\b", r"\bsexual\s+orientation\b",
        r"\btransgender\b", r"\bas\s+a\s+(?:woman|man|girl|boy)\b",
    ]),
    ("disability or health", [
        r"\bdisabilit", r"\bhandicap", r"\bmedical\s+(?:condition|history)\b", r"\bany\s+illness\b",
        r"\bmental\s+health\b", r"\bchronic\b", r"\bhiv\b",
        r"\b(?:your|any)\s+(?:health|medical|medication|illness|disease)\b", r"\bhealth\s+(?:condition|issue|problem)s?\b",
        r"\bsuffer(?:ing)?\s+from\b", r"\bdo\s+you\s+(?:have|take)\b[^?.]*\b(?:condition|illness|disease|disorder|medication)\b",
    ]),
    ("nationality or origin", [
        r"\bnationality\b", r"\bethnic", r"\bwhere\s+(?:are\s+you|is\s+your\s+family)\s+(?:really\s+)?from\b",
        r"\bnative\s+place\b", r"\bmother\s+tongue\b", r"\bnative\s+language\b",
        r"\b(?:which|what)\s+(?:state|city|town|village|country|district|region)\s+(?:are\s+you|do\s+you|is\s+your\s+family)\s+(?:originally\s+)?(?:from|belong|come)",
        r"\bwhere\s+(?:are|were)\s+you\s+(?:originally\s+)?(?:from|born)\b", r"\bwhere\s+do\s+you\s+(?:originally\s+)?(?:come|belong)\b",
        r"\boriginally\s+from\b", r"\bhometown\b", r"\bbirth\s*place\b", r"\bplace\s+of\s+birth\b",
    ]),
]
_COMPILED = [(reason, [re.compile(p, re.IGNORECASE) for p in patterns]) for reason, patterns in _RULES]


def check_question(text: str) -> list[str]:
    """Reasons this question is not allowed (empty list = fine)."""
    found: list[str] = []
    for reason, patterns in _COMPILED:
        if any(p.search(text or "") for p in patterns):
            found.append(reason)
    return found


def validate_custom_questions(questions: list[str]) -> list[str]:
    """Clean the list (trim, drop blanks) and raise ValueError, listing every
    problem at once, if it breaks a rule. Returns the cleaned questions."""
    cleaned = [q.strip() for q in questions if q and q.strip()]
    problems: list[str] = []
    if len(cleaned) > MAX_CUSTOM_QUESTIONS:
        problems.append(f"At most {MAX_CUSTOM_QUESTIONS} custom questions are allowed.")
    for i, q in enumerate(cleaned[:MAX_CUSTOM_QUESTIONS + 3], start=1):
        if len(q) > MAX_QUESTION_CHARS:
            problems.append(f"Question {i} is too long (limit {MAX_QUESTION_CHARS} characters).")
        reasons = check_question(q)
        if reasons:
            problems.append(
                f"Question {i} can't be used: it asks about {', '.join(reasons)}. "
                "Interview questions must relate to the person's ability to do the job."
            )
    if problems:
        raise ValueError(" ".join(problems))
    return cleaned
