"""Unit tests for the LLM provider fallback logic.

Run with: pytest tests/test_ai_providers.py -v
"""
from __future__ import annotations

import httpx
import pytest

from app.ai.providers import FallbackProvider
from app.ai.providers.groq import RateLimitedError


def _http_status_error(status_code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


class TestShouldFallback:
    def test_falls_back_on_rate_limited_error(self):
        fp = FallbackProvider(primary=object(), fallback=object())
        assert fp._should_fallback(RateLimitedError("quota exhausted")) is True

    def test_falls_back_on_5xx(self):
        fp = FallbackProvider(primary=object(), fallback=object())
        assert fp._should_fallback(_http_status_error(503)) is True

    def test_falls_back_on_413_payload_too_large(self):
        # Reproduced live 2026-08-25 running a full plan generation against
        # this environment's Groq key — a large max_tokens request can 413,
        # and that's not a 5xx, so this case used to fall straight through
        # to the caller even with a fully configured Anthropic fallback.
        fp = FallbackProvider(primary=object(), fallback=object())
        assert fp._should_fallback(_http_status_error(413)) is True

    def test_does_not_fall_back_on_4xx_other_than_413(self):
        fp = FallbackProvider(primary=object(), fallback=object())
        assert fp._should_fallback(_http_status_error(400)) is False
        assert fp._should_fallback(_http_status_error(401)) is False

    def test_does_not_fall_back_on_unrelated_exception(self):
        fp = FallbackProvider(primary=object(), fallback=object())
        assert fp._should_fallback(ValueError("unrelated")) is False

    @pytest.mark.asyncio
    async def test_complete_falls_back_end_to_end_on_413(self):
        class Primary:
            async def complete(self, system, messages, **kwargs):
                raise _http_status_error(413)

        class Fallback:
            async def complete(self, system, messages, **kwargs):
                return "fallback response"

        fp = FallbackProvider(primary=Primary(), fallback=Fallback())
        result = await fp.complete("sys", [{"role": "user", "content": "hi"}])
        assert result == "fallback response"
