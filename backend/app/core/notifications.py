"""Email notification templates + dispatch helper.

Call `notify(to, subject, html)` from service code — it dispatches via Celery
so the calling request never blocks on, or fails because of, email delivery.
Each `*_email` function below returns (subject, html) for one event type.
"""
from __future__ import annotations

import logging


def notify(
    to: str | None, subject: str, html: str,
    ics_content: str | None = None, ics_filename: str | None = None,
) -> None:
    """Fire-and-forget dispatch. No-ops if `to` is empty (many aspirant
    accounts only have a phone number, no email)."""
    if not to:
        return
    # Delivery is best-effort: callers have usually committed their DB changes
    # by now, so a broker/result-store outage must not turn into a 500.
    try:
        from app.tasks.worker import send_notification_email
        send_notification_email.delay(to, subject, html, ics_content, ics_filename)
    except Exception:
        logging.getLogger(__name__).exception("Could not queue notification email to %s", to)


def _wrap(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1E3A5F;margin-bottom:16px;">{title}</h2>
      {body_html}
      <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">— BeginablAI</p>
    </div>
    """


def new_application_email(job_title: str, candidate_name: str | None) -> tuple[str, str]:
    subject = f"New application: {job_title}"
    html = _wrap(
        "New candidate application",
        f"<p><strong>{candidate_name or 'A candidate'}</strong> just applied to "
        f"<strong>{job_title}</strong>. Review them in your candidate pipeline.</p>",
    )
    return subject, html


def application_status_email(job_title: str, company_name: str, new_status: str) -> tuple[str, str]:
    label = new_status.replace("_", " ").title()
    subject = f"Update on your application — {job_title}"
    html = _wrap(
        "Your application status has changed",
        f"<p>Your application to <strong>{job_title}</strong> at "
        f"<strong>{company_name}</strong> is now: <strong>{label}</strong>.</p>",
    )
    return subject, html


def interview_scheduled_email(job_title: str, company_name: str, scheduled_at: str, meeting_link: str | None) -> tuple[str, str]:
    subject = f"Interview scheduled — {job_title}"
    link_html = f'<p><a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ""
    html = _wrap(
        "Interview scheduled",
        f"<p>An interview has been scheduled for your application to "
        f"<strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>"
        f"<p><strong>When:</strong> {scheduled_at}</p>{link_html}",
    )
    return subject, html


def test_invite_email(
    job_title: str, company_name: str, message: str | None, test_link: str | None,
) -> tuple[str, str]:
    subject = f"Next step for your application — {job_title}"
    message_html = "".join(f"<p>{line}</p>" for line in (message or "").split("\n") if line.strip())
    link_html = (
        f'<p><a href="{test_link}">{test_link}</a></p>' if test_link else ""
    )
    html = _wrap(
        "You've been invited to the next round",
        f"<p>{company_name} has invited you to complete a test as the next step "
        f"for your application to <strong>{job_title}</strong>.</p>"
        f"{message_html}{link_html}",
    )
    return subject, html


def interview_slots_offered_email(job_title: str, company_name: str, slot_count: int) -> tuple[str, str]:
    subject = f"Pick your interview time — {job_title}"
    html = _wrap(
        "Choose a time that works for you",
        f"<p>{company_name} has offered {slot_count} time options for your "
        f"<strong>{job_title}</strong> interview. Sign in to your applications "
        f"to pick the one that works best for you.</p>",
    )
    return subject, html


def interview_reminder_email(
    job_title: str, company_name: str, scheduled_at: str, meeting_link: str | None, hours_before: int,
) -> tuple[str, str]:
    when = "tomorrow" if hours_before >= 24 else "in about an hour"
    subject = f"Reminder: your interview is {when} — {job_title}"
    link_html = f'<p><a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ""
    html = _wrap(
        "Interview reminder",
        f"<p>Your interview for <strong>{job_title}</strong> at <strong>{company_name}</strong> "
        f"is coming up.</p><p><strong>When:</strong> {scheduled_at}</p>{link_html}",
    )
    return subject, html


def scorecard_nudge_email(job_title: str, candidate_name: str | None) -> tuple[str, str]:
    subject = f"Scorecard needed — {job_title}"
    html = _wrap(
        "Your interview scorecard is waiting",
        f"<p>Your interview with <strong>{candidate_name or 'a candidate'}</strong> for "
        f"<strong>{job_title}</strong> has passed. Submit your scorecard so the hiring "
        f"team can move the candidate forward.</p>",
    )
    return subject, html


def interview_no_show_rebook_email(job_title: str, company_name: str) -> tuple[str, str]:
    subject = f"We missed you — {job_title}"
    html = _wrap(
        "Let's find a new time",
        f"<p>We had an interview scheduled for your application to <strong>{job_title}</strong> "
        f"at <strong>{company_name}</strong>, but it looks like it didn't happen.</p>"
        f"<p>If you'd still like to be considered, sign in to your applications and request a "
        f"new time — we're happy to reschedule once.</p>",
    )
    return subject, html


def employer_verification_request_email(company_name: str) -> tuple[str, str]:
    """Acknowledgement sent when the employer submits their verification case."""
    subject = "We've received your verification request"
    html = _wrap(
        f"Thanks, {company_name}",
        """
        <p>Your verification details and documents are with our review team. We usually respond within
        <strong>2 working days</strong>.</p>
        <p>You'll get an email as soon as we approve your company, or if we need anything else from you.
        You can follow progress any time under <strong>Verification</strong> in your employer dashboard.</p>
        <p style="color:#6B7280;font-size:12px;">You can keep building your company profile and drafting jobs meanwhile;
        publishing opens once you are verified.</p>
        """,
    )
    return subject, html


def employer_verification_needs_info_email(company_name: str, message: str) -> tuple[str, str]:
    subject = "More information needed to verify your company"
    html = _wrap(
        "We need a little more from you",
        f"<p>Our review team needs the following to verify <strong>{company_name}</strong>:</p>"
        f"<blockquote style=\"border-left:3px solid #D97706;margin:12px 0;padding:6px 12px;color:#374151;\">{message}</blockquote>"
        "<p>Open <strong>Verification</strong> in your employer dashboard, update the details or documents and resubmit. "
        "Your earlier uploads are kept.</p>",
    )
    return subject, html


def team_invite_email(
    company_name: str, role_name: str, department_name: str | None, accept_url: str,
    invited_by: str | None = None, expires_in_days: int = 7,
) -> tuple[str, str]:
    """Invitation to join a company's hiring workspace. Carries a one-time link where the invitee
    sets their own name and password. Never contains a password."""
    role_label = role_name.replace("_", " ").title()
    where = f" in the <strong>{department_name}</strong> department" if department_name else ""
    by = f"{invited_by} has invited you" if invited_by else "You have been invited"
    subject = f"You're invited to join {company_name} on BeginablAI"
    html = _wrap(
        f"Join {company_name}",
        f"""
        <p>{by} to join <strong>{company_name}</strong>'s BeginablAI hiring workspace as a
        <strong>{role_label}</strong>{where}.</p>
        <p><a href="{accept_url}" style="display:inline-block;background:#1A2744;color:#fff;
        padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Accept invitation</a></p>
        <p style="color:#6B7280;font-size:12px;">You'll choose your own password on the next page.
        This link works once and expires in {expires_in_days} days. If the button doesn't work, copy this address into your browser:<br>
        <span style="word-break:break-all;">{accept_url}</span></p>
        <p style="color:#6B7280;font-size:12px;">If you weren't expecting this, you can ignore this email; no account is created unless you accept.</p>
        """,
    )
    return subject, html


def employer_verification_email(company_name: str, approved: bool, reason: str | None) -> tuple[str, str]:
    if approved:
        subject = "Your company is verified ✓"
        html = _wrap(
            "Verification approved",
            f"<p>Congratulations — <strong>{company_name}</strong> has been verified. "
            f"You can now publish jobs and receive applications.</p>",
        )
    else:
        subject = "Your verification was not approved"
        reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        html = _wrap(
            "Verification not approved",
            f"<p>We couldn't verify <strong>{company_name}</strong> with the information provided.</p>{reason_html}"
            "<p>If this can be fixed, open <strong>Verification</strong> in your employer dashboard, correct the details "
            "and submit again. If you believe this is a mistake, reply to this email or contact support.</p>",
        )
    return subject, html
