"""Ranked YouTube picks per skill, cached and shared across users.

Pipeline per (skill query, language, level):
  search -> enrich (stats, channel) -> hard filters -> weighted score -> LLM re-rank -> cache

Uses the YouTube Data API v3 when YOUTUBE_API_KEY is set (likes, subscribers,
publish date, caption flag). Without a key it falls back to yt-dlp search, which
only exposes views/duration/channel — scoring then re-normalises over the
signals that are actually available instead of pretending to have the rest.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.role_blueprint import SkillResource
from app.modules.recommendations import embedder

logger = logging.getLogger(__name__)

CACHE_DAYS = 30                       # YouTube API policy: refresh stored stats at least monthly
API_SEARCHES_PER_DAY = 90             # free quota is ~100 search.list calls/day
CANDIDATES = 25
MIN_VIEWS = 300               # niche professional topics (e.g. Indian law) have modest view counts; scoring handles quality
MAX_SECONDS = 4 * 3600
WEIGHTS = {"relevance": 0.35, "engagement": 0.20, "channel": 0.15, "recency": 0.10, "length": 0.10, "language": 0.10}

_YT = "https://www.googleapis.com/youtube/v3"
_ytdlp_sem = asyncio.Semaphore(2)     # yt-dlp is heavy and rate-sensitive


# ── candidate fetching ───────────────────────────────────────────────────────

def _iso_duration_seconds(iso: str) -> int:
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _quota_ok_and_use() -> bool:
    """Daily search budget in Redis (fails open if Redis is down)."""
    try:
        from app.modules.jobs.plan_router import _redis
        r = _redis()
        key = f"yt:search_quota:{datetime.now(timezone.utc):%Y%m%d}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, 90000)
        return n <= API_SEARCHES_PER_DAY
    except Exception:
        return True


async def _fetch_api(
    query: str, language: str, shelf_years: float, key: str, require_captions: bool = True, recent_only: bool = True,
) -> list[dict[str, Any]] | None:
    params: dict[str, Any] = {
        "part": "snippet", "type": "video", "q": query, "maxResults": CANDIDATES,
        "relevanceLanguage": language, "safeSearch": "strict", "videoEmbeddable": "true", "key": key,
    }
    if require_captions:
        params["videoCaption"] = "closedCaption"
    if recent_only and shelf_years <= 3:
        params["publishedAfter"] = (datetime.now(timezone.utc) - timedelta(days=365 * shelf_years)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{_YT}/search", params=params)
            r.raise_for_status()
            ids = [i["id"]["videoId"] for i in r.json().get("items", []) if i.get("id", {}).get("videoId")]
            if not ids:
                return []
            v = await client.get(f"{_YT}/videos", params={
                "part": "snippet,contentDetails,statistics", "id": ",".join(ids), "key": key,
            })
            v.raise_for_status()
            items = v.json().get("items", [])
            channel_ids = sorted({i["snippet"]["channelId"] for i in items})
            subs: dict[str, int] = {}
            if channel_ids:
                c = await client.get(f"{_YT}/channels", params={"part": "statistics", "id": ",".join(channel_ids[:50]), "key": key})
                c.raise_for_status()
                for ch in c.json().get("items", []):
                    st = ch.get("statistics", {})
                    if not st.get("hiddenSubscriberCount"):
                        subs[ch["id"]] = int(st.get("subscriberCount", 0))
    except Exception as exc:
        logger.warning("YouTube API failed for %r: %s", query, exc)
        return None

    out = []
    for i in items:
        sn, st, cd = i["snippet"], i.get("statistics", {}), i.get("contentDetails", {})
        thumbs = sn.get("thumbnails", {})
        out.append({
            "video_id": i["id"],
            "title": sn.get("title", ""),
            "description": (sn.get("description") or "")[:400],
            "channel": sn.get("channelTitle", ""),
            "channel_subscribers": subs.get(sn.get("channelId")),
            "duration_seconds": _iso_duration_seconds(cd.get("duration", "")),
            "views": int(st["viewCount"]) if "viewCount" in st else None,
            "likes": int(st["likeCount"]) if "likeCount" in st else None,
            "comments": int(st["commentCount"]) if "commentCount" in st else None,
            "published_at": sn.get("publishedAt"),
            "captions": cd.get("caption") == "true",
            "audio_language": (sn.get("defaultAudioLanguage") or sn.get("defaultLanguage") or "")[:2].lower() or None,
            "thumbnail_url": (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url"),
        })
    return out


def _fetch_ytdlp_sync(query: str) -> list[dict[str, Any]] | None:
    import yt_dlp
    from app.ai.youtube_search import _YDL_OPTS
    out = []
    try:
        with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
            info = ydl.extract_info(f"ytsearch{CANDIDATES}:{query}", download=False)
            for e in (info or {}).get("entries", []) or []:
                if not e or not e.get("id"):
                    continue
                out.append({
                    "video_id": e["id"],
                    "title": e.get("title") or "",
                    "description": (e.get("description") or "")[:400],
                    "channel": e.get("channel") or e.get("uploader") or "",
                    "channel_subscribers": e.get("channel_follower_count"),
                    "duration_seconds": int(e.get("duration") or 0),
                    "views": e.get("view_count"),
                    "likes": e.get("like_count"),
                    "comments": None,
                    "published_at": None,
                    "captions": None,
                    "audio_language": None,
                    "thumbnail_url": f"https://i.ytimg.com/vi/{e['id']}/hqdefault.jpg",
                })
    except Exception as exc:
        logger.warning("yt-dlp search failed for %r: %s", query, exc)
        return None
    return out


# Relaxation ladder for the API search: strict first, then drop captions, then drop the recency cut.
LADDER = [(True, True), (False, True), (False, False)]


async def _fetch_candidates(
    query: str, language: str, shelf_years: float, step: int = 0,
) -> tuple[list[dict[str, Any]] | None, str]:
    key = get_settings().youtube_api_key
    if key and _quota_ok_and_use():
        captions, recent = LADDER[min(step, len(LADDER) - 1)]
        res = await _fetch_api(query, language, shelf_years, key, captions, recent)
        if res is not None:
            return res, "youtube_api"
    async with _ytdlp_sem:
        return await asyncio.to_thread(_fetch_ytdlp_sync, query), "ytdlp"


# ── filtering + scoring ──────────────────────────────────────────────────────

def _is_shorts(c: dict[str, Any]) -> bool:
    return c["duration_seconds"] <= 90 or "#shorts" in (c["title"] or "").lower()


def _age_years(published_at: str | None) -> float | None:
    if not published_at:
        return None
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        return max(0.0, (datetime.now(timezone.utc) - dt).days / 365)
    except Exception:
        return None


def hard_filter(
    cands: list[dict[str, Any]], skill: dict[str, Any], query: str, language: str, check_title: bool = True,
) -> list[dict[str, Any]]:
    from app.ai.youtube_search import _is_relevant
    min_sec = 300 if skill.get("concept_type", "concept") == "concept" else 180
    shelf = float(skill.get("shelf_life_years", 5))
    keep = []
    for c in cands:
        if not c["title"] or _is_shorts(c):
            continue
        if not (min_sec <= c["duration_seconds"] <= MAX_SECONDS):
            continue
        if c["views"] is not None and c["views"] < MIN_VIEWS:
            continue
        age = _age_years(c["published_at"])
        if age is not None and age > shelf:
            continue
        # API tells us the spoken language; drop confident mismatches only.
        if c["audio_language"] and language and c["audio_language"] != language:
            continue
        if check_title and not _is_relevant(query, c["title"]):
            continue
        keep.append(c)
    return keep


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_candidates(cands: list[dict[str, Any]], skill: dict[str, Any], query: str, language: str) -> list[dict[str, Any]]:
    """Attach `score` (0-100) and `components`. Missing signals are dropped and
    the remaining weights re-normalised — never faked."""
    if not cands:
        return []
    shelf = float(skill.get("shelf_life_years", 5))
    target_min = _clamp((float(skill.get("base_hours", 6)) * 60 * 0.35) / 75) * 75
    target_min = max(15.0, target_min)
    vetted = [v.lower() for v in skill.get("vetted_channels", [])]

    skill_vec = embedder.embed(f"{skill['name']} {query}")
    vecs = embedder.embed_batch([f"{c['title']}. {c.get('description', '')[:300]}" for c in cands])

    for c, vec in zip(cands, vecs):
        comp: dict[str, float | None] = {}
        if skill_vec and vec:
            comp["relevance"] = _clamp((float(embedder.cosine_similarity(skill_vec, vec)) - 0.2) / 0.6)
        else:
            comp["relevance"] = None

        views, likes, comments = c["views"], c["likes"], c["comments"]
        if views and likes is not None:
            like_r = _clamp((likes / views) / 0.04)
            com_r = _clamp(((comments or 0) / views) / 0.004) if comments is not None else like_r
            comp["engagement"] = 0.7 * like_r + 0.3 * com_r
        elif views:
            comp["engagement"] = 0.6 * _clamp((math.log10(views) - 3) / 3)   # popularity proxy, penalised
        else:
            comp["engagement"] = None

        subs = c["channel_subscribers"]
        is_vetted = any(v in (c["channel"] or "").lower() for v in vetted)
        if subs:
            comp["channel"] = _clamp((math.log10(subs) - 3) / 4 + (0.4 if is_vetted else 0))
        elif is_vetted:
            comp["channel"] = 1.0
        else:
            comp["channel"] = None

        age = _age_years(c["published_at"])
        comp["recency"] = math.exp(-age / shelf) if age is not None else None

        dur = c["duration_seconds"] / 60
        ratio = dur / target_min
        comp["length"] = 1.0 if 0.6 <= ratio <= 1.6 else _clamp(1 - abs(math.log(max(ratio, 0.05) / (0.6 if ratio < 0.6 else 1.6))) / 1.5)

        if c["captions"] is None and not c["audio_language"]:
            comp["language"] = None
        else:
            comp["language"] = (0.5 if c["captions"] else 0.0) + (0.5 if (not c["audio_language"] or c["audio_language"] == language) else 0.0)

        avail = {k: v for k, v in comp.items() if v is not None}
        wsum = sum(WEIGHTS[k] for k in avail) or 1.0
        c["score"] = round(100 * sum(WEIGHTS[k] * v for k, v in avail.items()) / wsum, 1)
        c["components"] = {k: (round(v, 3) if v is not None else None) for k, v in comp.items()}
        c["vetted"] = is_vetted
    return sorted(cands, key=lambda x: x["score"], reverse=True)


# ── re-rank ──────────────────────────────────────────────────────────────────

def _fallback_reason(c: dict[str, Any]) -> str:
    bits = []
    if c["views"]:
        bits.append(f"{_fmt(c['views'])} views")
    if c["likes"] is not None and c["views"]:
        bits.append(f"{100 * c['likes'] / c['views']:.1f}% like ratio")
    if c["channel_subscribers"]:
        bits.append(f"{_fmt(c['channel_subscribers'])}-subscriber channel")
    if c.get("vetted"):
        bits.append("recognised educator")
    return "Top-scored match: " + ", ".join(bits) if bits else "Top-scored match for this skill."


def _fmt(n: int) -> str:
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}K" if n >= 1e3 else str(n)


RERANK_SYSTEM = (
    "You are a strict curriculum reviewer choosing tutorial videos for a job-preparation roadmap. "
    "You may only judge from the title, channel, duration, view count and description snippet you are given. "
    "Output ONLY JSON."
)


async def llm_rerank(top: list[dict[str, Any]], skill: dict[str, Any], role: str, level: str) -> list[dict[str, str]]:
    """Strict suitability gate + ranking. Returns [{video_id, reason}] (best first, max 3).

    An EMPTY list is a valid answer meaning "nothing here is good enough" — better to
    show no video than an off-topic one."""
    from app.modules.roadmap_engine.llm import complete_json
    listing = "\n".join(
        f"- id={c['video_id']} | \"{c['title']}\" | channel: {c['channel']} | {round(c['duration_seconds'] / 60)} min"
        f" | {_fmt(c['views']) + ' views' if c['views'] else 'views n/a'}"
        + (f" | desc: {c['description'][:160]}" if c.get("description") else "")
        for c in top
    )
    prompt = (
        f"Role the learner is preparing for: {role} (India)\n"
        f"Skill to learn: {skill['name']}\nWhy the role needs it: {skill.get('why_for_role', '')}\n"
        f"Learner level: {level}\n\nCandidate videos:\n{listing}\n\n"
        "Select up to 3 videos that DIRECTLY teach this skill in a way useful for this role in India, best first.\n"
        "REJECT a video if it is: off-topic; about a different profession or industry (e.g. military, accreditation, "
        "medical) even if a keyword matches; about another country's law/regulation when the skill is India-specific; "
        "a generic motivational talk; a news or opinion clip; clickbait; a competitive-exam (UPSC/SSC) question discussion or "
        "coaching class when the skill is a professional job task; or a MID-SERIES episode (e.g. 'Lesson 6', 'Part 4', "
        "'Day 12') that only makes sense inside a course, unless it is the first episode. "
        "Prefer standalone, structured, complete teaching aimed at working professionals or beginners of THIS skill. "
        "Avoid two videos from the same channel. If none are good enough, return an empty list.\n"
        "For each pick give a one-sentence reason that states ONLY what the title/channel/duration/description show "
        "(e.g. 'Full 83-min explainer of the DPDP Act 2023 from an Indian law channel'). Do not claim content you cannot see.\n"
        'Return {"picks":[{"video_id":str,"reason":str}]}'
    )
    data = await complete_json(RERANK_SYSTEM, prompt, 1500, 0.1, effort="low")
    valid = {c["video_id"] for c in top}
    seen: set[str] = set()
    picks = []
    for p in data.get("picks", []) or []:
        vid = p.get("video_id")
        if vid in valid and vid not in seen:
            seen.add(vid)
            picks.append({"video_id": vid, "reason": str(p.get("reason", ""))[:220]})
    return picks[:3]


# ── public API ───────────────────────────────────────────────────────────────

def _core_topic(name: str) -> str:
    """Short searchable topic from a long skill name: drop parentheses and trailing qualifiers."""
    base = re.split(r"[\(\u2013\u2014:]| - | per | using | for | with ", name)[0]
    words = re.findall(r"[A-Za-z0-9\u2011+#.&/-]+", base)
    return " ".join(words[:5]) or name


def _cache_key(query: str, language: str, level: str) -> str:
    return hashlib.sha256(f"{query.lower().strip()}|{language}|{level}".encode()).hexdigest()[:40]


def _video_record(c: dict[str, Any], rank: int, reason: str) -> dict[str, Any]:
    return {
        "video_id": c["video_id"], "title": c["title"], "channel": c["channel"],
        "channel_subscribers": c["channel_subscribers"],
        "duration_minutes": max(1, round(c["duration_seconds"] / 60)),
        "views": c["views"], "likes": c["likes"], "published_at": c["published_at"],
        "thumbnail_url": c["thumbnail_url"], "url": f"https://www.youtube.com/watch?v={c['video_id']}",
        "score": c["score"], "components": c["components"], "reason": reason, "rank": rank,
    }


async def get_ranked_videos(
    db: Session, skill: dict[str, Any], role: str, language: str = "en", level: str = "beginner",
) -> list[dict[str, Any]]:
    """Up to 3 ranked, LLM-vetted videos for a blueprint skill (cached; search cost paid once per key/month).

    Returns [] when nothing suitable exists — callers must show "no video yet", never a junk match."""
    queries = list(skill.get("search_queries") or [skill["name"]])
    key = _cache_key(queries[0], language, level)
    # Broader concept-level fallbacks: a niche, over-specific query often has no good tutorial at all.
    core = skill.get("core_topic") or _core_topic(skill["name"])
    queries += [f"{core} explained for beginners", f"{core} full course tutorial"]

    now = datetime.now(timezone.utc)
    row = db.query(SkillResource).filter(SkillResource.cache_key == key).first()
    if row and row.expires_at > now:
        return row.videos

    shelf = float(skill.get("shelf_life_years", 5))
    picked: list[dict[str, Any]] = []
    picked_ids: set[str] = set()
    source, seen_total, any_fetch_ok, gate_failed = "ytdlp", 0, False, False

    for q in queries[:5]:
        pool: dict[str, dict[str, Any]] = {}
        for step in range(len(LADDER)):
            cands, source = await _fetch_candidates(q, language, shelf, step)
            if cands is None:
                break
            any_fetch_ok = True
            seen_total += len(cands)
            for c in hard_filter(cands, skill, q, language, check_title=(source != "youtube_api")):
                pool.setdefault(c["video_id"], c)
            if len(pool) >= 8 or source != "youtube_api":
                break                       # good pool (or yt-dlp, which has no ladder)
        kept = [c for c in pool.values() if c["video_id"] not in picked_ids]
        if not kept:
            continue
        ranked = await asyncio.to_thread(score_candidates, kept, skill, q, language)
        top = [c for c in ranked if (c["components"].get("relevance") or 0) >= 0.25][:10]
        if not top:
            continue
        by_id = {c["video_id"]: c for c in top}
        try:
            picks = await llm_rerank(top, skill, role, level)
        except Exception as exc:
            logger.warning("Video gate failed for %r: %s", skill["name"], exc)
            gate_failed = True
            picks = [{"video_id": c["video_id"], "reason": _fallback_reason(c)} for c in top[:2] if c["score"] >= 60]
        for p in picks:
            c = by_id[p["video_id"]]
            if c["video_id"] in picked_ids:
                continue
            if any(x["channel"] == c["channel"] for x in picked):
                continue                    # variety: at most one video per channel
            picked.append({**c, "_reason": p["reason"]})
            picked_ids.add(c["video_id"])
        if len(picked) >= 2:
            break

    if not any_fetch_ok:
        return row.videos if row else []       # search unavailable: serve stale, don't cache a failure

    videos = [_video_record(c, i, c["_reason"]) for i, c in enumerate(picked[:3], 1)]
    # A gate that found nothing suitable is cached briefly so we retry soon; a failure isn't cached at all.
    if not videos and gate_failed:
        return []
    ttl = timedelta(days=CACHE_DAYS) if videos else timedelta(days=1)
    expires = now + ttl
    if row:
        row.videos, row.source, row.candidates_seen, row.fetched_at, row.expires_at = videos, source, seen_total, now, expires
    else:
        db.add(SkillResource(
            cache_key=key, skill_name=skill["name"][:200], query=queries[0][:300], language=language, level=level,
            videos=videos, source=source, candidates_seen=seen_total, expires_at=expires,
        ))
    db.commit()
    return videos
