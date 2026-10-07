"""Real YouTube video search — no API key required.

Uses yt-dlp's search-extractor (`ytsearchN:`) to pull real video metadata
(title, channel, duration, thumbnail) so learning-plan resources point at
actual videos instead of LLM-hallucinated search-result links.

Fetches extra candidates and filters to educational-length videos (5–90 min)
so short clips and multi-hour lectures don't pollute the results.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import yt_dlp

logger = logging.getLogger(__name__)

_YDL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": True,
    "skip_download": True,
    "noplaylist": True,
}

# Educational sweet-spot: long enough to teach a concept, short enough to watch
_MIN_DURATION_SEC = 5 * 60    # 5 minutes
_MAX_DURATION_SEC = 90 * 60   # 90 minutes

# ── relevance filtering ────────────────────────────────────────────────────
# A real YouTube search can rank a video high on generic word overlap alone
# (e.g. "budget", "process") even when it's about a completely different
# country or subject than the module actually needs — this is how a Sierra
# Leone budget-process video once got recommended for an "Indian state
# budgets" topic. These checks reject that class of mismatch before a video
# is ever shown to the learner as "Recommended".

_QUERY_STOPWORDS = {
    "the", "a", "an", "for", "and", "or", "with", "to", "of", "in", "on", "at",
    "by", "from", "into", "how", "what", "why", "your", "you", "is", "are",
    "this", "that", "tutorial", "explained", "guide", "introduction", "basics",
    "learn", "learning", "course", "beginner", "beginners", "full", "complete",
    "crash", "overview", "understanding", "tips", "tricks", "best", "top", "new",
}

# Common country/demonym terms that show up interchangeably in generic
# "process explained" style video titles — used only to catch a geography
# mismatch, not as an exhaustive gazetteer.
_COUNTRY_TERMS = {
    "india", "indian", "pakistan", "pakistani", "bangladesh", "bangladeshi",
    "nepal", "nepali", "china", "chinese", "america", "american", "usa",
    "britain", "british", "nigeria", "nigerian", "kenya", "kenyan",
    "sierra leone", "leonean", "canada", "canadian", "australia", "australian",
    "philippines", "filipino", "indonesia", "indonesian", "bhutan", "bhutanese",
}


def _significant_words(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if len(w) >= 4 and w not in _QUERY_STOPWORDS}


def _country_terms_in(text: str) -> set[str]:
    lower = text.lower()
    return {c for c in _COUNTRY_TERMS if c in lower}


def _stem_prefix(word: str) -> str:
    """Crude, dependency-free stemming: compare the first few characters so
    "legislative"/"legislature", "regulation"/"regulatory", "analyse"/
    "analysis" etc. count as the same root. Full-substring containment (the
    previous check) treats those as unrelated words, which — combined with the
    ratio threshold below — was rejecting genuinely relevant videos outright
    for any query with more than 2-3 specific significant words: real video
    titles rarely echo a keyword-stuffed search query word-for-word, but they
    very often share a root."""
    return word[:6] if len(word) > 6 else word


def _is_relevant(query: str, title: str) -> bool:
    """Reject a video whose title doesn't plausibly match the search query.

    Two independent checks, either of which rejects a candidate:
    1. Geography mismatch — the query names a country and the title names a
       different one (generic word overlap like "budget"/"process" isn't
       enough to save it).
    2. Keyword overlap — a meaningful share of the query's significant words
       (filler like "tutorial"/"explained" excluded) must share a root with
       something in the title.

    This is deliberately a coarse, cheap pre-filter — the real judgment of
    which surviving candidate best fits what the learner actually needs
    happens afterwards via embedding re-ranking (_rank_video_candidates_sync).
    This filter's only job is to reject outright mismatches without also
    rejecting everything, which a stricter version of it was doing for longer,
    more specific queries.
    """
    query_countries = _country_terms_in(query)
    if query_countries:
        title_countries = _country_terms_in(title)
        if title_countries and not (query_countries & title_countries):
            return False

    query_words = _significant_words(query)
    if not query_words:
        return True
    title_stems = {_stem_prefix(w) for w in _significant_words(title)}
    matched = {w for w in query_words if _stem_prefix(w) in title_stems}

    # Deliberately NOT a flat "N absolute matches is enough" floor: that was
    # tried and reverts exactly the bug this filter exists to catch — a query
    # like "Excel policy impact analysis government budget" and a title like
    # "Impact Analysis for Life Insurance Agents" share 2 words ("impact",
    # "analysis") while being a completely different domain, and no amount of
    # tuning a lexical floor separates that pair from a genuinely relevant
    # one, because they're lexically identical in overlap structure — this
    # was confirmed empirically, not assumed. A ratio keeps the bar
    # proportional to how much the query actually asked for.
    return len(matched) / len(query_words) >= 0.34


def _search_sync(query: str, n: int, fetch: int) -> list[dict[str, Any]] | None:
    """Fetch `fetch` raw results, filter to educational length, return top `n`.

    Returns None if the search itself failed (network/extractor error) — kept
    distinct from an empty list, which means the search worked fine but
    nothing cleared the relevance/duration bar. That distinction matters to
    the caller's circuit breaker: a hard specific query legitimately clearing
    zero results is a normal, per-query outcome that says nothing about
    whether yt-dlp is broken, but was previously indistinguishable from a real
    failure — so 3 unrelated "nothing matched" queries in a row (more likely
    now that queries are more specific) could disable video resolution for
    every remaining resource in the plan, not just the ones that struggled.
    """
    raw: list[dict[str, Any]] = []
    try:
        with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
            info = ydl.extract_info(f"ytsearch{fetch}:{query}", download=False)
            for entry in (info or {}).get("entries", []) or []:
                if not entry or not entry.get("id"):
                    continue
                duration = entry.get("duration") or 0
                thumbnails = entry.get("thumbnails") or []
                thumb = thumbnails[-1]["url"] if thumbnails else f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
                raw.append({
                    "video_id": entry["id"],
                    "title": entry.get("title") or "Untitled",
                    "channel": entry.get("channel") or entry.get("uploader") or "Unknown channel",
                    "duration_minutes": max(1, round(duration / 60)) if duration else 0,
                    "duration_seconds": duration,
                    "thumbnail_url": thumb,
                    "url": f"https://www.youtube.com/watch?v={entry['id']}",
                    "view_count": entry.get("view_count") or 0,
                })
    except Exception as exc:
        logger.warning("YouTube search failed for query %r: %s", query, exc)
        return None

    # Relevance first — an off-topic video is worse than a slightly-off-length one,
    # so irrelevant results are dropped outright rather than kept as a fallback.
    relevant = [v for v in raw if _is_relevant(query, v["title"])]

    # Prefer videos in the educational length range; fall back to any relevant
    # video if none qualify on duration alone.
    filtered = [
        v for v in relevant
        if _MIN_DURATION_SEC <= v["duration_seconds"] <= _MAX_DURATION_SEC
    ]
    chosen = filtered if filtered else relevant

    # Strip internal-only field before returning
    for v in chosen:
        v.pop("duration_seconds", None)
        v.pop("view_count", None)

    return chosen[:n]


async def search_youtube(query: str, n: int = 2) -> list[dict[str, Any]] | None:
    """Search YouTube and return up to `n` filtered video candidates for `query`.

    Fetches extra candidates internally so the duration/relevance filters (and
    the caller's own re-ranking against the resource's actual intent) have
    real alternatives to choose from without extra round-trips. Capped at 20
    regardless of `n` — past that, yt-dlp's per-call overhead stops being
    worth the marginal diversity for a single search_query.

    Returns None (not []) specifically on a search failure — see _search_sync.
    """
    fetch = min(max(n * 3, 10), 20)
    return await asyncio.to_thread(_search_sync, query, n, fetch=fetch)
