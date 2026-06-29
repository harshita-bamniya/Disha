"""
Google reCAPTCHA v3 verification.

In 'local' / 'development' environments, or whenever RECAPTCHA_SECRET_KEY is
unset, verification is skipped entirely (same graceful-degradation pattern as
app/core/sms.py and app/core/email.py) — lets you develop and test the full
auth flow without a real Google account. Once a secret key is configured,
every register/login/forgot-password call is verified for real.
"""
from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
MIN_SCORE = 0.5  # reCAPTCHA v3 returns 0.0 (bot) - 1.0 (human); below this is rejected


async def verify_recaptcha(token: str | None, expected_action: str) -> None:
    """Raises ValueError if the token is missing/invalid/low-score.
    No-ops (does nothing) if RECAPTCHA_SECRET_KEY is not configured."""
    if not settings.recaptcha_secret_key:
        return

    if not token:
        raise ValueError("CAPTCHA verification is required.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(VERIFY_URL, data={
            "secret": settings.recaptcha_secret_key,
            "response": token,
        })

    if resp.status_code != 200:
        logger.error("[CAPTCHA] siteverify HTTP %s: %s", resp.status_code, resp.text)
        raise ValueError("Could not verify CAPTCHA. Please try again.")

    data = resp.json()
    if not data.get("success"):
        logger.warning("[CAPTCHA] verification failed: %s", data.get("error-codes"))
        raise ValueError("CAPTCHA verification failed. Please try again.")

    if data.get("action") != expected_action:
        logger.warning("[CAPTCHA] action mismatch: expected=%s got=%s", expected_action, data.get("action"))
        raise ValueError("CAPTCHA verification failed. Please try again.")

    score = data.get("score", 0)
    if score < MIN_SCORE:
        logger.warning("[CAPTCHA] low score=%s for action=%s", score, expected_action)
        raise ValueError("CAPTCHA verification failed. Please try again.")
