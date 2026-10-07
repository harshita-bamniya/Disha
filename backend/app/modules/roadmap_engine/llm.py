"""LLM calls for the roadmap engine that survive per-minute quota limits.

Blueprint drafting and re-ranking are background work, so waiting ~a minute for a
rate-limit window to reset is fine — failing the whole roadmap is not. Before
waiting, the engine fails over between providers (Groq <-> Gemini): a 429 on one
is exactly the situation a second, separate quota is for.
"""
from __future__ import annotations

import asyncio
import contextlib
import contextvars
import logging
import re
import time
from typing import Any, Iterator

import httpx

from app.ai import llm_usage as usage
from app.ai.providers.groq import RateLimitedError
from app.config import get_settings

logger = logging.getLogger(__name__)

MAX_WAITS = 3
MAX_WAIT_SECONDS = 75
TRIP_SECONDS = 300      # after every provider is confirmed exhausted, stop hammering them for this long

# Process-wide breaker: once waits are exhausted, every further call fails fast instead of
# each one spending minutes in its own retry loop (which would freeze whole roadmaps).
_tripped_until = 0.0


def quota_tripped() -> bool:
    return time.monotonic() < _tripped_until


# Lets a caller (e.g. a blueprint re-draft after a quality failure) try a specific provider first.
_prefer: contextvars.ContextVar[str | None] = contextvars.ContextVar("roadmap_llm_prefer", default=None)


@contextlib.contextmanager
def prefer(provider_name: str | None) -> Iterator[None]:
    token = _prefer.set(provider_name)
    try:
        yield
    finally:
        _prefer.reset(token)


def provider_names(tier: str = "cheap") -> list[str]:
    return [n for n, _ in _providers(None, tier)]


def _wait_from_message(msg: str) -> float:
    m = re.search(r"about (\d+) minute", msg)
    return min(MAX_WAIT_SECONDS, 60 * int(m.group(1)) + 5) if m else 30.0


def _should_fail_over(exc: Exception) -> bool:
    """Rate limits, oversize payloads (413) and server errors are provider problems, not request problems."""
    if isinstance(exc, RateLimitedError):
        return True
    # Timeouts, dropped connections and protocol errors are provider-side too (empty-message ReadTimeout
    # previously aborted whole blueprint drafts).
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        # 404/403: that model is retired or not enabled for this key — try the next one.
        return exc.response.status_code >= 500 or exc.response.status_code in (413, 403, 404)
    return False


def _providers(effort: str | None, tier: str = "cheap") -> list[tuple[str, Any]]:
    """Providers in preference order. Gemini is only included when its key is configured.

    tier="strong" (blueprint drafting, judging) uses the stronger Gemini model; "cheap" (ranking, matching,
    classification, personal lines) uses the fast default."""
    from app.ai.providers import create_provider
    from app.ai.providers.gemini import GeminiProvider

    settings = get_settings()
    # Low reasoning effort for short structured answers: a reasoning model otherwise spends the
    # whole token budget thinking and returns truncated / empty JSON.
    available: dict[str, Any] = {"groq": create_provider(reasoning_effort=effort)}
    extra_gemini: list[tuple[str, Any]] = []
    if settings.gemini_api_key:
        available["gemini"] = GeminiProvider(settings.gemini_strong_model if tier == "strong" else None)
        if tier == "strong":
            # Same key, different model => separate per-model quota (see config.gemini_strong_fallback_models).
            for m in [x.strip() for x in settings.gemini_strong_fallback_models.split(",") if x.strip()]:
                if m != settings.gemini_strong_model:
                    extra_gemini.append((f"gemini:{m}", GeminiProvider(m)))
    wanted = _prefer.get() or settings.roadmap_llm_primary
    first = wanted if wanted in available else "groq"
    ordered = [first] + [n for n in available if n != first]
    result = [(n, available[n]) for n in ordered]
    if extra_gemini:
        # Keep the extra Gemini models right after the primary Gemini entry.
        idx = next(i for i, (n, _) in enumerate(result) if n == "gemini")
        result[idx + 1:idx + 1] = extra_gemini
    return result


async def complete(
    system: str, prompt: str, max_tokens: int, temperature: float, effort: str | None = None, tier: str = "cheap",
    json_mode: bool = False,
):
    global _tripped_until
    if quota_tripped():
        raise RateLimitedError("AI provider quota exhausted — roadmap step skipped for now.")

    providers = _providers(effort, tier)
    messages = [{"role": "user", "content": prompt}]
    for attempt in range(MAX_WAITS + 1):
        last_rate_limit: RateLimitedError | None = None
        last_error: Exception | None = None
        for name, provider in providers:
            try:
                extra: dict[str, Any] = {}
                if json_mode and provider.__class__.__name__ == "GeminiProvider":
                    extra["json_mode"] = True
                msg = await provider.complete(
                    system=system, messages=messages, max_tokens=max_tokens, temperature=temperature, **extra,
                )
                usage.record_message("roadmap", msg)
                return msg
            except Exception as exc:
                if not _should_fail_over(exc):
                    raise
                if isinstance(exc, RateLimitedError):
                    last_rate_limit = exc
                last_error = exc
                logger.warning("[ROADMAP_LLM] %s unavailable (%s) — trying next provider", name, exc)
        # Every provider failed. Only rate limits are worth waiting out; other errors are final.
        if last_rate_limit is None:
            raise last_error  # type: ignore[misc]
        if attempt == MAX_WAITS:
            _tripped_until = time.monotonic() + TRIP_SECONDS
            raise last_rate_limit
        wait = _wait_from_message(str(last_rate_limit))
        logger.warning("[ROADMAP_LLM] all providers rate limited — waiting %.0fs (%d/%d)", wait, attempt + 1, MAX_WAITS)
        await asyncio.sleep(wait)
    raise RuntimeError("unreachable")


async def complete_json(
    system: str, prompt: str, max_tokens: int, temperature: float, effort: str | None = None, tier: str = "cheap",
) -> dict[str, Any]:
    """LLM call returning parsed JSON; retries once (cooler) on malformed output."""
    from app.modules.jobs.plan_generator import _extract_json
    last: Exception | None = None
    for attempt in range(2):
        msg = await complete(system, prompt, max_tokens, max(0.05, temperature - 0.15 * attempt), effort, tier, json_mode=True)
        try:
            return _extract_json(msg.content)
        except Exception as exc:
            last = exc
            logger.warning("[ROADMAP_LLM] malformed JSON (attempt %d): %s", attempt + 1, exc)
    raise RuntimeError(f"LLM did not return valid JSON: {last}")
