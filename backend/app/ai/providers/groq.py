"""Groq AI provider — supports complete() and stream()."""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

MAX_RETRIES = 3
# Only worth retrying within a request's lifetime — a short per-minute throttle.
# Groq's Retry-After can also report minutes/hours when a DAILY quota is exhausted;
# blocking the request for that long looks identical to a hang from the caller's
# side, so past this threshold we fail fast with a clear error instead.
MAX_RETRY_WAIT_SECONDS = 15.0


class RateLimitedError(RuntimeError):
    """Raised when Groq returns 429 (rate-limited or out of quota)."""


def _retry_after_seconds(resp: httpx.Response, attempt: int) -> float:
    header = resp.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    return min(2 ** attempt, 20)  # exponential backoff fallback: 1s, 2s, 4s...


@dataclass
class AIMessage:
    content: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class GroqProvider:
    """Thin async wrapper around the Groq API."""

    def __init__(self, model: str = DEFAULT_MODEL):
        self.model = model
        self.settings = get_settings()

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.settings.groq_api_key}",
            "Content-Type": "application/json",
        }

    def _build_messages(self, system: str, messages: list[dict]) -> list[dict]:
        return [{"role": "system", "content": system}, *messages]

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1500,
        temperature: float = 0.7,
    ) -> AIMessage:
        if not self.settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured.")

        payload = {
            "model": self.model,
            "messages": self._build_messages(system, messages),
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            for attempt in range(MAX_RETRIES + 1):
                resp = await client.post(GROQ_API_URL, headers=self._headers(), json=payload)
                if resp.status_code != 429:
                    resp.raise_for_status()
                    break

                wait_s = _retry_after_seconds(resp, attempt)
                if wait_s > MAX_RETRY_WAIT_SECONDS:
                    # Long wait = quota exhausted (daily/hourly), not a brief throttle.
                    # Don't hang the request — fail fast with a clear, honest message.
                    minutes = round(wait_s / 60)
                    raise RateLimitedError(
                        f"Groq API quota exhausted — try again in about {minutes} minute(s)."
                        if minutes >= 1
                        else "Groq API rate limit reached. Please wait a moment and try again."
                    )
                if attempt == MAX_RETRIES:
                    raise RateLimitedError(
                        "Groq API rate limit reached. Please wait a minute and try again."
                    )
                logger.warning("Groq 429 — retrying in %.1fs (attempt %d/%d)", wait_s, attempt + 1, MAX_RETRIES)
                await asyncio.sleep(wait_s)
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return AIMessage(
            content=content,
            model=data.get("model", self.model),
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
        )

    async def stream(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1500,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        if not self.settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured.")

        payload = {
            "model": self.model,
            "messages": self._build_messages(system, messages),
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            # Retry 429s same as complete() — a brief per-minute throttle shouldn't
            # surface as a broken response. We can only retry before any bytes have
            # been streamed to the caller, so the loop lives outside the yielding part.
            for attempt in range(MAX_RETRIES + 1):
                async with client.stream(
                    "POST", GROQ_API_URL, headers=self._headers(), json=payload,
                ) as response:
                    if response.status_code != 429:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
                        return

                    wait_s = _retry_after_seconds(response, attempt)

                if wait_s > MAX_RETRY_WAIT_SECONDS:
                    minutes = round(wait_s / 60)
                    raise RateLimitedError(
                        f"Groq API quota exhausted — try again in about {minutes} minute(s)."
                        if minutes >= 1
                        else "Groq API rate limit reached. Please wait a moment and try again."
                    )
                if attempt == MAX_RETRIES:
                    raise RateLimitedError(
                        "Groq API rate limit reached. Please wait a minute and try again."
                    )
                logger.warning("Groq 429 (stream) — retrying in %.1fs (attempt %d/%d)", wait_s, attempt + 1, MAX_RETRIES)
                await asyncio.sleep(wait_s)
