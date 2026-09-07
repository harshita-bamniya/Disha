"""Minimal RFC 5545 (iCalendar) event generation — no external dependency.

This is the real, standards-based way to give recruiters/candidates calendar
sync without needing a Google/Outlook OAuth integration: any calendar app
(Gmail, Outlook, Apple Calendar) understands a .ics attachment or download.
A true two-way sync (auto-updates if rescheduled) would need real OAuth with
each provider — out of scope here; this covers the "candidate/recruiter gets
a calendar entry that doesn't require manual re-typing" need.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

DEFAULT_DURATION_MINUTES = 45


def _fmt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def build_interview_ics(
    *,
    uid: str,
    summary: str,
    description: str,
    scheduled_at: datetime,
    duration_minutes: int = DEFAULT_DURATION_MINUTES,
    location: str | None = None,
    organizer_email: str | None = None,
    attendee_email: str | None = None,
) -> str:
    """Returns a complete .ics file (single VEVENT) as text."""
    dtstart = scheduled_at
    dtend = scheduled_at + timedelta(minutes=duration_minutes)
    now = datetime.now(timezone.utc)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BeginablAI//Interview Scheduling//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_fmt(now)}",
        f"DTSTART:{_fmt(dtstart)}",
        f"DTEND:{_fmt(dtend)}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
    ]
    if location:
        lines.append(f"LOCATION:{_escape(location)}")
    if organizer_email:
        lines.append(f"ORGANIZER:mailto:{organizer_email}")
    if attendee_email:
        lines.append(f"ATTENDEE;RSVP=TRUE:mailto:{attendee_email}")
    lines += ["END:VEVENT", "END:VCALENDAR"]

    return "\r\n".join(lines) + "\r\n"
