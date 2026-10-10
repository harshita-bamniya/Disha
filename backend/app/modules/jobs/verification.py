"""Employer-side company verification: guided details + documents + submission.

One verification *case* per company at a time (joined through EmployerProfile.company_id),
so every teammate sees the same status. Approval is a company-level fact: see
app/modules/admin/service/employers.py for the reviewer side.
"""
from __future__ import annotations

import contextlib
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core import employer_verification_rules as rules
from app.core.exceptions import BadRequestException, OtpExpiredException, OtpInvalidException
from app.core.security import generate_otp, hash_otp, verify_otp
from app.models.company import Company
from app.models.employer_verification import (
    EmployerVerification,
    EmployerVerificationDocument,
    EmployerVerificationEvent,
)
from app.models.user import EmployerProfile, OtpVerification, User
from app.modules.jobs.schemas import (
    VerificationDetailsRequest,
    VerificationDocumentOut,
    VerificationEventOut,
    VerificationStatusResponse,
)

logger = logging.getLogger(__name__)

EDITABLE = ("draft", "needs_info")
IN_REVIEW = ("requested", "under_review")
DUPLICATE_FIELDS = ("gstin", "cin", "llpin", "pan", "udyam", "darpan_id")
BUSINESS_EMAIL_OTP_MINUTES = 10


class InvalidDetailsError(Exception):
    def __init__(self, errors: dict[str, str]):
        super().__init__("Some details are not valid.")
        self.errors = errors


def _profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile or not profile.company_id:
        raise BadRequestException("Employer profile not found.")
    return profile


def latest_case(company_id, db: Session) -> EmployerVerification | None:
    return (
        db.query(EmployerVerification)
        .join(EmployerProfile, EmployerVerification.employer_id == EmployerProfile.id)
        .filter(EmployerProfile.company_id == company_id)
        .order_by(EmployerVerification.submitted_at.desc())
        .first()
    )


def _rejected_attempts(company_id, db: Session) -> int:
    return (
        db.query(EmployerVerification)
        .join(EmployerProfile, EmployerVerification.employer_id == EmployerProfile.id)
        .filter(EmployerProfile.company_id == company_id, EmployerVerification.status == "rejected")
        .count()
    )


def _is_blocked(v: EmployerVerification | None, company_id, db: Session) -> bool:
    if not v or v.status != "rejected":
        return False
    return v.reason_code in rules.FATAL_REASON_CODES or _rejected_attempts(company_id, db) >= rules.MAX_REJECTED_ATTEMPTS


def _duplicates(company_id, details: dict, db: Session) -> dict[str, int]:
    """How many OTHER companies already use the same registry ID in a live or approved case."""
    out: dict[str, int] = {}
    live = ("requested", "under_review", "needs_info", "approved")
    for field in DUPLICATE_FIELDS:
        value = details.get(field)
        if not value:
            continue
        rows = (
            db.query(EmployerProfile.company_id)
            .join(EmployerVerification, EmployerVerification.employer_id == EmployerProfile.id)
            .filter(
                EmployerProfile.company_id != company_id,
                EmployerVerification.status.in_(live),
                EmployerVerification.details[field].astext == value,
            )
            .distinct()
            .count()
        )
        out[field] = rows
    domain = rules.email_domain(details.get("business_email"))
    if domain and domain not in rules.FREE_MAIL_DOMAINS:
        like = f"%@{domain}"
        out["domain"] = (
            db.query(EmployerProfile.company_id)
            .join(EmployerVerification, EmployerVerification.employer_id == EmployerProfile.id)
            .filter(
                EmployerProfile.company_id != company_id,
                EmployerVerification.status.in_(live),
                EmployerVerification.details["business_email"].astext.ilike(like),
            )
            .distinct()
            .count()
        )
    return out


