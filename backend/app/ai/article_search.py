"""Real article URL resolution — no API key required.

Uses:
  - Wikipedia REST API for Wikipedia resources (reliable, official, free)
  - DuckDuckGo `site:` search for all other known sources

Both approaches return the actual article URL rather than a search-results page,
so "View Resource" lands users directly on the content.
"""
from __future__ import annotations

import asyncio
import html
import logging
import re
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_WHITESPACE_RE = re.compile(r"\s+")

# Common "site name" suffixes/prefixes that HTML <title> tags append — stripped
# so a fetched title reads as an article name, not "Article Name | Big Publisher".
_TITLE_SEPARATORS = re.compile(r"\s*[|–—-]\s*")


async def fetch_real_title(url: str) -> str | None:
    """Fetch a page's actual <title> so the UI can show what's really there
    instead of the title the planning LLM imagined before any retrieval
    happened. Best-effort: a slow/blocking/non-HTML response just means the
    caller keeps whatever title it already had.
    """
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; BeginablAI-LinkCheck/1.0)"},
            )
            if resp.status_code != 200:
                return None
            content_type = resp.headers.get("content-type", "")
            if "html" not in content_type:
                return None
            match = _TITLE_RE.search(resp.text[:20000])
            if not match:
                return None
            title = html.unescape(match.group(1))
            title = _WHITESPACE_RE.sub(" ", title).strip()
            # Keep only the first segment before a " | Site Name" / " — Site Name"
            # style suffix, when there's a real segment left to keep.
            parts = _TITLE_SEPARATORS.split(title)
            if len(parts) > 1 and len(parts[0]) >= 12:
                title = parts[0].strip()
            return title[:200] if title else None
    except Exception as exc:
        logger.warning("Real-title fetch failed for %r: %s", url, exc)
        return None

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
    ("centre for policy research", "cprindia.org"),
    ("cpr india",         "cprindia.org"),
    ("orf",               "orfonline.org"),
    ("observer research", "orfonline.org"),
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


async def _resolve_via_wikipedia(query: str) -> tuple[str, str] | None:
    """Use the MediaWiki Action API to get the direct article URL AND its real
    title — returned together because the article page itself blocks a plain
    httpx fetch with "Please respect our robot policy" (Wikimedia's anti-bot
    wall applies even to a correctly-identified User-Agent on the article page
    itself, just not on this API), so re-fetching the page to read its <title>
    would silently fail. The API response already has the real, correctly
    cased title — use it directly instead.
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
                headers={"User-Agent": "BeginablAI-AI-Learning-Platform/1.0 (https://beginablai.ai)"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            results = data.get("query", {}).get("search", [])
            if results:
                title = results[0]["title"]
                url_title = title.replace(" ", "_")
                url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(url_title, safe='_:/')}"
                return url, title
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
    resources are resolved in sequence during plan enrichment. One retry with
    a longer backoff follows a failed attempt — DDG's unofficial search rate-
    limits aggressively, and without this a single transient block trips the
    enrichment circuit breaker and silently reverts every remaining article in
    the plan (even ones from well-mapped sources like Investopedia) to a bare
    search-results page instead of a real article.
    """
    await asyncio.sleep(0.6)
    search_q = f"site:{domain} {query}" if domain else query
    result = await asyncio.to_thread(_ddg_search_sync, search_q)
    if result:
        return result
    await asyncio.sleep(2.0)
    return await asyncio.to_thread(_ddg_search_sync, search_q)


async def resolve_article_url(query: str, source: str) -> tuple[str, str | None] | None:
    """Return (direct article URL, known real title or None) for the given
    query + source name. The title is only populated when the resolution path
    itself surfaced a verified real title (currently: Wikipedia's search API);
    for the DDG path the caller separately tries fetch_real_title, since many
    DDG-found sites don't run the kind of bot walls that block that.

    Returns None if no real URL could be found — callers should fall back to a
    site-specific search page (already set by _build_article_url in plan_generator).
    """
    source_lower = source.lower().strip()

    # Wikipedia has an official REST API — prefer it over DDG for reliability.
    if "wikipedia" in source_lower:
        result = await _resolve_via_wikipedia(query)
        if result:
            return result

    domain = _get_domain(source)
    url = await _resolve_via_ddg(query, domain)
    return (url, None) if url else None
