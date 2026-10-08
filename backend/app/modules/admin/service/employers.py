"""Admin: employer management, verification, and support tickets."""
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.employer_verification import (
    EmployerVerification,
    EmployerVerificationDocument,
    EmployerVerificationEvent,
)
from app.models.company import Company
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import (
    EmployerProfile,
    JobPosting,
    User,
)
from app.modules.admin.schemas import (
    EmployerDetailResponse,
    EmployerJobEntry,
    EmployerJobsResponse,
    EmployerTeamMemberEntry,
    EmployerVerificationDetail,
    EmployerVerificationEntry,
    MessageResponse,
    PendingEmployerResponse,
    VerificationDocumentEntry,
    VerificationEventEntry,
)
from app.modules.admin.service import core, tickets


def _employer_to_response(
    profile: EmployerProfile, user: User, job_count: int = 0, app_count: int = 0,
    company: Company | None = None,
) -> PendingEmployerResponse:
    # Company profile fields are collected onto the shared Company row by the
    # post-login setup wizard, not onto EmployerProfile — fall back to
    # `company` whenever the EmployerProfile's own copy is empty.
    return PendingEmployerResponse(
        id=str(profile.id),
        user_id=str(user.id),
        company_name=profile.company_name,
        industry=profile.industry or (company.industry if company else None),
        company_size=profile.company_size or (company.company_size if company else None),
        website=profile.website or (company.website if company else None),
        gst_number=profile.gst_number,
        contact_person=profile.contact_person,
        designation=profile.designation,
        city=profile.city or (company.headquarters if company else None),
        description=profile.description or (company.description if company else None),
        phone=user.phone,
        phone_verified=user.phone_verified,
        is_approved=profile.is_approved,
        rejection_reason=profile.rejection_reason,
        registered_at=profile.created_at,
        job_count=job_count,
        application_count=app_count,
    )


def list_employers(db: Session, status: str = "pending", limit: int = 100, offset: int = 0) -> list[PendingEmployerResponse]:
    """Return employers filtered by status: pending | approved | all."""
    from app.models.applications import Application

    query = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(User.deleted_at == None)
    )

    if status == "pending":
        query = query.filter(
            EmployerProfile.is_approved == False,
            User.phone_verified == True,
        )
    elif status == "approved":
        query = query.filter(EmployerProfile.is_approved == True)

    query = query.order_by(EmployerProfile.created_at.desc())
    rows = query.offset(offset).limit(limit).all()

    # Batch-fetch job counts + application counts
    emp_ids = [str(p.id) for p, _ in rows]
    job_counts: dict[str, int] = {}
    app_counts: dict[str, int] = {}
    if emp_ids:
        jc_rows = (
            db.query(JobPosting.employer_id, func.count(JobPosting.id))
            .filter(JobPosting.employer_id.in_(emp_ids))
            .group_by(JobPosting.employer_id)
            .all()
        )
        job_counts = {str(r[0]): r[1] for r in jc_rows}

        # Application counts via job_id → employer
        job_ids_per_emp: dict[str, list] = {}
        for jid, eid in db.query(JobPosting.id, JobPosting.employer_id).filter(JobPosting.employer_id.in_(emp_ids)).all():
            job_ids_per_emp.setdefault(str(eid), []).append(jid)

        all_job_ids = [jid for jlist in job_ids_per_emp.values() for jid in jlist]
        if all_job_ids:
            ac_rows = (
                db.query(Application.job_id, func.count(Application.id))
                .filter(Application.job_id.in_(all_job_ids))
                .group_by(Application.job_id)
                .all()
            )
            for jid, cnt in ac_rows:
                for eid, jlist in job_ids_per_emp.items():
                    if jid in jlist:
                        app_counts[eid] = app_counts.get(eid, 0) + cnt

    company_ids = [p.company_id for p, _ in rows if p.company_id]
    companies_by_id: dict = {}
    if company_ids:
        companies_by_id = {
            c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
        }

    return [
        _employer_to_response(
            profile, user,
            job_count=job_counts.get(str(profile.id), 0),
            app_count=app_counts.get(str(profile.id), 0),
            company=companies_by_id.get(profile.company_id),
        )
        for profile, user in rows
    ]


