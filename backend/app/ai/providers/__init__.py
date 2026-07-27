"""LLM provider factory with automatic fallback."""
from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class FallbackProvider:
    """Wraps a primary LLM provider with an automatic fallback on 5xx errors.

    If the primary provider raises an httpx.HTTPStatusError with status >= 500,
    the call is retried once on the fallback provider. All other errors propagate.
    """

    def __init__(self, primary, fallback):
        self._primary = primary
        self._fallback = fallback

    async def complete(self, system: str, messages: list[dict], **kwargs):
        try:
            return await self._primary.complete(system, messages, **kwargs)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                logger.warning(
                    "[LLM_FALLBACK] Primary provider %s returned %s — falling back to %s",
                    type(self._primary).__name__,
                    exc.response.status_code,
                    type(self._fallback).__name__,
                )
                return await self._fallback.complete(system, messages, **kwargs)
            raise

    async def stream(self, system: str, messages: list[dict], **kwargs) -> AsyncIterator[str]:
        try:
            async for token in self._primary.stream(system, messages, **kwargs):
                yield token
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                logger.warning(
                    "[LLM_FALLBACK] Primary stream %s returned %s — falling back to %s",
                    type(self._primary).__name__,
                    exc.response.status_code,
                    type(self._fallback).__name__,
                )
                async for token in self._fallback.stream(system, messages, **kwargs):
                    yield token
            else:
                raise


def create_provider(model: str | None = None):
    """Return a GroqProvider, automatically wrapping with Anthropic fallback
    if ANTHROPIC_API_KEY is configured."""
    from app.ai.providers.groq import GroqProvider
    from app.ai.providers.anthropic import AnthropicProvider

    settings = get_settings()
    primary = GroqProvider(model) if model else GroqProvider()

    if settings.anthropic_api_key:
        fallback = AnthropicProvider()
        return FallbackProvider(primary, fallback)

    return primary
