"""
Email provider abstraction.

In 'local' / 'development' environments emails are printed to the console
instead of sent. In production, this module sends via Brevo's SMTP relay
(free tier: 300 emails/day, no credit card required — https://brevo.com).

To swap providers: implement a class with a `send(to, subject, html)` method
and update `get_email_provider()` below. Nothing else needs to change.
"""
from __future__ import annotations

import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# (filename, content, mime_subtype) — content is str for text attachments
# (mime_subtype e.g. "calendar" for .ics) or raw bytes for binary ones
# (mime_subtype "pdf" for offer letters).
Attachment = tuple[str, "str | bytes", str]


class EmailProvider(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, html: str, attachment: Attachment | None = None) -> None: ...


class ConsoleEmailProvider(EmailProvider):
    """Console-only provider for local/test environments."""

    async def send(self, to: str, subject: str, html: str, attachment: Attachment | None = None) -> None:
        logger.info("=" * 60)
        logger.info("[EMAIL CONSOLE] To: %s | Subject: %s", to, subject)
        logger.info(html)
        if attachment:
            logger.info("[EMAIL CONSOLE] Attachment: %s", attachment[0])
        logger.info("=" * 60)


class BrevoSMTPProvider(EmailProvider):
    """Sends via Brevo's SMTP relay. Runs the blocking smtplib call in a
    thread so it doesn't block the asyncio event loop."""

    async def send(self, to: str, subject: str, html: str, attachment: Attachment | None = None) -> None:
        if not settings.brevo_smtp_login or not settings.brevo_smtp_key:
            raise RuntimeError(
                "BREVO_SMTP_LOGIN / BREVO_SMTP_KEY are not set. Cannot send email in production. "
                "Sign up at https://brevo.com, create an SMTP key, and add both to your .env file."
            )

        msg = MIMEMultipart("mixed" if attachment else "alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.email_from_name} <{settings.email_from_address}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        if attachment:
            filename, content, subtype = attachment
            if subtype == "pdf":
                from email.mime.application import MIMEApplication
                payload = content if isinstance(content, bytes) else content.encode("latin1")
                part = MIMEApplication(payload, _subtype="pdf")
            else:
                part = MIMEBase("text", subtype)
                part.set_payload(content, "utf-8")
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

        import asyncio
        await asyncio.to_thread(self._send_sync, to, msg)

    def _send_sync(self, to: str, msg: MIMEMultipart) -> None:
        with smtplib.SMTP(settings.brevo_smtp_host, settings.brevo_smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.brevo_smtp_login, settings.brevo_smtp_key)
            server.sendmail(settings.email_from_address, [to], msg.as_string())
        logger.info("[EMAIL] Sent to %s via Brevo", to)


def get_email_provider() -> EmailProvider:
    # Use Brevo whenever real credentials are configured, regardless of
    # environment — lets you test real sending locally without flipping the
    # whole app to "production" mode (which would also affect CORS, debug
    # logging, Sentry, etc.). Falls back to console-only if unconfigured.
    if settings.brevo_smtp_login and settings.brevo_smtp_key:
        return BrevoSMTPProvider()
    return ConsoleEmailProvider()


async def send_email(to: str, subject: str, html: str, attachment: Attachment | None = None) -> None:
    """Send an email. Swallows and logs failures — email delivery should
    never break the calling request (e.g. a job application shouldn't fail
    just because a notification email didn't go out)."""
    try:
        provider = get_email_provider()
        await provider.send(to, subject, html, attachment)
    except Exception as exc:
        logger.error("[EMAIL] Failed to send to %s: %s", to, exc)