def business_email_source(v: EmployerVerification, user: User) -> str | None:
    """How the employer has shown they can read the business email: 'login' (it is the already-verified
    login email), 'code' (they entered the code we sent to it), or None. Editing the address after a code
    was entered withdraws the proof."""
    email = ((v.details or {}).get("business_email") or "").lower()
    if not email:
        return None
    if user.email_verified and (user.email or "").lower() == email:
        return "login"
    return "code" if (v.business_email_verified or "").lower() == email else None


def business_email_proven(v: EmployerVerification, user: User) -> bool:
    return business_email_source(v, user) is not None


def compute_checks(v: EmployerVerification, user: User, company_id, db: Session) -> list[dict]:
    return rules.auto_checks(
        v.entity_type, v.details or {},
        account_email=user.email, email_verified=bool(user.email_verified),
        duplicates=_duplicates(company_id, v.details or {}, db),
        docs=[(d.doc_type, d.ai_check) for d in v.documents],
        business_email_proven=business_email_proven(v, user),
        business_email_source=business_email_source(v, user),
    )


def to_response(v: EmployerVerification | None, user: User, company: Company | None, db: Session) -> VerificationStatusResponse:
    company_status = company.verification_status if company else "unverified"
    if not v:
        return VerificationStatusResponse(
            email_verified=bool(user.email_verified), company_status=company_status,
            checklist={}, missing=["Choose what kind of organisation you are."],
        )
    uploaded = {d.doc_type for d in v.documents}
    details = v.details or {}
    blocked = _is_blocked(v, v.employer.company_id if v.employer else None, db)
    can_edit = v.status in EDITABLE or (v.status == "rejected" and not blocked)
    proven = business_email_proven(v, user)
    missing = rules.missing_items(v.entity_type, details, uploaded, business_email_proven=proven) if can_edit else []
    if can_edit:
        missing += rules.blocking_failures(v.auto_checks or [])
    if can_edit and not user.email_verified:
        missing = ["Verify your account email (OTP) first."] + missing
    return VerificationStatusResponse(
        id=str(v.id), status=v.status, rejection_reason=v.rejection_reason, reason_code=v.reason_code,
        info_request=v.info_request, submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
        attempt_no=v.attempt_no or 1, entity_type=v.entity_type,
        entity_label=rules.ENTITY_LABELS.get(v.entity_type or ""),
        details=details or None, auto_checks=v.auto_checks or [],
        checklist=rules.checklist(v.entity_type), missing=missing,
        can_edit=can_edit, can_submit=can_edit and v.status != "rejected" and not missing,
        blocked=blocked, email_verified=bool(user.email_verified), company_status=company_status,
        business_email_proven=proven,
        documents=[
            VerificationDocumentOut(
                id=str(d.id), doc_type=d.doc_type, label=rules.DOC_LABELS.get(d.doc_type),
                original_filename=d.original_filename, status=d.status, notes=d.notes, uploaded_at=d.uploaded_at,
            )
            for d in sorted(v.documents, key=lambda x: x.uploaded_at or datetime.min.replace(tzinfo=timezone.utc))
        ],
        events=[
            VerificationEventOut(id=str(e.id), from_status=e.from_status, to_status=e.to_status,
                                 note=e.note, created_at=e.created_at)
            for e in v.events
        ],
    )


def _event(v: EmployerVerification, user_id, frm: str | None, to: str, note: str | None) -> None:
    v.events.append(EmployerVerificationEvent(
        verification_id=v.id, actor_id=user_id, from_status=frm, to_status=to, note=note,
    ))


