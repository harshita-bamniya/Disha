"""Opt-in storage of a candidate's answer audio.

Only written when the candidate ticked "save my answer audio" (consent kind
"media"). Files live under <upload_dir>/interview_audio/<session_id>/ and are
deleted with the interview, on request, and automatically after the retention
period. Filenames are generated here, never taken from the client, and every
lookup is checked to stay inside the session's own directory.
"""
from __future__ import annotations

import logging
import shutil
import time
import uuid
from pathlib import Path

from app.ai.speech import base_content_type
from app.config import get_settings

logger = logging.getLogger(__name__)

_EXT = {
    "audio/webm": "webm", "video/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac",
}
_MEDIA_TYPE = {"webm": "audio/webm", "ogg": "audio/ogg", "m4a": "audio/mp4", "mp3": "audio/mpeg", "wav": "audio/wav", "flac": "audio/flac"}


def _root() -> Path:
    return Path(get_settings().upload_dir) / "interview_audio"


def session_dir(session_id: str) -> Path:
    # str(uuid.UUID(...)) rejects anything that isn't a plain UUID, so a crafted
    # id can't escape the audio root.
    return _root() / str(uuid.UUID(str(session_id)))


def save_answer_audio(session_id: str, audio: bytes, content_type: str) -> str:
    """Store one answer's audio; returns the generated filename."""
    ext = _EXT.get(base_content_type(content_type), "webm")
    directory = session_dir(session_id)
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}.{ext}"
    (directory / name).write_bytes(audio)
    return name


def list_answer_audio(session_id: str) -> list[str]:
    directory = session_dir(session_id)
    if not directory.is_dir():
        return []
    return sorted(p.name for p in directory.iterdir() if p.is_file())


def resolve_answer_audio(session_id: str, name: str) -> tuple[Path, str] | None:
    """Path + media type for a stored file, or None if it doesn't exist or the
    name tries to leave the session directory."""
    directory = session_dir(session_id).resolve()
    candidate = (directory / name).resolve()
    if candidate.parent != directory or not candidate.is_file():
        return None
    return candidate, _MEDIA_TYPE.get(candidate.suffix.lstrip("."), "application/octet-stream")


def delete_session_audio(session_id: str) -> None:
    try:
        shutil.rmtree(session_dir(session_id), ignore_errors=True)
    except ValueError:
        pass


def purge_older_than(days: int) -> int:
    """Delete session audio directories whose newest file is older than
    `days`. Returns how many directories were removed."""
    root = _root()
    if not root.is_dir():
        return 0
    cutoff = time.time() - days * 86400
    removed = 0
    for directory in root.iterdir():
        if not directory.is_dir():
            continue
        newest = max((p.stat().st_mtime for p in directory.iterdir() if p.is_file()), default=0.0)
        if newest < cutoff:
            shutil.rmtree(directory, ignore_errors=True)
            removed += 1
    return removed
