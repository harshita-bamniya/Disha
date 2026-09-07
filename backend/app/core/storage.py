"""Local-disk file storage for document uploads (employer KYC, etc.).

Swap this module for an S3/GCS-backed implementation in production — callers
only depend on save_upload()/get_path(), not the underlying mechanism.
"""
import io
import logging
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent.parent / settings.upload_dir

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB, matches LimitRequestSizeMiddleware upload override

# Magic-byte signatures for each allowed content type. The client-supplied
# Content-Type header is trivially spoofable (rename a .exe to .pdf), so the
# header check alone is decorative — this checks the actual file bytes.
_MAGIC_BYTES: dict[str, tuple[bytes, ...]] = {
    "application/pdf": (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
}


class VirusFoundError(ValueError):
    """Raised when ClamAV flags an upload as infected."""


def _verify_magic_bytes(content_type: str, contents: bytes) -> None:
    signatures = _MAGIC_BYTES.get(content_type, ())
    if not any(contents.startswith(sig) for sig in signatures):
        raise ValueError(
            f"File content doesn't match its declared type ({content_type}). "
            "The file may be corrupted or mislabeled."
        )


def _scan_for_viruses(contents: bytes, filename: str) -> None:
    """Scans via ClamAV if CLAMAV_HOST is configured. No-ops otherwise (logged),
    same graceful-degradation pattern as the email/SMS/reCAPTCHA integrations —
    this lets the platform run without a clamd deployment in dev/early prod,
    while still scanning for real once it's configured.

    Fails closed only on a confirmed infection. A clamd connection error fails
    open (upload proceeds, warning logged) rather than blocking all uploads
    platform-wide if the scanning daemon happens to be down — the alternative
    (fail closed on connection error) would turn a clamd outage into a
    document-upload outage, which is a worse trade for an MVP without
    dedicated on-call for clamd.
    """
    if not settings.clamav_host:
        return

    import clamd

    try:
        cd = clamd.ClamdNetworkSocket(host=settings.clamav_host, port=settings.clamav_port, timeout=15)
        result = cd.instream(io.BytesIO(contents))
    except Exception as exc:
        logger.warning("[CLAMAV] Scan unavailable for %s, allowing upload unscanned: %s", filename, exc)
        return

    status, signature = result.get("stream", ("ERROR", None))
    if status == "FOUND":
        logger.error("[CLAMAV] Infected upload blocked: %s (%s)", filename, signature)
        raise VirusFoundError(f"This file was flagged as malicious ({signature}) and was not saved.")


async def save_upload(file: UploadFile, subdir: str) -> tuple[str, str]:
    """Saves an uploaded file under BASE_DIR/subdir and returns (file_url, original_filename).

    file_url is a storage-relative path (e.g. "employer_verification/<uuid>_doc.pdf"),
    not a public URL — documents are sensitive and served via an authenticated endpoint.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Unsupported file type: {file.content_type}. Allowed: PDF, PNG, JPEG.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise ValueError("File too large. Maximum size is 10MB.")

    _verify_magic_bytes(file.content_type, contents)
    _scan_for_viruses(contents, file.filename or "document")

    target_dir = BASE_DIR / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "document").name
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    dest = target_dir / stored_name
    dest.write_bytes(contents)

    return f"{subdir}/{stored_name}", file.filename or stored_name


def get_path(file_url: str) -> Path:
    return BASE_DIR / file_url
