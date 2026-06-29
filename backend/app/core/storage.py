"""Local-disk file storage for document uploads (employer KYC, etc.).

Swap this module for an S3/GCS-backed implementation in production — callers
only depend on save_upload()/get_path(), not the underlying mechanism.
"""
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent.parent / settings.upload_dir

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB, matches LimitRequestSizeMiddleware upload override


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

    target_dir = BASE_DIR / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "document").name
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    dest = target_dir / stored_name
    dest.write_bytes(contents)

    return f"{subdir}/{stored_name}", file.filename or stored_name


def get_path(file_url: str) -> Path:
    return BASE_DIR / file_url
