"""Referral emails. Every user-supplied string is HTML-escaped; links are built by the caller."""
from __future__ import annotations

from html import escape

from app.core.notifications import _wrap, notify

_BTN = ("display:inline-block;background:#1A2744;color:#fff;padding:11px 22px;"
        "border-radius:8px;text-decoration:none;font-weight:bold;")


def send(to: str | None, subject: str, html: str) -> None:
    """Single dispatch point (tests replace this so nothing leaves the process)."""
    notify(to, subject, html)


def referrer_invite_email(company: str, name: str, portal_url: str, bonus_text: str | None) -> tuple[str, str]:
    bonus = f"<p>Referral bonus for a successful hire: <strong>{escape(bonus_text)}</strong>.</p>" if bonus_text else ""
    return f"{company} invites you to refer candidates", _wrap(
        "Refer people you know",
        f"""
        <p>Hi {escape(name)},</p>
        <p><strong>{escape(company)}</strong> has added you to its employee referral program on BeginablAI.
        You get a personal page with a share link for every open role and live status of everyone you refer.</p>
        {bonus}
        <p><a href="{portal_url}" style="{_BTN}">Open my referral page</a></p>
        <p style="color:#6B7280;font-size:12px;">This link is private to you; don't forward it. If the button doesn't work, copy this address:<br>
        <span style="word-break:break-all;">{portal_url}</span></p>
        """,
    )


def nomination_email(candidate: str | None, referrer: str, company: str, job_title: str, url: str, note: str | None) -> tuple[str, str]:
    why = f'<p style="border-left:3px solid #D1D5DB;padding-left:12px;color:#374151;">{escape(note)}</p>' if note else ""
    return f"{referrer} referred you for {job_title} at {company}", _wrap(
        "You've been referred",
        f"""
        <p>Hi {escape(candidate or 'there')},</p>
        <p><strong>{escape(referrer)}</strong> from <strong>{escape(company)}</strong> thinks you'd be a great fit for
        <strong>{escape(job_title)}</strong> and recommended you.</p>
        {why}
        <p><a href="{url}" style="{_BTN}">View the role and apply</a></p>
        <p style="color:#6B7280;font-size:12px;">You're under no obligation to apply. If you weren't expecting this, you can ignore this email.</p>
        """,
    )


def referral_update_email(referrer: str, headline: str, detail: str, link: str | None) -> tuple[str, str]:
    button = f'<p><a href="{link}" style="{_BTN}">See my referrals</a></p>' if link else ""
    return headline, _wrap(headline, f"<p>Hi {escape(referrer)},</p><p>{detail}</p>{button}")
