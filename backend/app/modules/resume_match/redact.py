"""Strip personal identifiers from resume text before it is sent to an LLM.

Name, contact details and address are not needed to judge fit, and keeping them
out of the prompt also keeps the score independent of who the person is.
"""
from __future__ import annotations

import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin|github|gitlab|behance|twitter|x)\.com/\S+", re.I)
_PHONE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}(?!\w)")
_PIN = re.compile(r"\b\d{6}\b")
_ADDRESS_LINE = re.compile(r"^\s*(?:address|permanent address|current address|residence)\s*[:\-]", re.I)
_PERSONAL_LINE = re.compile(r"^\s*(?:date of birth|dob|gender|sex|marital status|nationality|religion|father'?s? name)\s*[:\-]", re.I)
_YEAR_RANGE = re.compile(r"^(?:19|20)\d{2}\s*[-–]\s*(?:(?:19|20)\d{2}|present)$", re.I)


def _looks_like_name(line: str) -> bool:
    words = line.split()
    return 2 <= len(words) <= 5 and all(re.fullmatch(r"[A-Za-z][A-Za-z.'-]*", w) for w in words)


_ANY_YEAR_RANGE = re.compile(r"(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}")


def _phone_sub(m: re.Match) -> str:
    text = m.group()
    if _ANY_YEAR_RANGE.fullmatch(text.strip()):
        return text
    return "[PHONE]" if sum(c.isdigit() for c in text) >= 8 else text


def redact_resume_text(text: str) -> str:
    """Return text with name, contact details, address and protected attributes removed."""
    lines = text.splitlines()
    out: list[str] = []
    name_done = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append("")
            continue
        if _ADDRESS_LINE.match(stripped) or _PERSONAL_LINE.match(stripped):
            continue
        # The candidate's name is the first substantive line of nearly every resume.
        if not name_done:
            name_done = True
            if _looks_like_name(stripped) and not _YEAR_RANGE.match(stripped):
                out.append("[NAME]")
                continue
        line = _EMAIL.sub("[EMAIL]", line)
        line = _URL.sub("[LINK]", line)
        line = _PHONE.sub(_phone_sub, line)
        line = _PIN.sub("[PIN]", line)
        out.append(line)
    return "\n".join(out)
