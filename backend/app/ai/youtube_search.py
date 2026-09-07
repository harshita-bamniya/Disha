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


def _search_sync(query: str, n: int, fetch: int) -> list[dict[str, Any]]:
    """Fetch `fetch` raw results, filter to educational length, return top `n`."""
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

    # Prefer videos in the educational length range; fall back to anything if none qualify
    filtered = [
        v for v in raw
        if _MIN_DURATION_SEC <= v["duration_seconds"] <= _MAX_DURATION_SEC
    ]
    chosen = filtered if filtered else raw

    # Strip internal-only field before returning
    for v in chosen:
        v.pop("duration_seconds", None)
        v.pop("view_count", None)

    return chosen[:n]


async def search_youtube(query: str, n: int = 2) -> list[dict[str, Any]]:
    """Search YouTube and return up to `n` filtered video candidates for `query`.

    Fetches 5× candidates internally so the duration filter has candidates to
    choose from without extra round-trips.
    """
    return await asyncio.to_thread(_search_sync, query, n, fetch=max(n * 5, 10))
