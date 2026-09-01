"""LLM provider factory with automatic fallback."""
from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class FallbackProvider:
    """Wraps a primary LLM provider with an automatic fallback on 5xx errors,
    a rate limit, or a payload-too-large rejection.

    Audit finding (2026-08-24): this previously only caught httpx.HTTPStatusError
    with status >= 500. Groq rate limits/quota exhaustion are raised as the
    provider's own RateLimitedError (a plain RuntimeError, not an HTTPStatusError)
    specifically so callers get a clean message — but that meant this class never
    saw them, so a fully configured, working Anthropic fallback sat idle through
    every single rate-limit failure observed in testing. Now falls back on that
    too, since a 429 on one provider is exactly the situation a second, entirely
    separate provider/quota is meant to cover.

    Second finding (2026-08-25, reproduced live while testing plan generation):
    a large max_tokens request (e.g. the 8000-token job-plan generation call)
    can 413 on a token-budget-constrained key — a plain httpx.HTTPStatusError
    with status 413, which the >= 500 check above doesn't catch either. Same
    remedy applies: the request isn't malformed, it's just too big for this
    provider/tier, and a second provider is exactly the fix.
    """

    def __init__(self, primary, fallback):
        self._primary = primary
        self._fallback = fallback

    def _should_fallback(self, exc: Exception) -> bool:
        from app.ai.providers.groq import RateLimitedError
        if isinstance(exc, RateLimitedError):
            return True
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            return status >= 500 or status == 413
        return False

    async def complete(self, system: str, messages: list[dict], **kwargs):
        try:
            return await self._primary.complete(system, messages, **kwargs)
        except Exception as exc:
            if self._should_fallback(exc):
                logger.warning(
                    "[LLM_FALLBACK] Primary provider %s failed (%s) — falling back to %s",
                    type(self._primary).__name__,
                    exc,
                    type(self._fallback).__name__,
                )
                return await self._fallback.complete(system, messages, **kwargs)
            raise

    async def stream(self, system: str, messages: list[dict], **kwargs) -> AsyncIterator[str]:
        try:
            async for token in self._primary.stream(system, messages, **kwargs):
                yield token
        except Exception as exc:
            if self._should_fallback(exc):
                logger.warning(
                    "[LLM_FALLBACK] Primary stream %s failed (%s) — falling back to %s",
                    type(self._primary).__name__,
                    exc,
                    type(self._fallback).__name__,
                )
                async for token in self._fallback.stream(system, messages, **kwargs):
                    yield token
            else:
                raise


def create_provider(model: str | None = None, reasoning_effort: str | None = None):
    """Return a GroqProvider, automatically wrapping with Anthropic fallback
    if ANTHROPIC_API_KEY is configured.

    reasoning_effort only affects Groq's gpt-oss family — passed through as-is,
    Anthropic's fallback provider doesn't take it and ignores the concept entirely.
    """
    from app.ai.providers.groq import GroqProvider, DEFAULT_MODEL
    from app.ai.providers.anthropic import AnthropicProvider

    settings = get_settings()
    primary = GroqProvider(model or DEFAULT_MODEL, reasoning_effort=reasoning_effort)

    if settings.anthropic_api_key:
        fallback = AnthropicProvider()
        return FallbackProvider(primary, fallback)

    return primary