def _open_case(user: User, db: Session) -> tuple[EmployerVerification, EmployerProfile, Company]:
    """Return the case the employer may edit, creating a draft (or a retry draft after a
    rejection) when needed."""
    profile = _profile(user, db)
    company = db.get(Company, profile.company_id)
    v = latest_case(profile.company_id, db)

    if v and v.status == "approved":
        raise BadRequestException("Your company is already verified.")
    if v and v.status in IN_REVIEW:
        raise BadRequestException("Your case is with our review team — you can edit it again if they ask for more information.")
    if v and v.status in EDITABLE:
        return v, profile, company
    if _is_blocked(v, profile.company_id, db):
        raise BadRequestException("This verification can't be resubmitted online. Please contact support.")

    new = EmployerVerification(
        employer_id=profile.id, status="draft",
        entity_type=v.entity_type if v else None, details=dict(v.details or {}) if v else None,
        attempt_no=(v.attempt_no + 1) if v else 1,
        business_email_verified=v.business_email_verified if v else None,
    )
    db.add(new)
    db.flush()
    if v:  # carry the previous documents forward so a retry doesn't mean uploading everything again
        for d in v.documents:
            if d.status != "rejected":
                db.add(EmployerVerificationDocument(
                    verification_id=new.id, doc_type=d.doc_type, file_url=d.file_url,
                    original_filename=d.original_filename, status="pending", ai_check=d.ai_check,
                ))
    _event(new, user.id, v.status if v else None, "draft", "Started a new verification attempt." if v else "Verification started.")
    db.flush()
    return new, profile, company


def get_status(user: User, db: Session) -> VerificationStatusResponse:
    profile = _profile(user, db)
    company = db.get(Company, profile.company_id)
    return to_response(latest_case(profile.company_id, db), user, company, db)


def start(user: User, db: Session) -> VerificationStatusResponse:
    v, profile, company = _open_case(user, db)
    db.commit()
    db.refresh(v)
    return to_response(v, user, company, db)


def save_details(user: User, body: VerificationDetailsRequest, db: Session) -> VerificationStatusResponse:
    if body.entity_type not in rules.ENTITY_TYPES:
        raise BadRequestException("Choose a valid organisation type.")
    raw = body.model_dump()
    details, errors = rules.clean_details(raw)
    if errors:
        raise InvalidDetailsError(errors)
    v, profile, company = _open_case(user, db)
    v.entity_type = body.entity_type
    v.details = details
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    db.commit()
    db.refresh(v)
    return to_response(v, user, company, db)


async def upload_document(user: User, doc_type: str, file, db: Session) -> VerificationStatusResponse:
    from app.core.storage import save_upload

    if doc_type not in rules.DOC_LABELS:
        raise BadRequestException("Invalid document type.")
    v, profile, company = _open_case(user, db)
    try:
        file_url, original = await save_upload(file, "employer_verification")
    except ValueError as e:
        raise BadRequestException(str(e))

    if doc_type != "other":  # one current document per type; 'other' may repeat
        for old in [d for d in v.documents if d.doc_type == doc_type]:
            _remove_file_if_unshared(old, db)
            v.documents.remove(old)
    # Let the AI reader say what the file actually is. Advisory: a failure or an odd read never blocks the upload.
    from app.ai import document_check
    from app.core.storage import get_path
    ai_check = await document_check.analyse(get_path(file_url).read_bytes(), file.content_type)
    v.documents.append(EmployerVerificationDocument(
        verification_id=v.id, doc_type=doc_type, file_url=file_url, original_filename=original, ai_check=ai_check,
    ))
    _event(v, user.id, v.status, v.status, f"Uploaded: {rules.DOC_LABELS[doc_type]}")
    db.flush()
    db.refresh(v)
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    db.commit()
    db.refresh(v)
    return to_response(v, user, company, db)


def _remove_file_if_unshared(doc: EmployerVerificationDocument, db: Session) -> None:
    others = db.query(EmployerVerificationDocument).filter(
        EmployerVerificationDocument.file_url == doc.file_url, EmployerVerificationDocument.id != doc.id,
    ).count()
    if others:
        return
    from app.core.storage import BASE_DIR
    with contextlib.suppress(OSError):
        os.remove(os.path.join(BASE_DIR, doc.file_url))


