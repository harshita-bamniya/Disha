"""
SMS provider abstraction.

In 'local' / 'development' environments the OTP is printed to the console
(and returned in the API response for dev tooling). In production, this
module dispatches to MSG91.

To swap providers: implement a class with a `send(phone, otp)` method and
update `get_provider()` below. Nothing else needs to change.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SMSProvider(ABC):
    @abstractmethod
    async def send(self, phone: str, otp: str) -> None: ...


class ConsoleSMSProvider(SMSProvider):
    """Console-only provider for local/test environments."""

    async def send(self, phone: str, otp: str) -> None:
        logger.info("=" * 50)
        logger.info("[SMS CONSOLE] OTP for %s: %s", phone, otp)
        logger.info("=" * 50)


class MSG91SMSProvider(SMSProvider):
    """MSG91 OTP API v5."""

    API_URL = "https://api.msg91.com/api/v5/otp"

    async def send(self, phone: str, otp: str) -> None:
        if not settings.msg91_api_key:
            raise RuntimeError(
                "MSG91_API_KEY is not set. Cannot send SMS in production. "
                "Add it to your .env file."
            )
        if not settings.msg91_template_id:
            raise RuntimeError(
                "MSG91_TEMPLATE_ID is not set. Cannot send SMS in production."
            )

        # MSG91 expects phone in international format without '+'
        normalized = phone.lstrip("+")
        if not normalized.startswith("91") and len(normalized) == 10:
            normalized = "91" + normalized

        payload = {
            "authkey": settings.msg91_api_key,
            "mobile": normalized,
            "otp": otp,
            "template_id": settings.msg91_template_id,
            "sender": settings.msg91_sender_id,
            "otp_expiry": 10,  # minutes
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(self.API_URL, json=payload)

        if resp.status_code != 200:
            logger.error("[SMS] MSG91 error %s: %s", resp.status_code, resp.text)
            raise RuntimeError(f"SMS delivery failed (HTTP {resp.status_code}). Check MSG91 logs.")

        data = resp.json()
        if data.get("type") == "error":
            logger.error("[SMS] MSG91 API error: %s", data)
            raise RuntimeError(f"SMS delivery failed: {data.get('message', 'Unknown error')}")

        logger.info("[SMS] OTP sent to %s via MSG91", phone)


def get_sms_provider() -> SMSProvider:
    if settings.environment in ("local", "test", "development"):
        return ConsoleSMSProvider()
    return MSG91SMSProvider()


async def send_otp_sms(phone: str, otp: str) -> None:
    """Send OTP SMS. Raises on failure so callers can handle the error."""
    provider = get_sms_provider()
    await provider.send(phone, otp)
