"""Real YouTube video search — no API key required.

Uses yt-dlp's search-extractor (`ytsearchN:`) to pull real video metadata
(title, channel, duration, thumbnail) so learning-plan resources point at
actual videos instead of LLM-hallucinated search-result links.
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


def _search_sync(query: str, n: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    try:
        with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
            info = ydl.extract_info(f"ytsearch{n}:{query}", download=False)
            for entry in (info or {}).get("entries", []) or []:
                if not entry or not entry.get("id"):
                    continue
                thumbnails = entry.get("thumbnails") or []
                thumb = thumbnails[-1]["url"] if thumbnails else f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
                duration = entry.get("duration") or 0
                results.append({
                    "video_id": entry["id"],
                    "title": entry.get("title") or "Untitled",
                    "channel": entry.get("channel") or entry.get("uploader") or "Unknown channel",
                    "duration_minutes": max(1, round(duration / 60)) if duration else 0,
                    "thumbnail_url": thumb,
                    "url": f"https://www.youtube.com/watch?v={entry['id']}",
                })
    except Exception as exc:
        logger.warning("YouTube search failed for query %r: %s", query, exc)
    return results


async def search_youtube(query: str, n: int = 2) -> list[dict[str, Any]]:
    """Search YouTube and return up to `n` real video candidates for `query`."""
    return await asyncio.to_thread(_search_sync, query, n)