def delete_document(user: User, document_id: str, db: Session) -> VerificationStatusResponse:
    v, profile, company = _open_case(user, db)
    doc = next((d for d in v.documents if str(d.id) == document_id), None)
    if not doc:
        raise BadRequestException("Document not found on your current verification.")
    _remove_file_if_unshared(doc, db)
    v.documents.remove(doc)
    _event(v, user.id, v.status, v.status, f"Removed: {rules.DOC_LABELS.get(doc.doc_type, doc.doc_type)}")
    db.flush()
    db.refresh(v)
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    db.commit()
    db.refresh(v)
    return to_response(v, user, company, db)


def submit(user: User, db: Session) -> VerificationStatusResponse:
    v, profile, company = _open_case(user, db)
    if not user.email_verified:
        raise BadRequestException("Verify your account email with the OTP we sent before submitting.")
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    resp = to_response(v, user, company, db)
    if resp.missing:
        raise BadRequestException("Not ready to submit: " + " ".join(resp.missing))

    previous = v.status
    v.status = "requested"
    v.submitted_at = datetime.now(timezone.utc)
    v.info_request = None
    v.reviewed_at = None
    v.employer_id = profile.id
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    for d in v.documents:
        if d.status == "rejected":   # a replaced document starts over
            d.status = "pending"
    company.verification_status = "pending"
    _event(v, user.id, previous, "requested",
           "Resubmitted with the requested information." if previous == "needs_info" else "Submitted for review.")
    db.commit()
    db.refresh(v)

    if user.email:
        from app.core.notifications import employer_verification_request_email, notify
        subject, html = employer_verification_request_email(company.name)
        notify(user.email, subject, html)
    return to_response(v, user, company, db)


# ── Business email ownership ──────────────────────────────────────────────────

def _case_business_email(v: EmployerVerification) -> str:
    email = ((v.details or {}).get("business_email") or "").strip().lower()
    if not email:
        raise BadRequestException("Enter and save your business email first.")
    return email


async def send_business_email_code(user: User, db: Session) -> VerificationStatusResponse:
    """Emails a 6-digit code to the business email on the case, to prove the employer can read it."""
    v, profile, company = _open_case(user, db)
    email = _case_business_email(v)
    if business_email_proven(v, user):
        raise BadRequestException("This email is already confirmed.")
    now = datetime.now(timezone.utc)
    # Only the newest code works.
    db.query(OtpVerification).filter(
        OtpVerification.user_id == user.id, OtpVerification.target == email,
        OtpVerification.purpose == "verify", OtpVerification.used_at == None,  # noqa: E711
    ).update({"used_at": now}, synchronize_session=False)
    otp = generate_otp()
    db.add(OtpVerification(
        user_id=user.id, target=email, otp_hash=hash_otp(otp), purpose="verify",
        expires_at=now + timedelta(minutes=BUSINESS_EMAIL_OTP_MINUTES),
    ))
    db.commit()
    from app.core.email import send_business_email_otp
    await send_business_email_otp(email, otp, company.name if company else "your company")
    db.refresh(v)
    return to_response(v, user, company, db)


def verify_business_email_code(user: User, otp: str, db: Session) -> VerificationStatusResponse:
    v, profile, company = _open_case(user, db)
    email = _case_business_email(v)
    record = (
        db.query(OtpVerification)
        .filter(OtpVerification.user_id == user.id, OtpVerification.target == email,
                OtpVerification.purpose == "verify", OtpVerification.used_at == None)  # noqa: E711
        .order_by(OtpVerification.created_at.desc())
        .first()
    )
    if not record:
        raise BadRequestException("No active code for this email. Send a new one.")
    if record.is_expired:
        raise OtpExpiredException()
    if not verify_otp(otp, record.otp_hash):
        raise OtpInvalidException()
    record.used_at = datetime.now(timezone.utc)
    v.business_email_verified = email
    _event(v, user.id, v.status, v.status, "Business email confirmed with a code.")
    db.flush()
    db.refresh(v)
    v.auto_checks = compute_checks(v, user, profile.company_id, db)
    db.commit()
    db.refresh(v)
    return to_response(v, user, company, db)
