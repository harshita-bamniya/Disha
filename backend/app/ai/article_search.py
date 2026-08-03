"""Real article URL resolution — no API key required.

Uses:
  - Wikipedia REST API for Wikipedia resources (reliable, official, free)
  - DuckDuckGo `site:` search for all other known sources

Both approaches return the actual article URL rather than a search-results page,
so "View Resource" lands users directly on the content.
"""
from __future__ import annotations

import asyncio
import logging
import urllib.parse
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Maps a lowercase substring of channel_or_source → the canonical domain.
# Checked in order; first match wins.
_SOURCE_DOMAINS: list[tuple[str, str]] = [
    # ── UPSC / IAS prep ──────────────────────────────────────────────────────
    ("insight",           "insightsonindia.com"),
    ("mrunal",            "mrunal.org"),
    ("clearias",          "clearias.com"),
    ("drishti",           "drishtiias.com"),
    ("vision ias",        "visionias.in"),
    ("forum ias",         "forumias.com"),
    ("byju",              "byjus.com"),
    ("unacademy",         "unacademy.com"),
    ("testbook",          "testbook.com"),
    ("studyiq",           "studyiq.com"),
    # ── Policy / Legal ───────────────────────────────────────────────────────
    ("prs india",         "prsindia.org"),
    ("prs legislative",   "prsindia.org"),
    ("india kanoon",      "indiankanoon.org"),
    # ── Sustainability / CSR ────────────────────────────────────────────────
    ("triplepundit",      "triplepundit.com"),
    ("greenbiz",          "greenbiz.com"),
    ("csr wire",          "csrwire.com"),
    # ── News / Newspapers ────────────────────────────────────────────────────
    ("the hindu",         "thehindu.com"),
    ("indian express",    "indianexpress.com"),
    ("livemint",          "livemint.com"),
    ("economic times",    "economictimes.indiatimes.com"),
    ("business standard", "business-standard.com"),
    ("hindustan times",   "hindustantimes.com"),
    ("down to earth",     "downtoearth.org.in"),
    ("mint",              "livemint.com"),
    # ── General education ────────────────────────────────────────────────────
    ("britannica",        "britannica.com"),
    ("investopedia",      "investopedia.com"),
    ("khan academy",      "khanacademy.org"),
    ("geeksforgeeks",     "geeksforgeeks.org"),
    ("coursera",          "coursera.org"),
    ("udemy",             "udemy.com"),
    ("edx",               "edx.org"),
    ("nptel",             "nptel.ac.in"),
    ("hbr",               "hbr.org"),
    ("harvard business",  "hbr.org"),
    ("shrm",              "shrm.org"),
    ("mckinsey",          "mckinsey.com"),
    ("deloitte",          "deloitte.com"),
    # ── International orgs ───────────────────────────────────────────────────
    ("world bank",        "worldbank.org"),
    ("imf",               "imf.org"),
    ("un.org",            "un.org"),
    ("niti aayog",        "niti.gov.in"),
]


def _get_domain(source: str) -> str | None:
    s = source.lower().strip()
    for keyword, domain in _SOURCE_DOMAINS:
        if keyword in s:
            return domain
    return None


async def _resolve_via_wikipedia(query: str) -> str | None:
    """Use the MediaWiki Action API to get the direct article URL.

    Uses the Action API (more reliable than the REST API) — searches for the
    best-matching article title and constructs the canonical wiki URL.
    """
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": 1,
                    "format": "json",
                    "utf8": 1,
                },
                headers={"User-Agent": "Disha-AI-Learning-Platform/1.0 (https://disha.ai)"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            results = data.get("query", {}).get("search", [])
            if results:
                title = results[0]["title"].replace(" ", "_")
                return f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title, safe='_:/')}"
    except Exception as exc:
        logger.warning("Wikipedia API failed for %r: %s", query, exc)
    return None


def _ddg_search_sync(search_query: str) -> str | None:
    """Run a DuckDuckGo search and return the URL of the first organic result."""
    try:
        from duckduckgo_search import DDGS
        results = list(DDGS().text(search_query, max_results=1))
        if results:
            return results[0].get("href")
    except Exception as exc:
        logger.warning("DDG search failed for %r: %s", search_query, exc)
    return None


async def _resolve_via_ddg(query: str, domain: str | None) -> str | None:
    """Search DuckDuckGo (optionally scoped to a domain) and return the first URL.

    A short sleep before the call avoids rate-limits when multiple article
    resources are resolved in sequence during plan enrichment.
    """
    await asyncio.sleep(0.6)
    search_q = f"site:{domain} {query}" if domain else query
    return await asyncio.to_thread(_ddg_search_sync, search_q)


async def resolve_article_url(query: str, source: str) -> str | None:
    """Return a direct article URL for the given query + source name.

    Returns None if no real URL could be found — callers should fall back to a
    site-specific search page (already set by _build_article_url in plan_generator).
    """
    source_lower = source.lower().strip()

    # Wikipedia has an official REST API — prefer it over DDG for reliability.
    if "wikipedia" in source_lower:
        url = await _resolve_via_wikipedia(query)
        if url:
            return url

    domain = _get_domain(source)
    return await _resolve_via_ddg(query, domain)
