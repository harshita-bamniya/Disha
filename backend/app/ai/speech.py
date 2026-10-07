"""Server-side speech for the AI interview.

Speech-to-text: Groq Whisper first (we already hold a Groq key), Gemini audio
input as the fallback. Text-to-speech: Gemini TTS. Both work for English,
Hindi and Hinglish. If no key is configured the interview falls back to the
browser's own speech recognition/synthesis, so none of this is required to run.

Model names come from config (app.config) so a vendor rename is an .env change.
"""
from __future__ import annotations

import base64
import io
import logging
import re
import wave
from dataclasses import dataclass
from typing import Sequence

import httpx

from app.ai.language import LANGUAGES, normalize
from app.ai.providers.groq import RateLimitedError
from app.config import get_settings

logger = logging.getLogger(__name__)

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

_EXTENSIONS = {
    "audio/webm": "webm", "video/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac",
}


class SpeechUnavailable(RuntimeError):
    """No speech provider is configured, or every configured one failed."""


@dataclass(frozen=True)
class Transcript:
    text: str
    provider: str
    model: str


@dataclass(frozen=True)
class Speech:
    audio: bytes
    content_type: str
    provider: str
    model: str


def base_content_type(content_type: str | None) -> str:
    return (content_type or "audio/webm").split(";")[0].strip().lower()


def stt_provider() -> str | None:
    s = get_settings()
    if s.groq_api_key:
        return "groq"
    if s.gemini_api_key:
        return "gemini"
    return None


def tts_available() -> bool:
    return bool(get_settings().gemini_api_key)


def capabilities() -> dict:
    s = get_settings()
    return {
        "server_stt": stt_provider() is not None,
        "server_tts": tts_available(),
        "max_audio_mb": s.interview_max_audio_mb,
        "tts_max_chars": s.interview_tts_max_chars,
    }


def build_stt_prompt(language: str, keyterms: Sequence[str] = ()) -> str:
    prompt = LANGUAGES[normalize(language)]["stt_prompt"]
    terms = [t.strip() for t in keyterms if t and t.strip()][:12]
    if terms:
        prompt += " Terms that may come up: " + ", ".join(terms) + "."
    return prompt[:400]


async def _transcribe_groq(audio: bytes, content_type: str, language: str, keyterms: Sequence[str]) -> Transcript:
    s = get_settings()
    base_ct = base_content_type(content_type)
    data = {
        "model": s.interview_stt_groq_model,
        "response_format": "json",
        "temperature": "0",
        "prompt": build_stt_prompt(language, keyterms),
    }
    hint = LANGUAGES[normalize(language)]["whisper"]
    if hint:
        data["language"] = hint
    files = {"file": (f"answer.{_EXTENSIONS.get(base_ct, 'webm')}", audio, base_ct)}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_STT_URL, headers={"Authorization": f"Bearer {s.groq_api_key}"}, data=data, files=files
        )
    if resp.status_code == 429:
        raise RateLimitedError("Groq speech-to-text rate limit reached.")
    resp.raise_for_status()
    return Transcript(text=(resp.json().get("text") or "").strip(), provider="groq", model=s.interview_stt_groq_model)


async def _transcribe_gemini(audio: bytes, content_type: str, language: str) -> Transcript:
    s = get_settings()
    model = s.interview_stt_gemini_model or s.gemini_model
    instruction = (
        "Transcribe this audio verbatim. Output only the transcript text, in the language(s) and script the "
        "speaker used. If they mix Hindi and English, keep the mix. If there is no speech, output nothing."
    )
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": base_content_type(content_type), "data": base64.b64encode(audio).decode()}},
            {"text": instruction},
        ]}],
        "generationConfig": {"temperature": 0},
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{GEMINI_API_BASE}/{model}:generateContent",
            headers={"x-goog-api-key": s.gemini_api_key, "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code == 429:
        raise RateLimitedError("Gemini rate limit or quota reached.")
    resp.raise_for_status()
    candidates = resp.json().get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts") if candidates else None) or []
    return Transcript(text="".join(p.get("text", "") for p in parts).strip(), provider="gemini", model=model)


async def transcribe(
    audio: bytes, content_type: str, language: str = "en", keyterms: Sequence[str] = ()
) -> Transcript:
    """Speech to text. Tries Groq Whisper, then Gemini. Raises SpeechUnavailable
    if neither is configured or both fail."""
    s = get_settings()
    errors: list[str] = []
    if s.groq_api_key:
        try:
            return await _transcribe_groq(audio, content_type, language, keyterms)
        except Exception as exc:
            logger.warning("[SPEECH] Groq transcription failed: %s", exc)
            errors.append(f"groq: {exc}")
    if s.gemini_api_key:
        try:
            return await _transcribe_gemini(audio, content_type, language)
        except Exception as exc:
            logger.warning("[SPEECH] Gemini transcription failed: %s", exc)
            errors.append(f"gemini: {exc}")
    raise SpeechUnavailable("; ".join(errors) or "No speech-to-text provider is configured.")


def pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap raw 16-bit mono PCM (what Gemini TTS returns) in a WAV container so
    any browser can play it."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def _sample_rate(mime_type: str | None, default: int = 24000) -> int:
    match = re.search(r"rate=(\d+)", mime_type or "")
    return int(match.group(1)) if match else default


async def _synthesize_with(model: str, text: str) -> Speech:
    s = get_settings()
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": s.interview_tts_voice}}},
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{GEMINI_API_BASE}/{model}:generateContent",
            headers={"x-goog-api-key": s.gemini_api_key, "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code == 429:
        raise RateLimitedError("Gemini rate limit or quota reached.")
    resp.raise_for_status()
    candidates = resp.json().get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts") if candidates else None) or []
    inline = next((p.get("inlineData") or p.get("inline_data") for p in parts if p.get("inlineData") or p.get("inline_data")), None)
    if not inline or not inline.get("data"):
        raise SpeechUnavailable("Text-to-speech returned no audio.")
    pcm = base64.b64decode(inline["data"])
    rate = _sample_rate(inline.get("mimeType") or inline.get("mime_type"))
    return Speech(audio=pcm_to_wav(pcm, rate), content_type="audio/wav", provider="gemini", model=model)


async def synthesize(text: str, language: str = "en") -> Speech:
    """Text to speech via Gemini TTS. Tries the configured models in order (each has its own
    quota), so one model's rate limit does not drop the interview to the browser voice.
    Raises SpeechUnavailable only when every model failed (the caller falls back to the browser voice)."""
    s = get_settings()
    if not s.gemini_api_key:
        raise SpeechUnavailable("No text-to-speech provider is configured.")
    models = [s.interview_tts_gemini_model] + [
        m.strip() for m in s.interview_tts_gemini_fallback_models.split(",") if m.strip()
    ]
    errors: list[str] = []
    for model in dict.fromkeys(models):
        try:
            return await _synthesize_with(model, text)
        except Exception as exc:
            logger.warning("[SPEECH] TTS model %s failed: %s", model, exc)
            errors.append(f"{model}: {exc}")
    raise SpeechUnavailable("; ".join(errors))
