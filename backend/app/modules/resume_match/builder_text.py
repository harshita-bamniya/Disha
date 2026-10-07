"""Render a Resume Builder resume (JSON sections) as plain text with standard headings.

Scanning a builder resume goes through the same parse -> match path as an uploaded
file, so both are judged identically. Headings are the ones an ATS expects.
"""
from __future__ import annotations

from typing import Any

_HEADINGS = {
    "summary": "Summary", "experience": "Experience", "education": "Education", "skills": "Skills",
    "projects": "Projects", "certifications": "Certifications", "achievements": "Achievements",
    "languages": "Languages",
}
_ORDER = list(_HEADINGS)


def _s(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return " ".join(_s(v) for v in value.values() if v)
    if isinstance(value, (list, tuple)):
        return ", ".join(_s(v) for v in value if v)
    return str(value).strip()


def _dates(item: dict) -> str:
    start, end = _s(item.get("start_date")), _s(item.get("end_date"))
    return f"{start} - {end}" if start or end else ""


def _bullets(item: dict) -> list[str]:
    raw = item.get("bullets") or item.get("highlights") or []
    if isinstance(raw, str):
        raw = raw.splitlines()
    return [f"- {b.strip().lstrip('-•* ').strip()}" for b in raw if isinstance(b, str) and b.strip()]


def _items(content: dict) -> list[dict]:
    items = content.get("items")
    return [i for i in items if isinstance(i, dict)] if isinstance(items, list) else []


def _render(section_type: str, content: dict) -> list[str]:
    lines: list[str] = []
    if section_type == "summary":
        if _s(content.get("text")):
            lines.append(_s(content["text"]))
    elif section_type == "experience":
        for it in _items(content):
            head = ", ".join(x for x in (_s(it.get("title")), _s(it.get("company"))) if x)
            lines.append(" ".join(x for x in (head, f"({_dates(it)})" if _dates(it) else "") if x))
            lines += _bullets(it)
    elif section_type == "education":
        for it in _items(content):
            degree = " in ".join(x for x in (_s(it.get("degree")), _s(it.get("field"))) if x)
            lines.append(", ".join(x for x in (degree, _s(it.get("institution")), _s(it.get("year"))) if x))
    elif section_type == "skills":
        for key, val in content.items():
            if _s(val):
                lines.append(f"{key.replace('_', ' ').title()}: {_s(val)}")
    elif section_type == "projects":
        for it in _items(content):
            tech = _s(it.get("tech"))
            lines.append(_s(it.get("name")) + (f" ({tech})" if tech else ""))
            lines += _bullets(it)
    else:  # certifications, achievements, languages
        raw = content.get("items", content)
        entries = raw if isinstance(raw, list) else [raw]
        lines += [f"- {_s(e)}" for e in entries if _s(e)]
    return lines


def resume_to_text(sections: list[dict]) -> str:
    """`sections`: [{"section_type": str, "content": dict}, ...]"""
    ordered = sorted(
        sections, key=lambda s: _ORDER.index(s["section_type"]) if s["section_type"] in _ORDER else len(_ORDER))
    out: list[str] = []
    for sec in ordered:
        body = _render(sec["section_type"], sec.get("content") or {})
        if body:
            out += [_HEADINGS.get(sec["section_type"], sec["section_type"].title()), *body, ""]
    return "\n".join(out).strip()
