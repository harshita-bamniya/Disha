"""Server-side voice for an interview: answer transcription and interviewer speech.

Both calls are tied to one of the caller's own active interviews, size- and
count-limited, and logged to model_runs, so they can't be used as a free
general-purpose speech API.
"""
from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai import speech
from app.ai.language import normalize
from app.ai.usage import record_speech_run
from app.config import get_settings
from app.models.interview import InterviewConsent, InterviewSession, ModelRun
from app.models.user import User
from app.modules.interview import audio_store

logger = logging.getLogger(__name__)

# Shorter than this is a click, not speech.
MIN_AUDIO_BYTES = 800


class VoiceError(Exception):
    """A request the caller can fix. `status` maps to the HTTP status code."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _active_session(session_id: str, user: User, db: Session) -> InterviewSession:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise VoiceError("Interview not found.", 404)
    if session.status not in ("scheduled", "in_progress"):
        raise VoiceError("This interview is not active.", 400)
    return session


def has_media_consent(session_id, db: Session) -> bool:
    return (
        db.query(InterviewConsent.id)
        .filter(
            InterviewConsent.session_id == session_id,
            InterviewConsent.kind == "media",
            InterviewConsent.revoked_at.is_(None),
        )
        .first()
        is not None
    )


def _keyterms(session: InterviewSession) -> list[str]:
    """Skills the interview is about; helps the recogniser with domain words."""
    return [str(s) for s in ((session.blueprint or {}).get("skills_to_assess") or [])][:12]


async def transcribe_answer(session_id: str, user: User, audio: bytes, content_type: str | None, db: Session) -> dict:
    s = get_settings()
    session = _active_session(session_id, user, db)
    if len(audio) > s.interview_max_audio_mb * 1024 * 1024:
        raise VoiceError(f"Recording is too long (limit {s.interview_max_audio_mb} MB).", 413)
    if len(audio) < MIN_AUDIO_BYTES:
        return {"text": "", "saved": False}
    if speech.stt_provider() is None:
        raise VoiceError("Server speech recognition is not configured.", 503)

    started = time.perf_counter()
    sid = str(session.id)
    try:
        result = await speech.transcribe(audio, content_type or "audio/webm", session.language or "en", _keyterms(session))
    except speech.SpeechUnavailable as exc:
        await record_speech_run(
            "stt", model=None, units_in=len(audio) // 1024, ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000), interview_id=sid, error=str(exc),
        )
        raise VoiceError("Speech recognition is temporarily unavailable. You can type your answer instead.", 503)

    await record_speech_run(
        "stt", model=f"{result.provider}:{result.model}", units_in=len(audio) // 1024, ok=True,
        latency_ms=int((time.perf_counter() - started) * 1000), interview_id=sid,
    )

    saved = False
    if has_media_consent(session.id, db):
        try:
            audio_store.save_answer_audio(sid, audio, content_type or "audio/webm")
            saved = True
        except OSError as exc:
            logger.warning("[INTERVIEW] could not store answer audio for %s: %s", sid, exc)
    return {"text": result.text, "saved": saved}


def _tts_cache_path(text: str, language: str) -> Path:
    s = get_settings()
    key = hashlib.sha256(f"{s.interview_tts_gemini_model}|{s.interview_tts_voice}|{language}|{text}".encode()).hexdigest()
    return Path(s.upload_dir) / "tts_cache" / f"{key}.wav"


async def speak(session_id: str, user: User, text: str, db: Session) -> bytes:
    """Interviewer speech as WAV bytes. Identical text is served from a disk
    cache (a greeting or repeated question costs nothing the second time)."""
    s = get_settings()
    session = _active_session(session_id, user, db)
    text = (text or "").strip()
    if not text:
        raise VoiceError("Nothing to say.", 400)
    if len(text) > s.interview_tts_max_chars:
        raise VoiceError(f"Text is too long (limit {s.interview_tts_max_chars} characters).", 413)
    if not speech.tts_available():
        raise VoiceError("Server text-to-speech is not configured.", 503)

    language = normalize(session.language)
    cache_file = _tts_cache_path(text, language)
    if cache_file.is_file():
        return cache_file.read_bytes()

    used = (
        db.query(func.count(ModelRun.id))
        .filter(ModelRun.interview_id == session.id, ModelRun.purpose == "tts")
        .scalar()
        or 0
    )
    if used >= s.interview_tts_calls_per_session:
        raise VoiceError("Voice limit reached for this interview.", 429)

    started = time.perf_counter()
    try:
        result = await speech.synthesize(text, language)
    except speech.SpeechUnavailable as exc:
        await record_speech_run(
            "tts", model=None, units_in=len(text), ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000), interview_id=str(session.id), error=str(exc),
        )
        raise VoiceError("Voice is temporarily unavailable.", 503)

    await record_speech_run(
        "tts", model=f"{result.provider}:{result.model}", units_in=len(text), ok=True,
        latency_ms=int((time.perf_counter() - started) * 1000), interview_id=str(session.id),
    )
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(result.audio)
    except OSError as exc:
        logger.warning("[INTERVIEW] TTS cache write failed: %s", exc)
    return result.audio


def _owned_session(session_id: str, user: User, db: Session) -> InterviewSession:
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id)
        .first()
    )
    if not session:
        raise VoiceError("Interview not found.", 404)
    return session


def list_audio(session_id: str, user: User, db: Session) -> list[str]:
    session = _owned_session(session_id, user, db)
    return audio_store.list_answer_audio(str(session.id))


def get_audio(session_id: str, name: str, user: User, db: Session):
    session = _owned_session(session_id, user, db)
    found = audio_store.resolve_answer_audio(str(session.id), name)
    if found is None:
        raise VoiceError("Recording not found.", 404)
    return found
