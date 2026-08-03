"""Celery tasks for application submission notifications (Phase 4).

Two tasks:
  send_application_confirmation_email — to the candidate
  send_recruiter_new_application_alert — to the employer team
"""
import logging

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.application_tasks.send_application_confirmation_email",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_application_confirmation_email(self, application_id: str, user_id: str, job_id: str) -> None:
    """Send a confirmation email to the candidate after successful submission."""
    from app.database import SessionLocal
    from app.models.mvp3 import Application
    from app.models.user import AspirantProfile, JobPosting, User, EmployerProfile
    from app.core.notifications import notify

    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            logger.warning("[CONF_EMAIL] Application %s not found", application_id)
            return

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.email:
            return

        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            return

        employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        company_name = employer.company_name if employer else "the employer"

        profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user_id).first()
        candidate_name = (profile.full_name if profile else None) or user.email

        ref = app.reference_number or str(app.id)[:8].upper()

        subject = f"Application submitted — {job.title}"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#1E3A5F;">Application Received</h2>
          <p>Hi {candidate_name},</p>
          <p>Your application to <strong>{job.title}</strong> at
             <strong>{company_name}</strong> has been received.</p>
          <p style="background:#F3F4F6;padding:12px;border-radius:6px;">
            Reference number: <strong>{ref}</strong>
          </p>
          <p>You can track your application status in
             <a href="/app/my-applications">My Applications</a>.</p>
          <p style="color:#6B7280;font-size:13px;margin-top:24px;">
            The hiring team will review your application and be in touch.</p>
          <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">— Disha AI</p>
        </div>
        """
        notify(user.email, subject, html)
        logger.info("[CONF_EMAIL] Sent to %s for app=%s", user.email, application_id)
    except Exception as exc:
        logger.error("[CONF_EMAIL] Failed for app=%s: %s", application_id, exc)
        raise
    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="app.tasks.application_tasks.send_recruiter_new_application_alert",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_recruiter_new_application_alert(self, application_id: str, job_id: str) -> None:
    """Notify the employer team about a new application."""
    from app.database import SessionLocal
    from app.models.mvp3 import Application
    from app.models.user import AspirantProfile, JobPosting, EmployerProfile, User
    from app.core.notifications import new_application_email, notify
    from app.modules.inbox.service import notify_company_team

    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return

        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            return

        employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first()
        if not employer:
            return

        profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == app.aspirant_id).first()
        candidate_name = profile.full_name if profile else None

        # Email to hiring manager
        recipient = db.query(User).filter(User.id == employer.user_id).first()
        subject, html = new_application_email(job.title, candidate_name)
        notify(recipient.email if recipient else None, subject, html)

        # In-app notification to whole company team
        notify_company_team(
            db, employer,
            "new_application",
            f"New application: {job.title}",
            f"{candidate_name or 'A candidate'} applied to {job.title}.",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()
        logger.info("[RECRUITER_ALERT] Notified employer for app=%s job=%s", application_id, job_id)
    except Exception as exc:
        logger.error("[RECRUITER_ALERT] Failed for app=%s: %s", application_id, exc)
        raise
    finally:
        db.close()
