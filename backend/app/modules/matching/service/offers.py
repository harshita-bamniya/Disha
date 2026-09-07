"""Employer: offer letters + bulk candidate email."""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.core.email import send_email
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.applications import (
    Application,
    ApplicationStatusHistory,
    CandidateEmailLog,
    OfferLetter,
)
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    User,
)
from app.modules.matching.schemas import (
    OfferLetterOut,
)

from app.modules.matching.service import core

logger = logging.getLogger(__name__)


def _aspirant_full_name(aspirant_id, db: Session) -> Optional[str]:
    """Candidate display names live on AspirantProfile, not User.full_name
    (which is only populated for admin/employer accounts)."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == aspirant_id).first()
    return profile.full_name if profile else None


def _offer_to_out(offer: OfferLetter) -> OfferLetterOut:
    return OfferLetterOut(
        id=str(offer.id), application_id=str(offer.application_id), status=offer.status,
        role_title=offer.role_title, salary_ctc=offer.salary_ctc, start_date=offer.start_date,
        work_location=offer.work_location, employment_type=offer.employment_type,
        company_address=offer.company_address, hiring_manager_name=offer.hiring_manager_name,
        hiring_manager_designation=offer.hiring_manager_designation, extra_clauses=offer.extra_clauses,
        sent_at=offer.sent_at, responded_at=offer.responded_at,
        signature_name=offer.signature_name, decline_reason=offer.decline_reason,
        created_at=offer.created_at,
    )


def _render_offer_pdf(offer: OfferLetter, candidate_name: str, candidate_email: str, company_name: str) -> bytes:
    from app.modules.matching.offer_pdf import generate_offer_letter_pdf
    return generate_offer_letter_pdf(
        candidate_name=candidate_name or "Candidate",
        candidate_email=candidate_email or "",
        role_title=offer.role_title,
        company_name=company_name or "Company",
        company_address=offer.company_address or "",
        hiring_manager_name=offer.hiring_manager_name,
        hiring_manager_designation=offer.hiring_manager_designation,
        salary_ctc=offer.salary_ctc,
        start_date=offer.start_date,
        work_location=offer.work_location,
        employment_type=offer.employment_type,
        extra_clauses=offer.extra_clauses,
        offer_date=offer.sent_at.strftime("%d %B %Y") if offer.sent_at else None,
        signed=(offer.status == "accepted"),
        signature_name=offer.signature_name,
        signed_at=offer.responded_at.strftime("%d %B %Y, %I:%M %p UTC") if offer.responded_at else None,
        signature_ip=offer.signature_ip,
    )


async def send_offer_letter(application_id: str, body, user: User, db: Session) -> OfferLetterOut:
    """Create/update the persisted offer letter for this application, email the
    candidate the PDF, and notify them in-app. Replaces the previous stateless
    "generate a PDF and forget it" flow — persisting the offer is what makes
    accept/decline possible at all."""
    app = core._get_employer_application(application_id, user, db)
    if not app.aspirant or not app.aspirant.email:
        raise BadRequestException("This candidate has no email address on file.")

    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if offer and offer.status != "sent":
        raise BadRequestException(f"Cannot modify an offer that has already been {offer.status}.")

    employer = core._get_employer_profile_approved(user, db)

    from datetime import datetime, timezone
    if offer is None:
        offer = OfferLetter(application_id=app.id, created_by=user.id)
        db.add(offer)

    offer.role_title = body.role_title
    offer.company_address = body.company_address
    offer.hiring_manager_name = body.hiring_manager_name
    offer.hiring_manager_designation = body.hiring_manager_designation
    offer.salary_ctc = body.salary_ctc
    offer.start_date = body.start_date
    offer.work_location = body.work_location
    offer.employment_type = body.employment_type
    offer.extra_clauses = body.extra_clauses
    offer.status = "sent"
    offer.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)

    if app.status not in ("withdrawn", "hired", "rejected"):
        prev = app.status
        app.status = "offer_sent"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="offer_sent",
            changed_by=user.id, note="Offer letter sent",
        ))
        db.commit()

    pdf_bytes = _render_offer_pdf(offer, _aspirant_full_name(app.aspirant_id, db), app.aspirant.email, employer.company_name)

    from app.modules.inbox.service import create_notification
    html = (
        f"<p>Congratulations — you've received an offer letter for the "
        f"<b>{body.role_title}</b> position at <b>{employer.company_name or 'the company'}</b>. "
        f"It's attached as a PDF. Sign in to your applications dashboard to review and respond.</p>"
    )
    await send_email(
        app.aspirant.email, f"Your offer letter — {body.role_title}", html,
        attachment=(f"offer_letter_{application_id[:8]}.pdf", pdf_bytes, "pdf"),
    )
    create_notification(
        db, app.aspirant_id, "application_status_changed",
        f"You've received an offer — {body.role_title}",
        f"{employer.company_name or 'The employer'} sent you an offer letter for {body.role_title}. Review and respond in your applications.",
        "/app/jobs/applications",
    )
    core._audit_matching(db, "offer_letter.sent", user.id, "offer_letter", str(offer.id),
                    {"application_id": application_id, "role_title": body.role_title})
    db.commit()

    return _offer_to_out(offer)


def get_offer_letter_for_employer(application_id: str, user: User, db: Session) -> Optional[OfferLetterOut]:
    app = core._get_employer_application(application_id, user, db)
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    return _offer_to_out(offer) if offer else None


def download_offer_letter_pdf_employer(application_id: str, user: User, db: Session) -> bytes:
    app = core._get_employer_application(application_id, user, db)
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if not offer:
        raise NotFoundException("No offer letter has been sent for this application.")
    employer = core._get_employer_profile_approved(user, db)
    return _render_offer_pdf(
        offer, _aspirant_full_name(app.aspirant_id, db),
        app.aspirant.email if app.aspirant else None, employer.company_name,
    )


def _get_own_offer_letter(application_id: str, user: User, db: Session) -> tuple[Application, OfferLetter]:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.aspirant_id == user.id)
        .first()
    )
    if not app:
        raise NotFoundException("Application not found.")
    offer = db.query(OfferLetter).filter(OfferLetter.application_id == app.id).first()
    if not offer:
        raise NotFoundException("No offer letter for this application.")
    return app, offer


def get_my_offer_letter(application_id: str, user: User, db: Session) -> OfferLetterOut:
    _, offer = _get_own_offer_letter(application_id, user, db)
    return _offer_to_out(offer)


def download_my_offer_letter_pdf(application_id: str, user: User, db: Session) -> bytes:
    app, offer = _get_own_offer_letter(application_id, user, db)
    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    return _render_offer_pdf(offer, _aspirant_full_name(user.id, db), user.email, employer.company_name if employer else None)


def accept_offer_letter(
    application_id: str, signature_name: str, ip: str | None, user_agent: str | None, user: User, db: Session,
) -> OfferLetterOut:
    """Self-serve e-signature acceptance — typed full legal name + IP/timestamp
    audit trail. Not a legally-binding e-signature (that needs a third-party
    provider contract — see docs/ENTERPRISE_AUDIT_ROADMAP.md M2), but a real,
    persisted candidate response instead of a status flag alone."""
    app, offer = _get_own_offer_letter(application_id, user, db)
    if offer.status != "sent":
        raise BadRequestException(f"This offer has already been {offer.status}.")

    from datetime import datetime, timezone
    offer.status = "accepted"
    offer.responded_at = datetime.now(timezone.utc)
    offer.signature_name = signature_name
    offer.signature_ip = ip
    offer.signature_user_agent = user_agent

    prev = app.status
    if prev not in ("withdrawn", "rejected"):
        app.status = "hired"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="hired",
            changed_by=user.id, note=f"Offer accepted & digitally signed by {signature_name}",
        ))
    core._audit_matching(db, "offer_letter.signed", user.id, "offer_letter", str(offer.id),
                    {"application_id": application_id, "signature_name": signature_name})
    db.commit()
    db.refresh(offer)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer and job:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "offer_accepted",
            f"Offer accepted — {job.title}",
            f"{signature_name} has accepted and signed the offer letter for {job.title}.",
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    return _offer_to_out(offer)


def decline_offer_letter(application_id: str, reason: str | None, user: User, db: Session) -> OfferLetterOut:
    app, offer = _get_own_offer_letter(application_id, user, db)
    if offer.status != "sent":
        raise BadRequestException(f"This offer has already been {offer.status}.")

    from datetime import datetime, timezone
    offer.status = "declined"
    offer.responded_at = datetime.now(timezone.utc)
    offer.decline_reason = reason

    prev = app.status
    if prev not in ("withdrawn", "hired"):
        app.status = "offer_declined"
        db.add(ApplicationStatusHistory(
            application_id=app.id, from_status=prev, to_status="offer_declined",
            changed_by=user.id, note="Candidate declined the offer letter" + (f": {reason}" if reason else ""),
        ))
    db.commit()
    db.refresh(offer)

    job = db.query(JobPosting).filter(JobPosting.id == app.job_id).first()
    employer = db.query(EmployerProfile).filter(EmployerProfile.id == job.employer_id).first() if job else None
    if employer and job:
        from app.modules.inbox.service import notify_company_team
        notify_company_team(
            db, employer, "offer_declined",
            f"Offer declined — {job.title}",
            f"The candidate has declined the offer letter for {job.title}." + (f' Reason: "{reason}"' if reason else ""),
            f"/app/employer/pipeline/{job.id}",
        )
        db.commit()

    return _offer_to_out(offer)


async def bulk_email_candidates(
    application_ids: list[str], subject: str, body: str, user: User, db: Session
) -> dict:
    """Send the same email to multiple candidates in one action.

    Skips any application where the candidate has no email address on file.
    Persists a log row per send for compliance/team visibility.
    """
    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    sender_name = employer.company_name or user.email or "Recruiting team"

    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)
    apps = (
        db.query(Application)
        .filter(Application.id.in_(application_ids), Application.job_id.in_(job_ids))
        .all()
    )

    html = "".join(f"<p>{line}</p>" for line in body.split("\n") if line.strip()) or f"<p>{body}</p>"
    sent = 0
    skipped = 0
    for app in apps:
        if not app.aspirant or not app.aspirant.email:
            skipped += 1
            continue
        await send_email(app.aspirant.email, subject, html)
        db.add(CandidateEmailLog(
            application_id=app.id, sender_id=user.id,
            recipient_email=app.aspirant.email, subject=subject, body=body,
        ))
        sent += 1

    if sent:
        db.commit()

    return {"sent": sent, "skipped": skipped}

