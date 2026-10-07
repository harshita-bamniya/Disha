"""Per-call LLM usage logging for the interview engine (model_runs table).

Call sites swap `provider.complete(...)` for
`tracked_complete(provider, "purpose", ...)`. The interview a call belongs to is
carried in a ContextVar so existing function signatures don't need a new
parameter threaded through every layer.

Logging is best-effort: it uses its own short DB session and swallows every
error, so a logging problem can never break a live interview.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

logger = logging.getLogger(__name__)

_current_interview_id: ContextVar[str | None] = ContextVar("current_interview_id", default=None)


@contextmanager
def interview_context(interview_id: str | None) -> Iterator[None]:
    """Attribute every tracked LLM call inside the block to this interview."""
    token = _current_interview_id.set(str(interview_id) if interview_id else None)
    try:
        yield
    finally:
        _current_interview_id.reset(token)


def _insert_run(row: dict[str, Any]) -> None:
    from app.database import SessionLocal
    from app.models.interview import ModelRun

    db = SessionLocal()
    try:
        db.add(ModelRun(**row))
        db.commit()
    except Exception as exc:  # pragma: no cover - best effort
        db.rollback()
        logger.debug("[MODEL_RUNS] insert failed: %s", exc)
    finally:
        db.close()


async def _record(row: dict[str, Any]) -> None:
    try:
        await asyncio.to_thread(_insert_run, row)
    except Exception as exc:  # pragma: no cover - best effort
        logger.debug("[MODEL_RUNS] record failed: %s", exc)


async def tracked_complete(provider: Any, purpose: str, system: str, messages: list[dict], **kwargs: Any):
    """provider.complete() plus a model_runs row (tokens, latency, ok/error)."""
    started = time.perf_counter()
    try:
        result = await provider.complete(system, messages, **kwargs)
    except Exception as exc:
        await _record({
            "interview_id": _current_interview_id.get(),
            "purpose": purpose[:40],
            "model": getattr(provider, "model", None),
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}"[:200],
        })
        raise

    await _record({
        "interview_id": _current_interview_id.get(),
        "purpose": purpose[:40],
        "model": getattr(result, "model", None) or getattr(provider, "model", None),
        "tokens_in": int(getattr(result, "input_tokens", 0) or 0),
        "tokens_out": int(getattr(result, "output_tokens", 0) or 0),
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "ok": True,
    })
    return result



async def record_speech_run(
    purpose: str, *, model: str | None, units_in: int, ok: bool, latency_ms: int,
    interview_id: str | None = None, error: str | None = None,
) -> None:
    """Log a speech call (stt/tts) in model_runs. There are no tokens here, so
    tokens_in holds the natural unit of the call: audio size in KB for
    speech-to-text, characters for text-to-speech."""
    await _record({
        "interview_id": interview_id or _current_interview_id.get(),
        "purpose": purpose[:40],
        "model": model,
        "tokens_in": int(units_in),
        "latency_ms": latency_ms,
        "ok": ok,
        "error": (error or None) and error[:200],
    })
