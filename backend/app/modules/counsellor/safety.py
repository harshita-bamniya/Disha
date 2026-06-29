"""
Safety layer for BeginablAI Counsellor.

This is non-negotiable infrastructure. UPSC aspirants carry real psychological weight.
The system must detect distress signals and respond with empathy + escalation paths.

Severity levels:
  low      → respond with empathy, proceed normally
  medium   → add mental health resources to response
  high     → override response with crisis-specific message + helpline numbers
  critical → flag for admin review + send iCall / Vandrevala Foundation numbers
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class SafetyAssessment:
    is_flagged: bool
    severity: str               # "none", "low", "medium", "high", "critical"
    flag_type: Optional[str]    # "distress", "self_harm", "crisis", "burnout_severe", "anger"
    triggered_by: Optional[str]


# ─── Keyword dictionaries ─────────────────────────────────────────────────────
# These are conservative intentionally — false positives are far less harmful
# than missing a genuine crisis signal.

_CRITICAL_PATTERNS = [
    r"\bend\s+(?:my\s+)?(?:it\s+all|everything|life)\b",
    r"\bsuicid",
    r"\bkill\s+myself\b",
    r"\bwant\s+to\s+die\b",
    r"\bnot\s+want\s+to\s+(?:be\s+)?(?:alive|live)\b",
    r"\bharm\s+myself\b",
    r"\bself\s*[- ]?harm\b",
    r"\bno\s+reason\s+to\s+(?:live|go\s+on)\b",
]

_HIGH_PATTERNS = [
    r"\bgive\s+up\b",
    r"\bno\s+(?:point|hope|future)\b",
    r"\bwasted\s+(?:my\s+)?(?:years|life|time)\b",
    r"\bending\s+it\b",
    r"\bcan'?t\s+(?:go\s+on|take\s+it|cope)\b",
    r"\bfailure\s+(?:as\s+a\s+)?(?:person|human|son|daughter)\b",
    r"\bbroken\s+(?:inside|completely|beyond)\b",
]

_MEDIUM_PATTERNS = [
    r"\bdepressed?\b",
    r"\banxious\b",
    r"\boverwhelmed\b",
    r"\burnout\b",
    r"\bexhausted\b",
    r"\bcan'?t\s+sleep\b",
    r"\bfeel\s+(?:so\s+)?alone\b",
    r"\bnobody\s+(?:cares?|understands?)\b",
    r"\bdisappointed\b",
    r"\bshame\b",
    r"\bfeel\s+(?:so\s+)?(?:lost|stuck|trapped)\b",
]

_LOW_PATTERNS = [
    r"\bstress(?:ed|ful)?\b",
    r"\bworried?\b",
    r"\bscared?\b",
    r"\bnervous\b",
    r"\bupset\b",
    r"\bfrustrat(?:ed|ing)?\b",
    r"\bcry(?:ing)?\b",
]


_COMPILED_CRITICAL = [re.compile(p, re.IGNORECASE) for p in _CRITICAL_PATTERNS]
_COMPILED_HIGH = [re.compile(p, re.IGNORECASE) for p in _HIGH_PATTERNS]
_COMPILED_MEDIUM = [re.compile(p, re.IGNORECASE) for p in _MEDIUM_PATTERNS]
_COMPILED_LOW = [re.compile(p, re.IGNORECASE) for p in _LOW_PATTERNS]


def assess(text: str) -> SafetyAssessment:
    """Run the safety pre-check on user input."""
    for pattern in _COMPILED_CRITICAL:
        m = pattern.search(text)
        if m:
            return SafetyAssessment(
                is_flagged=True,
                severity="critical",
                flag_type="self_harm",
                triggered_by=m.group(0),
            )

    for pattern in _COMPILED_HIGH:
        m = pattern.search(text)
        if m:
            return SafetyAssessment(
                is_flagged=True,
                severity="high",
                flag_type="distress",
                triggered_by=m.group(0),
            )

    for pattern in _COMPILED_MEDIUM:
        m = pattern.search(text)
        if m:
            return SafetyAssessment(
                is_flagged=True,
                severity="medium",
                flag_type="burnout_severe" if "burnout" in m.group(0).lower() else "distress",
                triggered_by=m.group(0),
            )

    for pattern in _COMPILED_LOW:
        m = pattern.search(text)
        if m:
            return SafetyAssessment(
                is_flagged=True,
                severity="low",
                flag_type="distress",
                triggered_by=m.group(0),
            )

    return SafetyAssessment(is_flagged=False, severity="none", flag_type=None, triggered_by=None)


# ─── Crisis response content ──────────────────────────────────────────────────

CRISIS_RESPONSE = """I can hear that you're going through something very difficult right now.
What you're feeling matters, and I want you to know that you're not alone in this.

Please reach out to a counsellor who can truly support you:

**iCall** (Tata Institute of Social Sciences): 9152987821
**Vandrevala Foundation**: 1860-2662-345 (24×7, free)
**Snehi India**: 044-24640050
**iCall WhatsApp**: +91-9152987821

You don't have to face this alone. These are trained, compassionate professionals who understand.

I'm still here if you want to talk — but please also reach out to one of these helplines today.
"""

MEDIUM_RESOURCES_ADDON = """

---
*If you're finding things overwhelming, please know that support is available:*
- *iCall (TISS): 9152987821*
- *Vandrevala Foundation (24×7): 1860-2662-345*
"""
