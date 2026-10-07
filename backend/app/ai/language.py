"""Interview languages: what the candidate can pick, and how each one is
expressed to speech-to-text, text-to-speech and the language models."""
from __future__ import annotations

from typing import Literal

InterviewLanguage = Literal["en", "hi", "hinglish"]

DEFAULT_LANGUAGE = "en"

LANGUAGES: dict[str, dict] = {
    "en": {
        "label": "English",
        "bcp47": "en-IN",          # browser speech recognition / synthesis
        "whisper": "en",           # ISO-639-1 hint for Whisper (None = auto-detect)
        "stt_prompt": "An Indian-English job interview answer.",
        "instruction": "",
    },
    "hi": {
        "label": "Hindi",
        "bcp47": "hi-IN",
        "whisper": "hi",
        "stt_prompt": "एक नौकरी के इंटरव्यू का उत्तर, हिन्दी में।",
        "instruction": (
            "LANGUAGE: Conduct this interview in Hindi, written in Devanagari script. "
            "Write all question and follow-up text in Hindi. Keep JSON keys and fixed enum values in English."
        ),
    },
    "hinglish": {
        "label": "Hinglish",
        "bcp47": "hi-IN",
        "whisper": None,           # auto-detect: candidates mix Hindi and English mid-sentence
        "stt_prompt": "Ek job interview ka answer, Hindi aur English mix mein, Roman script mein.",
        "instruction": (
            "LANGUAGE: Conduct this interview in natural Hinglish: Hindi written in Roman script, mixed with "
            "common English and professional terms, the way an Indian professional would speak. "
            "Write all question and follow-up text that way. Keep JSON keys and fixed enum values in English."
        ),
    },
}


def normalize(language: str | None) -> str:
    return language if language in LANGUAGES else DEFAULT_LANGUAGE


def instruction(language: str | None) -> str:
    return LANGUAGES[normalize(language)]["instruction"]


def feedback_instruction(language: str | None) -> str:
    """Appended to scoring/report prompts: judge content in any of the three
    languages, never the language or accent itself."""
    lang = normalize(language)
    base = (
        "The candidate may answer in English, Hindi or Hinglish, and may switch between them. "
        "Judge the substance of the answer only. Never penalise or comment on language choice, accent, "
        "pronunciation or code-switching."
    )
    if lang == "en":
        return base
    return (
        base + f" Write all feedback text (strengths, improvements, model answer, summaries, messages) in "
        f"{LANGUAGES[lang]['label']}, using {'Devanagari script' if lang == 'hi' else 'Roman script'}. "
        "Keep JSON keys and fixed enum values in English."
    )


def public_list() -> list[dict]:
    return [{"code": code, "label": v["label"], "bcp47": v["bcp47"]} for code, v in LANGUAGES.items()]
