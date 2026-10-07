"""Known-facts registry for Indian regulatory content in generated roadmaps.

Blueprints are drafted by an AI from general knowledge, which goes stale or gets details wrong
(for example calling the final data-protection rules "2024"). This registry holds a small set of
facts that were checked against primary or reputable sources, with the date they were checked:

* CORRECTIONS rewrite a name that is known to be out of date.
* CHECKS don't rewrite anything; they attach a warning to the roadmap so a human looks before
  a learner relies on a claim that is commonly stated wrongly.

It is deliberately small and explicit. Add an entry only with a source and a checked date.
"""
from __future__ import annotations

import re
from typing import Any

_DATA_PROTECTION_CONTEXT = re.compile(r"\bDPDP\b|data[\s\-]protection", re.I)

# (pattern, replacement, note, source, checked_on)
CORRECTIONS: list[tuple[re.Pattern[str], str, str, str, str]] = [
    (
        # "Rules 2024" alone, in a text that is about data protection ("DPDP Act 2023 & Rules 2024")
        re.compile(r"\bRules,?\s*2024\b", re.I),
        "Rules, 2025",
        "The final rules are the Digital Personal Data Protection Rules, 2025 (notified 14 Nov 2025).",
        "https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025",
        "2026-10-02",
    ),
    (
        re.compile(r"\b(?:Digital Personal Data Protection|DPDP)\s+Rules,?\s*(?:2024|2025\s*\(draft\))", re.I),
        "Digital Personal Data Protection Rules, 2025",
        "The final rules are the Digital Personal Data Protection Rules, 2025 (notified 14 Nov 2025).",
        "https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025",
        "2026-10-02",
    ),
]

# (pattern, warning, source, checked_on)
CHECKS: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        re.compile(r"\bIT Act(?: 2000)?\s*\(?\s*2023 amendments?\)?", re.I),
        "Check: there is no separate 2023 amendment to the IT Act. The DPDP Act 2023 (s.44(2)) omits section 43A.",
        "https://dpdpa.com/dpdpa2023/chapter-9/section44.html", "2026-10-02",
    ),
    (
        re.compile(r"\bannual\b[^.]{0,60}\b(?:cyber|incident)[^.]{0,60}\bCERT[‑\- ]?In\b|\bCERT[‑\- ]?In\b[^.]{0,80}\bannual\b[^.]{0,40}\bincident", re.I),
        "Check: CERT-In's 2022 Directions require incidents to be reported within 6 hours, not in an annual report.",
        "https://trilegal.com/knowledge-repository/2022-cert-in-directions-on-reporting-cyber-incidents/", "2026-10-02",
    ),
    (
        re.compile(r"\b(?:every|each|all)\b[^.]{0,40}\b(?:new\b[^.]{0,30})?(?:launch|product|feature|deployment)[^.]{0,60}\bDPIA\b|\bDPIA\b[^.]{0,60}\b(?:every|each|all)\b[^.]{0,40}\b(?:launch|product|feature)", re.I),
        "Check: under the DPDP Act a DPIA is mandatory only for Significant Data Fiduciaries (s.10(2)(c)), not for every launch.",
        "https://dpdpa.com/dpdpa2023/chapter-2/section10.html", "2026-10-02",
    ),
]

_SKIP_KEYS = {"id", "skill_id", "module_id", "resource_id", "url", "video_id", "thumbnail_url", "matched_skill",
              "slug", "type", "kind", "status", "phase_id", "prerequisites", "module_ids", "source", "channel",
              "channel_or_source", "search_query"}


def apply_statute_checks(obj: Any) -> tuple[Any, list[str], list[str]]:
    """Walk a plan/blueprint structure. Returns (corrected copy, corrections made, warnings).

    Only free-text strings are touched; identifiers, urls and similar keys are left alone.
    """
    corrections: list[str] = []
    warnings: list[str] = []

    def fix_text(text: str) -> str:
        out = text
        for pattern, replacement, note, _src, _day in CORRECTIONS:
            # a bare "Rules 2024" is only wrong when the text is about data protection
            if pattern.pattern.startswith(r"\bRules") and not _DATA_PROTECTION_CONTEXT.search(out):
                continue
            if pattern.search(out):
                out = pattern.sub(replacement, out)
                if note not in corrections:
                    corrections.append(note)
        for pattern, warning, _src, _day in CHECKS:
            if pattern.search(text) and warning not in warnings:
                warnings.append(warning)
        return out

    def walk(node: Any, key: str | None = None) -> Any:
        if isinstance(node, str):
            return node if key in _SKIP_KEYS else fix_text(node)
        if isinstance(node, list):
            return [walk(v, key) for v in node]
        if isinstance(node, dict):
            return {k: walk(v, k) for k, v in node.items()}
        return node

    return walk(obj), corrections, warnings
