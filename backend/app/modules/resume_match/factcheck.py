"""Never-invent guard for AI-written resume lines.

A suggested bullet may only contain numbers and named things (tools, employers,
technologies) that already appear in its source text: the candidate's own bullet
or their own answer. Anything new is a fabrication a candidate could be caught on
in an interview, so the suggestion is rejected rather than shown.
"""
from __future__ import annotations

import re

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?(?:%|[kKmMxX])?")
_WORD = re.compile(r"[A-Za-z][A-Za-z0-9+#./&-]*")

# Capitalised words that are ordinary English rather than named things.
_COMMON = {
    "i", "a", "an", "the", "and", "or", "for", "with", "to", "in", "on", "of", "by", "at", "as",
    "built", "led", "managed", "created", "developed", "designed", "delivered", "improved", "reduced",
    "increased", "launched", "implemented", "analyzed", "analysed", "presented", "worked", "wrote",
    "maintained", "automated", "optimized", "optimised", "collaborated", "owned", "drove", "ran",
}


def _clean(word: str) -> str:
    return word.strip(".,;:()[]{}\"'-/&").lower()


def _norm_number(n: str) -> str:
    return n.replace(",", "").lower()


def numbers(text: str) -> set[str]:
    return {_norm_number(m.group()) for m in _NUMBER.finditer(text)}


def named_things(text: str) -> set[str]:
    """Words that look like tools/products/organisations: ALLCAPS, CamelCase, digits/symbols, or a
    capitalised word that is not the first word of a sentence."""
    out: set[str] = set()
    sentence_start = True
    for m in _WORD.finditer(text):
        raw = m.group()
        w = _clean(raw)
        before = text[:m.start()].rstrip()
        sentence_start = not before or before[-1] in ".!?\n-•*"
        if not w or w in _COMMON:
            continue
        core = raw.strip(".,;:()[]{}\"'-/&")
        distinctive = (
            any(c.isdigit() for c in core) or any(c in core for c in "+#")
            or (len(core) > 1 and core.isupper())
            or any(c.isupper() for c in core[1:])
            or ("." in core.strip(".") and len(core) > 2)
        )
        capitalised_mid_sentence = core[:1].isupper() and not sentence_start
        if distinctive or capitalised_mid_sentence:
            out.add(w)
    return out


def _vocabulary(text: str) -> set[str]:
    return {_clean(m.group()) for m in _WORD.finditer(text)}


def violations(suggestion: str, sources: str, allowed: str = "") -> list[str]:
    """Numbers / named things in `suggestion` supported by neither `sources` nor `allowed` text."""
    known_words = _vocabulary(sources) | _vocabulary(allowed)
    known_numbers = numbers(sources) | numbers(allowed)
    bad = sorted(n for n in numbers(suggestion) if n not in known_numbers)
    bad += sorted(w for w in named_things(suggestion) if w not in known_words)
    return bad


_STOP = {
    "the", "and", "for", "with", "that", "this", "from", "into", "onto", "over", "under", "about", "across",
    "using", "used", "use", "via", "per", "each", "their", "them", "its", "our", "your", "was", "were", "been",
    "are", "has", "have", "had", "who", "which", "while", "also", "than", "then", "upon", "within", "through",
}


def _stem(word: str) -> str:
    return word[:5]


def _content_words(text: str) -> list[str]:
    return [_clean(m.group()) for m in _WORD.finditer(text) if len(_clean(m.group())) > 3 and _clean(m.group()) not in _STOP]


def novel_words(suggestion: str, source: str) -> list[str]:
    """Content words in `suggestion` with no counterpart in `source` (matched on a 5-letter stem).

    Tools and numbers are policed by `violations`; this catches invented claims built from ordinary
    words ("actionable insights", "ensuring accuracy") that a rewrite must not add.
    """
    known = {_stem(w) for w in _content_words(source)}
    return [w for w in _content_words(suggestion) if _stem(w) not in known]


def too_embellished(suggestion: str, source: str) -> list[str]:
    """Novel words if the rewrite adds more than a light rephrasing would (else empty)."""
    novel = novel_words(suggestion, source)
    total = max(1, len(_content_words(suggestion)))
    return novel if len(novel) > max(2, int(0.25 * total)) else []
