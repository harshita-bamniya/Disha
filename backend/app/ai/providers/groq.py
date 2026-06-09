"""Groq AI provider — supports complete() and stream()."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


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
            resp = await client.post(GROQ_API_URL, headers=self._headers(), json=payload)
            resp.raise_for_status()
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
            async with client.stream(
                "POST",
                GROQ_API_URL,
                headers=self._headers(),
                json=payload,
            ) as response:
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
