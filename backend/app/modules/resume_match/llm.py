"""Structured-output LLM helper for match scoring (Gemini, enforced JSON schema)."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.ai import llm_usage as usage
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.groq import RateLimitedError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_DROP_KEYS = {"title", "default", "additionalProperties", "description", "examples"}


def gemini_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Convert a pydantic model into the OpenAPI-subset schema Gemini accepts."""
    schema = model.model_json_schema()
    defs = schema.get("$defs", {})

    def convert(node: Any) -> Any:
        if isinstance(node, list):
            return [convert(n) for n in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return convert(defs[node["$ref"].split("/")[-1]])
        if "anyOf" in node:  # Optional[X] -> X with nullable
            options = [o for o in node["anyOf"] if o.get("type") != "null"]
            out = convert(options[0]) if options else {"type": "STRING"}
            out["nullable"] = True
            return out
        out = {}
        for key, val in node.items():
            if key in _DROP_KEYS or key == "$defs":
                continue
            if key == "type":
                out["type"] = str(val).upper()
            elif key == "properties":
                out["properties"] = {k: convert(v) for k, v in val.items()}
                # Every field is required from the model (pydantic defaults only matter on our side);
                # otherwise the model tends to emit just the first field and stop.
                out["required"] = list(val)
                out["propertyOrdering"] = list(val)
            elif key == "required":
                continue
            else:
                out[key] = convert(val)
        return out

    return convert(schema)


async def complete_structured(
    system: str,
    user: str,
    model_cls: type[T],
    *,
    max_tokens: int = 4000,
    temperature: float = 0.0,
) -> T:
    """One schema-constrained call, validated into `model_cls`.

    Retries once on a malformed/invalid response and once after a short wait on a
    rate limit; anything else propagates so the caller can show a clear error.
    """
    provider = GeminiProvider()
    schema = gemini_schema(model_cls)
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            msg = await provider.complete(
                system, [{"role": "user", "content": user}],
                max_tokens=max_tokens, temperature=temperature, json_schema=schema,
            )
            logger.info("[RESUME_MATCH_LLM] model=%s in=%s out=%s", msg.model, msg.input_tokens, msg.output_tokens)
            usage.record_message("resume_match", msg)
            return model_cls.model_validate(json.loads(msg.content))
        except RateLimitedError as exc:
            last_exc = exc
            await asyncio.sleep(4 * (attempt + 1))
        except (json.JSONDecodeError, ValidationError) as exc:
            last_exc = exc
            logger.warning("[RESUME_MATCH_LLM] invalid structured output (attempt %d): %s", attempt + 1, exc)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500:
                raise
            last_exc = exc
            await asyncio.sleep(2)
    assert last_exc is not None
    raise last_exc
