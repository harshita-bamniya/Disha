"""Google Gemini provider — complete() with optional enforced JSON-schema output.

Used by resume–job match scoring. Unlike the Groq/Anthropic providers it can
constrain the response to a JSON schema (response_schema), so parsing steps do
not depend on prompt-and-regex JSON extraction.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.ai.providers.anthropic import AIMessage
from app.ai.providers.groq import RateLimitedError
from app.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiProvider:
    """Thin async wrapper around the Gemini generateContent API."""

    def __init__(self, model: str | None = None):
        self.settings = get_settings()
        self.model = model or self.settings.gemini_model

    @staticmethod
    def _contents(messages: list[dict]) -> list[dict]:
        return [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in messages
        ]

    async def complete(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1500,
        temperature: float = 0.7,
        json_schema: dict[str, Any] | None = None,
        json_mode: bool = False,
    ) -> AIMessage:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        gen_config: dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            # Thinking tokens would eat the output budget of a structured extraction.
            "thinkingConfig": {"thinkingBudget": 0},
        }
        if json_schema is not None:
            gen_config["responseMimeType"] = "application/json"
            gen_config["responseSchema"] = json_schema
        elif json_mode:
            # JSON syntax is enforced server-side (no schema): far fewer malformed/truncated-comma responses.
            gen_config["responseMimeType"] = "application/json"

        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": self._contents(messages),
            "generationConfig": gen_config,
        }
        url = f"{GEMINI_API_BASE}/{self.model}:generateContent"
        headers = {"x-goog-api-key": self.settings.gemini_api_key, "Content-Type": "application/json"}

        # Large structured drafts (blueprints) can legitimately take well over a minute.
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code == 429:
            raise RateLimitedError("Gemini rate limit or quota reached.")
        resp.raise_for_status()
        data = resp.json()

        candidates = data.get("candidates") or []
        parts = (candidates[0].get("content", {}).get("parts") if candidates else None) or []
        text = "".join(p.get("text", "") for p in parts)
        if not text:
            reason = candidates[0].get("finishReason") if candidates else "no candidates"
            raise RuntimeError(f"Gemini returned no content ({reason}).")
        usage = data.get("usageMetadata", {})
        return AIMessage(
            content=text,
            model=data.get("modelVersion", self.model),
            input_tokens=usage.get("promptTokenCount", 0),
            output_tokens=usage.get("candidatesTokenCount", 0),
        )