def revoke_employer(profile_id: str, admin_user_id: str, db: Session, request: Request | None = None) -> MessageResponse:
    """Revoke a previously approved company: nobody at the company can publish until it is verified again."""
    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer profile not found.")
    company = db.get(Company, profile.company_id) if profile.company_id else None
    user = db.query(User).filter(User.id == profile.user_id).first()

    if company:
        _set_company_verified(company, admin_user_id, db, verified=False, status="unverified")
        for prof in db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id).all():
            prof.rejection_reason = "Approval revoked by admin."
    else:
        profile.is_approved = False
        profile.rejection_reason = "Approval revoked by admin."
    if user:
        user.is_active = False

    core._write_audit(db, admin_user_id, "employer.revoked", resource="employer_profile",
                      resource_id=str(profile.id), previous_value={"is_approved": True},
                      new_value={"is_approved": False}, request=request)
    db.commit()
    return MessageResponse(message=f"'{profile.company_name}' approval revoked.")


def list_employer_jobs_admin(
    employer_id: str,
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> EmployerJobsResponse:
    from app.models.applications import Application

    query = db.query(JobPosting).filter(JobPosting.employer_id == employer_id)
    if active_only:
        query = query.filter(JobPosting.is_active == True)
    if search:
        query = query.filter(JobPosting.title.ilike(f"%{search}%"))

    total = query.count()
    jobs = query.order_by(JobPosting.created_at.desc()).offset(offset).limit(limit).all()

    job_ids = [str(j.id) for j in jobs]
    counts: dict[str, int] = {}
    if job_ids:
        cnt_rows = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        counts = {str(r[0]): r[1] for r in cnt_rows}

    items = [
        EmployerJobEntry(
            id=str(j.id),
            title=j.title,
            sector=j.sector,
            location=j.location,
            is_active=j.is_active,
            applicant_count=counts.get(str(j.id), 0),
            created_at=j.created_at,
        )
        for j in jobs
    ]
    return EmployerJobsResponse(total=total, items=items)


def get_employer_detail(profile_id: str, db: Session) -> EmployerDetailResponse:
    from app.models.applications import Application
    from app.models.employer_verification import EmployerVerification

    profile = db.query(EmployerProfile).filter(EmployerProfile.id == profile_id).first()
    if not profile:
        raise NotFoundException("Employer not found.")
    user = db.query(User).filter(User.id == profile.user_id).first()
    if not user:
        raise NotFoundException("Employer user not found.")

    # Team members — all profiles sharing the same company_id
    if profile.company_id:
        team_rows = (
            db.query(EmployerProfile, User)
            .join(User, EmployerProfile.user_id == User.id)
            .filter(EmployerProfile.company_id == profile.company_id, User.deleted_at == None)
            .order_by(EmployerProfile.is_owner.desc(), EmployerProfile.created_at)
            .all()
        )
        team = [
            EmployerTeamMemberEntry(
                user_id=str(u.id), employer_profile_id=str(p.id),
                full_name=u.full_name, email=u.email, phone=u.phone,
                role_name=u.role_name or "employer", is_owner=p.is_owner,
                is_active=u.is_active, joined_at=p.created_at,
            )
            for p, u in team_rows
        ]
    else:
        team = [EmployerTeamMemberEntry(
            user_id=str(user.id), employer_profile_id=str(profile.id),
            full_name=user.full_name, email=user.email, phone=user.phone,
            role_name=user.role_name or "employer", is_owner=True,
            is_active=user.is_active, joined_at=profile.created_at,
        )]

    # Recent jobs (latest 10)
    job_rows = (
        db.query(JobPosting)
        .filter(JobPosting.employer_id == str(profile.id))
        .order_by(JobPosting.created_at.desc())
        .limit(10)
        .all()
    )
    job_ids = [j.id for j in job_rows]
    app_counts_map: dict = {}
    if job_ids:
        ac = (
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        app_counts_map = {str(jid): cnt for jid, cnt in ac}

    recent_jobs = [
        EmployerJobEntry(
            id=str(j.id), title=j.title, sector=j.sector,
            location=j.location, is_active=j.is_active,
            applicant_count=app_counts_map.get(str(j.id), 0),
            created_at=j.created_at,
        )
        for j in job_rows
    ]

    # Total counts
    job_count = db.query(func.count(JobPosting.id)).filter(JobPosting.employer_id == str(profile.id)).scalar() or 0
    total_app_count = sum(app_counts_map.values()) if app_counts_map else 0

    # Subscription plan
    sub = (
        db.query(CompanySubscription, SubscriptionPlan)
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .filter(CompanySubscription.company_id == profile.company_id)
        .order_by(CompanySubscription.created_at.desc())
        .first()
    ) if profile.company_id else None
    subscription_plan = sub[1].name if sub else None

    # KYC status
    kyc = (
        db.query(EmployerVerification)
        .filter(EmployerVerification.employer_id == str(profile.id))
        .order_by(EmployerVerification.submitted_at.desc())
        .first()
    )

    # Company profile fields (industry, size, website, description) are
    # collected by the post-login setup wizard onto the shared Company row,
    # not onto EmployerProfile — fall back to Company whenever the
    # EmployerProfile's own copy is empty, so admins can see profiles filled
    # in through the current wizard as well as legacy/seeded ones.
    company = db.query(Company).filter(Company.id == profile.company_id).first() if profile.company_id else None

    return EmployerDetailResponse(
        id=str(profile.id), user_id=str(user.id),
        company_name=profile.company_name,
        industry=profile.industry or (company.industry if company else None),
        company_size=profile.company_size or (company.company_size if company else None),
        website=profile.website or (company.website if company else None),
        gst_number=profile.gst_number, contact_person=profile.contact_person,
        designation=profile.designation,
        city=profile.city or (company.headquarters if company else None),
        description=profile.description or (company.description if company else None),
        phone=user.phone,
        phone_verified=user.phone_verified, is_approved=profile.is_approved,
        rejection_reason=profile.rejection_reason, registered_at=profile.created_at,
        job_count=job_count, application_count=total_app_count,
        subscription_plan=subscription_plan,
        team_members=team, recent_jobs=recent_jobs,
        kyc_status=kyc.status if kyc else None,
        kyc_submitted_at=kyc.submitted_at if kyc else None,
    )


def list_employer_verifications(db: Session, status: str | None = None) -> list[EmployerVerificationEntry]:
    query = (
        db.query(EmployerVerification, EmployerProfile)
        .join(EmployerProfile, EmployerVerification.employer_id == EmployerProfile.id)
    )
    if status:
        query = query.filter(EmployerVerification.status == status)
    else:
        query = query.filter(EmployerVerification.status != "draft")   # drafts are the employer's own work-in-progress
    rows = query.order_by(EmployerVerification.submitted_at.desc()).all()

    doc_counts = dict(
        db.query(EmployerVerificationDocument.verification_id, func.count(EmployerVerificationDocument.id))
        .group_by(EmployerVerificationDocument.verification_id)
        .all()
    )

    return [
        EmployerVerificationEntry(
            id=str(v.id), employer_id=str(v.employer_id), company_name=emp.company_name,
            status=v.status, rejection_reason=v.rejection_reason,
            submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
            document_count=doc_counts.get(v.id, 0),
            entity_type=v.entity_type, attempt_no=v.attempt_no or 1, reason_code=v.reason_code,
            failed_checks=sum(1 for c in (v.auto_checks or []) if c.get("level") == "fail"),
        )
        for v, emp in rows
    ]


def get_employer_verification_detail(verification_id: str, db: Session) -> EmployerVerificationDetail:
    from app.core import employer_verification_rules as rules

    v = db.query(EmployerVerification).filter(EmployerVerification.id == verification_id).first()
    if not v:
        raise NotFoundException("Verification not found.")
    emp = db.query(EmployerProfile).filter(EmployerProfile.id == v.employer_id).first()
    user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
    company = db.get(Company, emp.company_id) if emp and emp.company_id else None
    uploaded = {d.doc_type for d in v.documents}
    previous = 0
    if emp and emp.company_id:
        previous = (
            db.query(EmployerVerification)
            .join(EmployerProfile, EmployerVerification.employer_id == EmployerProfile.id)
            .filter(EmployerProfile.company_id == emp.company_id, EmployerVerification.id != v.id,
                    EmployerVerification.status == "rejected")
            .count()
        )

    return EmployerVerificationDetail(
        id=str(v.id), employer_id=str(v.employer_id), company_name=emp.company_name if emp else "-",
        status=v.status, rejection_reason=v.rejection_reason, reviewer_notes=v.reviewer_notes,
        submitted_at=v.submitted_at, reviewed_at=v.reviewed_at,
        document_count=len(v.documents),
        entity_type=v.entity_type, attempt_no=v.attempt_no or 1, reason_code=v.reason_code,
        failed_checks=sum(1 for c in (v.auto_checks or []) if c.get("level") == "fail"),
        info_request=v.info_request, entity_label=rules.ENTITY_LABELS.get(v.entity_type or ""),
        details=v.details, auto_checks=v.auto_checks or [], checklist=rules.checklist(v.entity_type),
        missing=[m for m in rules.missing_items(v.entity_type, v.details or {}, uploaded)
                 if not m.startswith("Please accept")],
        company={
            "name": company.name if company else None, "industry": company.industry if company else None,
            "size": company.company_size if company else None,
            "website": (company.website if company else None) or (emp.website if emp else None),
            "city": (emp.city if emp else None) or (company.headquarters if company else None),
        },
        account_email=user.email if user else None, account_phone=user.phone if user else None,
        email_verified=bool(user.email_verified) if user else False,
        company_status=company.verification_status if company else "unverified",
        previous_attempts=previous, reason_codes=rules.REASON_CODES,
        documents=[
            VerificationDocumentEntry(
                id=str(d.id), doc_type=d.doc_type, label=rules.DOC_LABELS.get(d.doc_type),
                original_filename=d.original_filename, status=d.status,
                notes=d.notes, uploaded_at=d.uploaded_at,
            )
            for d in v.documents
        ],
        events=[
            VerificationEventEntry(
                id=str(e.id), actor_name=(e.actor.email or e.actor.phone) if e.actor else None,
                from_status=e.from_status, to_status=e.to_status, note=e.note, created_at=e.created_at,
            )
            for e in v.events
        ],
    )


_ALLOWED_TRANSITIONS = {
    "under_review": {"requested", "needs_info"},
    "request_info": {"requested", "under_review"},
    "approve": {"requested", "under_review"},
    "reject": {"requested", "under_review", "needs_info"},
}
_TARGET_STATUS = {
    "under_review": "under_review", "request_info": "needs_info", "approve": "approved", "reject": "rejected",
}


def _set_company_verified(company: Company | None, actor_id, db: Session, *, verified: bool, status: str) -> None:
    """Approval belongs to the company: every employer profile (owner, heads, seats) follows it."""
    if not company:
        return
    now = datetime.now(timezone.utc)
    company.verification_status = status
    company.verified_at = now if verified else None
    for prof in db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id).all():
        prof.is_approved = verified
        if verified:
            prof.approved_by = uuid.UUID(str(actor_id))
            prof.approved_at = now
            prof.rejection_reason = None


def review_employer_verification(
    verification_id: str, action: str, notes: str | None, rejection_reason: str | None,
    actor_id: str, db: Session, request: Request | None = None,
    reason_code: str | None = None, info_request: str | None = None, override_checks: bool = False,
) -> EmployerVerificationDetail:
    from app.core import employer_verification_rules as rules
    from app.core.notifications import (
        employer_verification_email,
        employer_verification_needs_info_email,
        notify,
    )

    v = db.query(EmployerVerification).filter(EmployerVerification.id == verification_id).first()
    if not v:
        raise NotFoundException("Verification not found.")
    if action not in _TARGET_STATUS:
        raise ValueError("action must be one of: under_review, request_info, approve, reject")
    if v.status not in _ALLOWED_TRANSITIONS[action]:
        raise ValueError(f"A case that is '{v.status}' cannot be moved with '{action}'.")

    emp = db.query(EmployerProfile).filter(EmployerProfile.id == v.employer_id).first()
    company = db.get(Company, emp.company_id) if emp and emp.company_id else None
    new_status = _TARGET_STATUS[action]
    old_status = v.status

    if action == "request_info" and not (info_request or "").strip():
        raise ValueError("Tell the employer what you need (info_request).")
    if action == "reject":
        if not reason_code or reason_code not in rules.REASON_CODES:
            raise ValueError("Choose a rejection reason code.")
        if not (rejection_reason or "").strip():
            rejection_reason = rules.REASON_CODES[reason_code]
    if action == "approve":
        uploaded = {d.doc_type for d in v.documents}
        gaps = [m for m in rules.missing_items(v.entity_type, v.details or {}, uploaded)
                if not m.startswith("Please accept")]
        if gaps:
            raise ValueError("Cannot approve - missing: " + " ".join(gaps))
        if any(d.status == "rejected" for d in v.documents):
            raise ValueError("Cannot approve while a document is marked rejected. "
                             "Request a replacement or reject the case.")
        failed = [c for c in (v.auto_checks or []) if c.get("level") == "fail"]
        if failed and not (override_checks and (notes or "").strip()):
            raise ValueError("Automatic checks failed (" + "; ".join(c["message"] for c in failed)
                             + "). Resolve them, or approve with override_checks and a written note.")

    v.status = new_status
    v.reviewer_id = uuid.UUID(actor_id)
    v.reviewer_notes = notes or v.reviewer_notes
    if action == "request_info":
        v.info_request = info_request.strip()
    if action == "reject":
        v.rejection_reason, v.reason_code = rejection_reason, reason_code
    if action in ("approve", "reject"):
        v.reviewed_at = datetime.now(timezone.utc)
    if action == "approve":
        v.reason_code = None
        v.rejection_reason = None

    event_note = {"request_info": info_request, "reject": f"[{reason_code}] {rejection_reason}"}.get(action) or notes
    db.add(EmployerVerificationEvent(
        verification_id=v.id, actor_id=uuid.UUID(actor_id),
        from_status=old_status, to_status=new_status, note=event_note,
    ))

    if action == "approve":
        _set_company_verified(company, actor_id, db, verified=True, status="verified")
    elif action == "reject":
        _set_company_verified(company, actor_id, db, verified=False, status="rejected")
    elif action == "request_info" and company:
        company.verification_status = "pending"

    recipient = db.query(User).filter(User.id == emp.user_id).first() if emp else None
    company_name = (company.name if company else None) or (emp.company_name if emp else "your company")
    if recipient and recipient.email:
        if action in ("approve", "reject"):
            subject, html = employer_verification_email(company_name, action == "approve", rejection_reason)
            notify(recipient.email, subject, html)
        elif action == "request_info":
            subject, html = employer_verification_needs_info_email(company_name, info_request.strip())
            notify(recipient.email, subject, html)

    core._write_audit(db, actor_id, "employer_verification.reviewed", resource="employer_verification",
                      resource_id=verification_id, previous_value={"status": old_status},
                      new_value={"status": new_status, "notes": notes, "reason_code": reason_code,
                                 "rejection_reason": rejection_reason, "override_checks": override_checks},
                      request=request)
    db.commit()
    return get_employer_verification_detail(verification_id, db)


def review_verification_document(
    verification_id: str, document_id: str, status: str, notes: str | None,
    actor_id: str, db: Session, request: Request | None = None,
) -> EmployerVerificationDetail:
    doc = (
        db.query(EmployerVerificationDocument)
        .filter(EmployerVerificationDocument.id == document_id,
                EmployerVerificationDocument.verification_id == verification_id)
        .first()
    )
    if not doc:
        raise NotFoundException("Document not found.")
    v = doc.verification
    if v.status not in ("requested", "under_review"):
        raise ValueError("Documents can only be reviewed while the case is in review.")
    if status == "rejected" and not (notes or "").strip():
        raise ValueError("Say what is wrong with this document so the employer can replace it.")
    previous = doc.status
    doc.status, doc.notes = status, (notes or None)
    db.add(EmployerVerificationEvent(
        verification_id=v.id, actor_id=uuid.UUID(actor_id), from_status=v.status, to_status=v.status,
        note=f"Document '{doc.doc_type}' marked {status}" + (f": {notes}" if notes else ""),
    ))
    core._write_audit(db, actor_id, "employer_verification.document_reviewed", resource="employer_verification",
                      resource_id=verification_id, previous_value={"status": previous},
                      new_value={"document": str(doc.id), "status": status, "notes": notes}, request=request)
    db.commit()
    return get_employer_verification_detail(verification_id, db)


def get_verification_document_path(verification_id: str, document_id: str, db: Session):
    """Resolves a verification document to its on-disk path for the admin
    download endpoint — never exposed publicly, only through an authenticated,
    permission-gated route."""
    from app.core.storage import get_path

    doc = (
        db.query(EmployerVerificationDocument)
        .filter(
            EmployerVerificationDocument.id == document_id,
            EmployerVerificationDocument.verification_id == verification_id,
        )
        .first()
    )
    if not doc:
        raise NotFoundException("Document not found.")
    path = get_path(doc.file_url)
    if not path.exists():
        raise NotFoundException("Document file is missing from storage.")
    return path, doc.original_filename


def list_employer_support_tickets(profile_id: str, db: Session) -> dict:
    from app.models.support import SupportTicket
    q = (
        db.query(SupportTicket)
        .filter(SupportTicket.entity_type == "employer", SupportTicket.entity_id == uuid.UUID(profile_id))
        .order_by(SupportTicket.created_at.desc())
    )
    items = q.all()
    return {"total": len(items), "items": [tickets._ticket_to_entry(t) for t in items]}

