"""Email notification templates + dispatch helper.

Call `notify(to, subject, html)` from service code — it dispatches via Celery
so the calling request never blocks on, or fails because of, email delivery.
Each `*_email` function below returns (subject, html) for one event type.
"""
from __future__ import annotations


def notify(
    to: str | None, subject: str, html: str,
    ics_content: str | None = None, ics_filename: str | None = None,
) -> None:
    """Fire-and-forget dispatch. No-ops if `to` is empty (many aspirant
    accounts only have a phone number, no email)."""
    if not to:
        return
    from app.tasks.worker import send_notification_email
    send_notification_email.delay(to, subject, html, ics_content, ics_filename)


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
    subject = "Thank you for choosing BeginablAI — next steps for verification"
    html = _wrap(
        f"Welcome, {company_name}!",
        """
        <p>Thank you for choosing <strong>BeginablAI</strong> to find your next hire. We're excited to have you on board!</p>
        <p>To complete your company verification, please keep the following documents ready — our team will reach out to collect them:</p>
        <ul style="line-height:1.8;padding-left:20px;">
          <li><strong>GST Certificate</strong> <em>or</em> <strong>Company Registration Certificate</strong></li>
          <li><strong>PAN Card</strong> (company / authorised signatory)</li>
          <li><strong>Business Email Proof</strong> (e.g. a screenshot of your company email inbox)</li>
        </ul>
        <p>One of our team members will contact you shortly at the email / phone number on record to guide you through the next steps.</p>
        <p style="color:#6B7280;font-size:12px;">Questions? Reply to this email and we'll be happy to help.</p>
        """,
    )
    return subject, html


def team_invite_email(
    company_name: str, contact_person: str, role_name: str,
    login_identifier: str, password: str, department_name: str | None,
) -> tuple[str, str]:
    role_label = role_name.replace("_", " ").title()
    dept_html = f"<p><strong>Department:</strong> {department_name}</p>" if department_name else ""
    subject = f"You've been added to {company_name} on BeginablAI"
    html = _wrap(
        f"Welcome to {company_name}",
        f"""
        <p>Hi {contact_person or ''}, you've been added as a <strong>{role_label}</strong>
        on <strong>{company_name}</strong>'s BeginablAI hiring workspace.</p>
        {dept_html}
        <p>Sign in with these credentials:</p>
        <ul style="line-height:1.8;padding-left:20px;">
          <li><strong>Login:</strong> {login_identifier}</li>
          <li><strong>Temporary password:</strong> {password}</li>
        </ul>
        <p style="color:#6B7280;font-size:12px;">We recommend changing your password after your first sign-in.</p>
        """,
    )
    return subject, html


def employer_verification_email(company_name: str, approved: bool, reason: str | None) -> tuple[str, str]:
    if approved:
        subject = "Your company is verified ✓"
        html = _wrap(
            "Verification approved",
            f"<p>Congratulations — <strong>{company_name}</strong> has been verified. "
            f"You can now publish jobs and your listings will show the verified badge.</p>",
        )
    else:
        subject = "Verification update needed"
        reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        html = _wrap(
            "Verification rejected",
            f"<p>Your verification submission for <strong>{company_name}</strong> "
            f"was not approved.</p>{reason_html}<p>Please resubmit with updated documents.</p>",
        )
    return subject, html
