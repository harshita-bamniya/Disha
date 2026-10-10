"""Employee referral program: business rules.

Who can do what
  * Owner / company-wide HR ("admins"): program settings, per-job bonus, the referrer roster, every
    referral and reward, approve/pay/reject.
  * Any teammate with a seat: their own referral link + their own referrals (ensure_self_referrer).
  * An invited employee (no account): the same, through a private link (portal token).
  * A candidate: nothing to do; applying through a link attributes the application.

Rules worth knowing
  * First touch wins: a candidate is attributed to one referrer per job (an earlier nomination beats a link).
  * You cannot refer yourself, and a teammate/referrer cannot be the referred candidate.
  * The bonus amount is a snapshot taken at hire time. It becomes payable `hold_days` after the hire.
  * Referral status follows the application automatically (see hooks.py), never by hand.
"""
from __future__ import annotations

import csv
import io
import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from html import escape
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.security import hash_token
from app.models.applications import Application
from app.models.company import Company, CompanyDepartment
from app.models.referrals import (
    Referral,
    ReferralEvent,
    ReferralJobConfig,
    ReferralProgram,
    ReferralReward,
    Referrer,
)
from app.models.user import EmployerProfile, JobPosting, User
from app.modules.inbox.service import create_notification
from app.modules.referrals import emails
from app.modules.referrals.schemas import (
    JobConfigUpdate,
    NominateRequest,
    ProgramUpdate,
    ReferrerInvite,
)

logger = logging.getLogger(__name__)

_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # no 0/O/1/I/L lookalikes
NOMINATIONS_PER_DAY = 20                              # per referrer; stops a leaked link being used to mail-bomb
_EMAIL_QUEUE = "referral_emails"

# Application status -> referral status
_APP_TO_REFERRAL = {
    "applied": "applied", "under_review": "applied",
    "hired": "hired",
    "rejected": "rejected", "offer_declined": "rejected",
    "withdrawn": "withdrawn",
}


def referral_status_for(application_status: str) -> str:
    return _APP_TO_REFERRAL.get(application_status, "in_process")


# ── small helpers ────────────────────────────────────────────────────────────────────────────

def _uuid_or_404(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError):
        raise NotFoundException(f"{what} not found.") from None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm_email(email: Optional[str]) -> Optional[str]:
    return email.strip().lower() if email and email.strip() else None


def _money(amount: int, currency: str = "INR") -> str:
    symbol = "₹" if currency == "INR" else f"{currency} "
    return f"{symbol}{amount:,}"


def _link(path: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}{path}"


def share_url(code: str, job_id) -> str:
    return _link(f"/r/{code}/{job_id}")


def portal_url(raw_token: str) -> str:
    return _link(f"/referrer/{raw_token}")


def _new_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
        if not db.query(Referrer.id).filter(Referrer.code == code).first():
            return code
    raise RuntimeError("Could not allocate a unique referral code")


def queue_email(db: Session, to: Optional[str], subject: str, html: str) -> None:
    """Hold an email until the transaction that caused it commits (hooks.py sends it), so a rolled-back
    change never emails anyone."""
    if to:
        db.info.setdefault(_EMAIL_QUEUE, []).append((to, subject, html))


def candidate_name_of(user: Optional[User]) -> Optional[str]:
    if not user:
        return None
    prof = getattr(user, "aspirant_profile", None)
    return (prof.full_name if prof and prof.full_name else None) or user.full_name or None


def _mask_name(name: Optional[str]) -> str:
    """'Priya Sharma' -> 'Priya S.' (what a referrer sees; the full identity stays with the employer)."""
    parts = (name or "").split()
    if not parts:
        return "Candidate"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def _event(db: Session, referral: Referral, event: str, frm=None, to=None, actor: Optional[User] = None, note=None) -> None:
    db.add(ReferralEvent(
        referral_id=referral.id, event=event, from_value=frm, to_value=to,
        actor_user_id=actor.id if actor else None, note=note,
    ))


# ── identity / permission ────────────────────────────────────────────────────────────────────

def _profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile or not profile.company_id:
        raise NotFoundException("No company is associated with this account.")
    return profile


def _admin_ctx(user: User, db: Session) -> tuple[EmployerProfile, Company]:
    """Program administration: the owner or company-wide HR. Department-scoped members are not admins."""
    profile = _profile(user, db)
    company_wide = profile.is_owner or (user.role_name == "hr_manager" and profile.department_id is None)
    if not company_wide:
        raise ForbiddenException("Only the company owner or HR manager can manage the referral program.")
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise NotFoundException("Company not found.")
    return profile, company


def _member_ctx(user: User, db: Session) -> tuple[EmployerProfile, Company]:
    profile = _profile(user, db)
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise NotFoundException("Company not found.")
    return profile, company


def _referrer_is_usable(referrer: Referrer, db: Session) -> bool:
    """Active, and (for a teammate) their account still works: removing a teammate must stop their link."""
    if referrer.status != "active":
        return False
    if referrer.employer_profile_id:
        owner = (
            db.query(User.is_active, User.deleted_at)
            .join(EmployerProfile, EmployerProfile.user_id == User.id)
            .filter(EmployerProfile.id == referrer.employer_profile_id)
            .first()
        )
        return bool(owner and owner[0] and owner[1] is None)
    return True


# ── program + per-job settings ───────────────────────────────────────────────────────────────

def get_program(company_id, db: Session) -> ReferralProgram:
    program = db.query(ReferralProgram).filter(ReferralProgram.company_id == company_id).first()
    if not program:
        program = ReferralProgram(company_id=company_id)
        db.add(program)
        db.flush()
    return program


def get_program_for(user: User, db: Session) -> ReferralProgram:
    _, company = _member_ctx(user, db)
    program = get_program(company.id, db)
    db.commit()
    return program


def update_program(user: User, body: ProgramUpdate, db: Session) -> ReferralProgram:
    _, company = _admin_ctx(user, db)
    program = get_program(company.id, db)
    data = body.model_dump(exclude_unset=True)
    for field in ("is_enabled", "default_bonus_amount", "hold_days", "terms"):
        if field in data and data[field] is not None:
            setattr(program, field, data[field])
    if "terms" in data and data["terms"] is None:
        program.terms = None
    program.updated_by = user.id
    db.commit()
    db.refresh(program)
    return program


def _company_job_filter(company_id, db: Session):
    emp_ids = [r[0] for r in db.query(EmployerProfile.id).filter(EmployerProfile.company_id == company_id).all()]
    return or_(JobPosting.company_id == company_id, JobPosting.employer_id.in_(emp_ids or [None]))


def _open_jobs_query(company_id, db: Session):
    today = date.today()
    return (
        db.query(JobPosting)
        .filter(
            _company_job_filter(company_id, db),
            JobPosting.status == "published",
            JobPosting.is_active == True,  # noqa: E712
            or_(JobPosting.expires_at == None, JobPosting.expires_at >= today),  # noqa: E711
        )
    )


def _job_configs(company_id, db: Session) -> dict:
    return {c.job_id: c for c in db.query(ReferralJobConfig).filter(ReferralJobConfig.company_id == company_id).all()}


def effective_bonus(program: ReferralProgram, config: Optional[ReferralJobConfig]) -> int:
    return config.bonus_amount if (config and config.bonus_amount is not None) else program.default_bonus_amount


def job_is_referrable(job: JobPosting, config: Optional[ReferralJobConfig]) -> bool:
    if job.status != "published" or not job.is_active:
        return False
    if job.expires_at and job.expires_at < date.today():
        return False
    return config is None or config.is_open


def list_jobs(user: User, db: Session) -> list[dict]:
    _, company = _admin_ctx(user, db)
    program = get_program(company.id, db)
    configs = _job_configs(company.id, db)
    jobs = _open_jobs_query(company.id, db).order_by(JobPosting.created_at.desc()).all()
    counts = {
        jid: (total, hired)
        for jid, total, hired in db.query(
            Referral.job_id, func.count(Referral.id), func.count(Referral.id).filter(Referral.status == "hired"),
        ).filter(Referral.company_id == company.id).group_by(Referral.job_id).all()
    }
    dept_names = {
        d.id: d.name for d in db.query(CompanyDepartment).filter(CompanyDepartment.company_id == company.id).all()
    }
    out = []
    for j in jobs:
        cfg = configs.get(j.id)
        total, hired = counts.get(j.id, (0, 0))
        out.append({
            "job_id": str(j.id), "title": j.title, "location": j.location,
            "department": dept_names.get(j.department_id),
            "is_open": cfg.is_open if cfg else True,
            "bonus_amount": effective_bonus(program, cfg),
            "has_override": bool(cfg and cfg.bonus_amount is not None),
            "referral_count": total, "hired_count": hired,
        })
    db.commit()
    return out


def update_job_config(user: User, job_id: str, body: JobConfigUpdate, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    job = db.query(JobPosting).filter(
        JobPosting.id == _uuid_or_404(job_id, "Job"), _company_job_filter(company.id, db),
    ).first()
    if not job:
        raise NotFoundException("Job not found.")
    cfg = db.query(ReferralJobConfig).filter(ReferralJobConfig.job_id == job.id).first()
    if not cfg:
        cfg = ReferralJobConfig(job_id=job.id, company_id=company.id, is_open=True)
        db.add(cfg)
    if body.is_open is not None:
        cfg.is_open = body.is_open
    if body.clear_bonus:
        cfg.bonus_amount = None
    elif body.bonus_amount is not None:
        cfg.bonus_amount = body.bonus_amount
    db.commit()
    return next((j for j in list_jobs(user, db) if j["job_id"] == str(job.id)), {
        "job_id": str(job.id), "title": job.title, "location": job.location, "department": None,
        "is_open": cfg.is_open, "bonus_amount": effective_bonus(get_program(company.id, db), cfg),
        "has_override": cfg.bonus_amount is not None, "referral_count": 0, "hired_count": 0,
    })


# ── referrers ────────────────────────────────────────────────────────────────────────────────

def ensure_self_referrer(user: User, db: Session) -> Referrer:
    """A teammate's own referrer record, created on first use (their link works immediately)."""
    profile, company = _member_ctx(user, db)
    ref = db.query(Referrer).filter(Referrer.employer_profile_id == profile.id).first()
    if ref:
        return ref
    email = _norm_email(user.email)
    if not email:
        raise BadRequestException("Add an email address to your account to use referrals.")
    # A teammate who was first added as an invited employee keeps the same code and history.
    ref = db.query(Referrer).filter(Referrer.company_id == company.id, Referrer.email == email).first()
    if ref:
        ref.employer_profile_id = profile.id
    else:
        ref = Referrer(
            company_id=company.id, employer_profile_id=profile.id, email=email,
            name=profile.contact_person or user.full_name or email.split("@")[0], code=_new_code(db),
        )
        db.add(ref)
    db.commit()
    db.refresh(ref)
    return ref


def _issue_portal_token(ref: Referrer) -> str:
    raw = secrets.token_urlsafe(32)
    ref.token_hash = hash_token(raw)
    ref.last_sent_at = _now()
    return raw


def _send_invite(ref: Referrer, company: Company, program: ReferralProgram, raw_token: str, db: Session) -> None:
    bonus = _money(program.default_bonus_amount, program.currency) if program.default_bonus_amount else None
    subject, html = emails.referrer_invite_email(company.name, ref.name, portal_url(raw_token), bonus)
    queue_email(db, ref.email, subject, html)


def invite_referrers(user: User, people: list[ReferrerInvite], db: Session) -> dict:
    profile, company = _admin_ctx(user, db)
    program = get_program(company.id, db)
    added, skipped, seen = [], [], set()
    for p in people:
        email = _norm_email(p.email)
        if email in seen:
            skipped.append({"email": email, "reason": "Listed more than once."})
            continue
        seen.add(email)
        if db.query(Referrer.id).filter(Referrer.company_id == company.id, Referrer.email == email).first():
            skipped.append({"email": email, "reason": "Already in the program."})
            continue
        # A person on the team already has a link of their own; adding them again would split their history.
        teammate = (
            db.query(User.id).join(EmployerProfile, EmployerProfile.user_id == User.id)
            .filter(EmployerProfile.company_id == company.id, func.lower(User.email) == email).first()
        )
        ref = Referrer(company_id=company.id, name=p.name.strip(), email=email, code=_new_code(db), invited_by=user.id)
        if teammate:
            ref.employer_profile_id = db.query(EmployerProfile.id).filter(EmployerProfile.user_id == teammate[0]).scalar()
        db.add(ref)
        db.flush()
        if not teammate:
            _send_invite(ref, company, program, _issue_portal_token(ref), db)
        added.append(ref)
    db.commit()
    return {"added": [referrer_row(r, db) for r in added], "skipped": skipped}


def resend_invite(user: User, referrer_id: str, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    ref = _get_referrer(company.id, referrer_id, db)
    if ref.employer_profile_id:
        raise BadRequestException("Teammates use their own referrals page; there is no private link to resend.")
    if ref.status != "active":
        raise BadRequestException("Re-enable this person before sending a new link.")
    _send_invite(ref, company, get_program(company.id, db), _issue_portal_token(ref), db)
    db.commit()
    return referrer_row(ref, db)


def set_referrer_status(user: User, referrer_id: str, status: str, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    ref = _get_referrer(company.id, referrer_id, db)
    ref.status = status
    db.commit()
    return referrer_row(ref, db)


def _get_referrer(company_id, referrer_id: str, db: Session) -> Referrer:
    ref = db.query(Referrer).filter(
        Referrer.id == _uuid_or_404(referrer_id, "Referrer"), Referrer.company_id == company_id,
    ).first()
    if not ref:
        raise NotFoundException("Referrer not found.")
    return ref


def referrer_row(ref: Referrer, db: Session) -> dict:
    total, hired = db.query(
        func.count(Referral.id), func.count(Referral.id).filter(Referral.status == "hired"),
    ).filter(Referral.referrer_id == ref.id).one()
    earned = db.query(func.coalesce(func.sum(ReferralReward.amount), 0)).filter(
        ReferralReward.referrer_id == ref.id, ReferralReward.status.in_(("approved", "paid")),
    ).scalar()
    return {
        "id": str(ref.id), "name": ref.name, "email": ref.email, "status": ref.status,
        "is_teammate": ref.employer_profile_id is not None,
        "referral_count": total, "hired_count": hired, "earned_amount": int(earned or 0),
        "last_sent_at": ref.last_sent_at, "created_at": ref.created_at,
    }


def list_referrers(user: User, db: Session) -> list[dict]:
    _, company = _admin_ctx(user, db)
    refs = db.query(Referrer).filter(Referrer.company_id == company.id).order_by(Referrer.created_at.desc()).all()
    return [referrer_row(r, db) for r in refs]


# ── attribution (called while an application is being submitted) ─────────────────────────────

def attribute_application(db: Session, application: Application, job: JobPosting, user: User, code: Optional[str]) -> Optional[Referral]:
    """Link a freshly created application to the referrer who sent the candidate. Never raises into the
    caller: a referral problem must not cost a candidate their application (it logs and returns None)."""
    try:
        with db.begin_nested():
            return _attribute(db, application, job, user, code)
    except Exception:
        logger.exception("[REFERRAL] attribution failed for application=%s", application.id)
        return None


def _attribute(db: Session, application: Application, job: JobPosting, user: User, code: Optional[str]) -> Optional[Referral]:
    company_id = job.company_id or db.query(EmployerProfile.company_id).filter(EmployerProfile.id == job.employer_id).scalar()
    if not company_id:
        return None
    program = db.query(ReferralProgram).filter(ReferralProgram.company_id == company_id).first()
    if not program or not program.is_enabled:
        return None
    cfg = db.query(ReferralJobConfig).filter(ReferralJobConfig.job_id == job.id).first()
    if cfg is not None and not cfg.is_open:
        return None

    email = _norm_email(user.email)

    # Earlier claim wins: someone who already nominated this person for this job keeps the credit.
    referral = None
    if email:
        referral = (
            db.query(Referral)
            .filter(Referral.job_id == job.id, Referral.candidate_email == email, Referral.application_id.is_(None))
            .order_by(Referral.created_at)
            .first()
        )
    referrer = db.query(Referrer).filter(Referrer.id == referral.referrer_id).first() if referral else None
    if referrer is None and code:
        referrer = db.query(Referrer).filter(Referrer.code == code.strip().upper(), Referrer.company_id == company_id).first()
    if referrer is None or not _referrer_is_usable(referrer, db):
        return None
    if _is_self(referrer, user, email, db):
        return None

    name = candidate_name_of(user)
    status = referral_status_for(application.status)
    if referral is None:
        referral = Referral(
            company_id=company_id, job_id=job.id, referrer_id=referrer.id, source="link",
            candidate_user_id=user.id, candidate_name=name, candidate_email=email,
        )
        db.add(referral)
        db.flush()
        _event(db, referral, "created", to="link", note="Applied through a referral link")
    else:
        referral.candidate_user_id = user.id
        referral.candidate_name = name or referral.candidate_name
    referral.application_id = application.id
    prior = referral.status
    referral.status = status
    _event(db, referral, "status_changed", prior if prior != status else None, status, note="Candidate applied")
    _notify_referrer_applied(db, referral, referrer, job, company_id)
    return referral


def _is_self(referrer: Referrer, user: User, email: Optional[str], db: Session) -> bool:
    if email and referrer.email == email:
        return True
    if referrer.employer_profile_id:
        owner_id = db.query(EmployerProfile.user_id).filter(EmployerProfile.id == referrer.employer_profile_id).scalar()
        return owner_id == user.id
    return False


def _notify_referrer_applied(db: Session, referral: Referral, referrer: Referrer, job: JobPosting, company_id) -> None:
    who = _mask_name(referral.candidate_name)
    _notify_referrer(
        db, referrer, "referral_applied", f"{who} applied for {job.title}",
        f"{escape(who)} applied for <strong>{escape(job.title)}</strong> after your referral.",
    )


def _notify_referrer(db: Session, referrer: Referrer, type_: str, headline: str, detail_html: str) -> None:
    """In-app bell for teammates, email for everyone (invited employees have no inbox)."""
    link_path = "/app/employer/referrals"
    if referrer.employer_profile_id:
        uid = db.query(EmployerProfile.user_id).filter(EmployerProfile.id == referrer.employer_profile_id).scalar()
        if uid:
            create_notification(db, uid, type_, headline, None, link_path)
        link = _link(link_path)
    else:
        link = None   # the portal URL carries a secret and is only emailed at invite/resend time
    subject, html = emails.referral_update_email(referrer.name, headline, detail_html, link)
    queue_email(db, referrer.email, subject, html)


# ── nominations ("I know someone for this role") ─────────────────────────────────────────────

def nominate(referrer: Referrer, body: NominateRequest, db: Session) -> Referral:
    if not _referrer_is_usable(referrer, db):
        raise ForbiddenException("This referral link is no longer active.")
    company = db.query(Company).filter(Company.id == referrer.company_id).first()
    program = get_program(referrer.company_id, db)
    if not program.is_enabled:
        raise BadRequestException("The referral program is not running right now.")
    job_uuid = _uuid_or_404(body.job_id, "Job")
    job = _open_jobs_query(referrer.company_id, db).filter(JobPosting.id == job_uuid).first()
    cfg = db.query(ReferralJobConfig).filter(ReferralJobConfig.job_id == job_uuid).first()
    if not job or not job_is_referrable(job, cfg):
        raise BadRequestException("That job is not open for referrals.")

    email = _norm_email(body.candidate_email)
    if email == referrer.email:
        raise BadRequestException("You can't refer yourself.")
    if db.query(Referral.id).filter(Referral.job_id == job.id, Referral.candidate_email == email).first():
        raise ConflictException("Someone has already referred this person for this job.")
    existing_user = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_user and db.query(Application.id).filter(
        Application.aspirant_id == existing_user.id, Application.job_id == job.id,
    ).first():
        raise ConflictException("This person has already applied for this job.")

    since = _now() - timedelta(days=1)
    sent_today = db.query(func.count(Referral.id)).filter(
        Referral.referrer_id == referrer.id, Referral.source == "nomination", Referral.created_at >= since,
    ).scalar()
    if sent_today >= NOMINATIONS_PER_DAY:
        raise BadRequestException(f"You can refer up to {NOMINATIONS_PER_DAY} people a day. Try again tomorrow.")

    referral = Referral(
        company_id=referrer.company_id, job_id=job.id, referrer_id=referrer.id, source="nomination",
        candidate_name=body.candidate_name.strip(), candidate_email=email, note=(body.note or "").strip() or None,
        status="invited",
    )
    db.add(referral)
    db.flush()
    _event(db, referral, "created", to="nomination", note="Referred by email")
    subject, html = emails.nomination_email(
        referral.candidate_name, referrer.name, company.name, job.title,
        share_url(referrer.code, job.id), referral.note,
    )
    queue_email(db, email, subject, html)
    db.commit()
    db.refresh(referral)
    return referral


# ── hire -> reward, and the reward lifecycle ─────────────────────────────────────────────────

def create_reward_for_hire(db: Session, referral: Referral) -> Optional[ReferralReward]:
    """Called (from hooks.py) the moment a referred application becomes 'hired'."""
    if db.query(ReferralReward.id).filter(ReferralReward.referral_id == referral.id).first():
        return None
    # Plain query, not get_program(): this runs inside a flush, where creating a row would re-enter it.
    program = db.query(ReferralProgram).filter(ReferralProgram.company_id == referral.company_id).first()
    if program is None:
        return None
    cfg = db.query(ReferralJobConfig).filter(ReferralJobConfig.job_id == referral.job_id).first()
    amount = effective_bonus(program, cfg)
    if amount <= 0:
        return None   # recognition-only: the hire is recorded, nothing is owed
    now = _now()
    eligible_on = date.today() + timedelta(days=program.hold_days)
    reward = ReferralReward(
        referral_id=referral.id, company_id=referral.company_id, referrer_id=referral.referrer_id,
        amount=amount, currency=program.currency, hired_at=now, eligible_on=eligible_on,
        status="eligible" if program.hold_days == 0 else "pending",
    )
    db.add(reward)
    _event(db, referral, "reward_created", to=reward.status,
           note=f"{_money(amount, program.currency)}, payable from {eligible_on.isoformat()}")
    return reward


def refresh_rewards(db: Session, company_id=None) -> list[ReferralReward]:
    """pending -> eligible once the retention period has passed. Returns the rewards that just changed."""
    q = db.query(ReferralReward).filter(ReferralReward.status == "pending", ReferralReward.eligible_on <= date.today())
    if company_id is not None:
        q = q.filter(ReferralReward.company_id == company_id)
    changed = q.all()
    for r in changed:
        r.status = "eligible"
        _event(db, r.referral, "reward_eligible", "pending", "eligible", note="Retention period completed")
    return changed


def _get_reward(company_id, reward_id: str, db: Session) -> ReferralReward:
    reward = db.query(ReferralReward).filter(
        ReferralReward.id == _uuid_or_404(reward_id, "Reward"), ReferralReward.company_id == company_id,
    ).first()
    if not reward:
        raise NotFoundException("Reward not found.")
    return reward


def _reward_row(r: ReferralReward) -> dict:
    ref = r.referral
    return {
        "id": str(r.id), "referral_id": str(r.referral_id), "referrer_name": r.referrer.name,
        "candidate_name": ref.candidate_name if ref else None,
        "job_title": ref.job.title if ref and ref.job else "",
        "amount": r.amount, "currency": r.currency, "status": r.status, "hired_at": r.hired_at,
        "eligible_on": r.eligible_on, "paid_at": r.paid_at, "payment_reference": r.payment_reference, "note": r.note,
    }


def list_rewards(user: User, status: Optional[str], db: Session) -> list[dict]:
    _, company = _admin_ctx(user, db)
    refresh_rewards(db, company.id)
    db.commit()
    q = db.query(ReferralReward).filter(ReferralReward.company_id == company.id)
    if status:
        q = q.filter(ReferralReward.status == status)
    return [_reward_row(r) for r in q.order_by(ReferralReward.created_at.desc()).all()]


def export_rewards_csv(user: User, db: Session) -> str:
    rows = list_rewards(user, None, db)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Referrer", "Candidate", "Job", "Amount", "Currency", "Status", "Hired on", "Payable from", "Paid on", "Payment reference"])
    for r in rows:
        # A spreadsheet runs a cell starting with = + - @ as a formula; names come from outside, so defuse that.
        w.writerow([
            _csv_safe(r["referrer_name"]), _csv_safe(r["candidate_name"] or ""), _csv_safe(r["job_title"]),
            r["amount"], r["currency"], r["status"], r["hired_at"].date().isoformat(), r["eligible_on"].isoformat(),
            r["paid_at"].date().isoformat() if r["paid_at"] else "", _csv_safe(r["payment_reference"] or ""),
        ])
    return buf.getvalue()


def _csv_safe(value: str) -> str:
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def approve_reward(user: User, reward_id: str, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    refresh_rewards(db, company.id)
    reward = _get_reward(company.id, reward_id, db)
    if reward.status == "pending":
        raise BadRequestException(f"Not payable yet: the retention period ends on {reward.eligible_on.isoformat()}.")
    if reward.status != "eligible":
        raise BadRequestException(f"This reward is already {reward.status}.")
    reward.status, reward.decided_by, reward.decided_at = "approved", user.id, _now()
    _event(db, reward.referral, "reward_approved", "eligible", "approved", user)
    _notify_referrer(db, reward.referrer, "referral_reward_approved", "Your referral bonus is approved",
                     f"Your bonus of <strong>{_money(reward.amount, reward.currency)}</strong> has been approved and will be paid out by {escape(company.name)}.")
    db.commit()
    return _reward_row(reward)


def pay_reward(user: User, reward_id: str, payment_reference: Optional[str], db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    reward = _get_reward(company.id, reward_id, db)
    if reward.status != "approved":
        raise BadRequestException("Approve the reward before marking it paid.")
    reward.status, reward.paid_at = "paid", _now()
    reward.payment_reference = (payment_reference or "").strip() or None
    _event(db, reward.referral, "reward_paid", "approved", "paid", user, reward.payment_reference)
    _notify_referrer(db, reward.referrer, "referral_reward_paid", "Your referral bonus has been paid",
                     f"<strong>{_money(reward.amount, reward.currency)}</strong> has been paid to you by {escape(company.name)}.")
    db.commit()
    return _reward_row(reward)


def reject_reward(user: User, reward_id: str, reason: str, hire_left: bool, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    reward = _get_reward(company.id, reward_id, db)
    if reward.status in ("paid", "rejected", "cancelled"):
        raise BadRequestException(f"This reward is already {reward.status}.")
    new = "cancelled" if hire_left else "rejected"
    prior = reward.status
    reward.status, reward.decided_by, reward.decided_at, reward.note = new, user.id, _now(), reason.strip()
    _event(db, reward.referral, f"reward_{new}", prior, new, user, reason.strip())
    _notify_referrer(db, reward.referrer, "referral_reward_declined", "Update on your referral bonus",
                     f"The bonus for a recent referral was not approved. Reason: {escape(reason.strip())}")
    db.commit()
    return _reward_row(reward)


# ── lists + overview (admin) ─────────────────────────────────────────────────────────────────

def _referral_row(r: Referral, with_events: bool = False, db: Optional[Session] = None) -> dict:
    row = {
        "id": str(r.id), "job_id": str(r.job_id), "job_title": r.job.title if r.job else "",
        "referrer_id": str(r.referrer_id), "referrer_name": r.referrer.name,
        "candidate_name": r.candidate_name, "candidate_email": r.candidate_email,
        "source": r.source, "status": r.status,
        "application_id": str(r.application_id) if r.application_id else None, "note": r.note,
        "reward_status": r.reward.status if r.reward else None,
        "reward_amount": r.reward.amount if r.reward else None, "created_at": r.created_at, "events": [],
    }
    if with_events:
        actors = {}
        for e in r.events:
            if e.actor_user_id and e.actor_user_id not in actors and db is not None:
                u = db.query(User).filter(User.id == e.actor_user_id).first()
                actors[e.actor_user_id] = (candidate_name_of(u) or (u.email if u else None)) if u else None
            row["events"].append({
                "event": e.event, "from_value": e.from_value, "to_value": e.to_value, "note": e.note,
                "actor": actors.get(e.actor_user_id), "created_at": e.created_at,
            })
    return row


def list_referrals(
    user: User, db: Session, status: Optional[str] = None, job_id: Optional[str] = None,
    referrer_id: Optional[str] = None, q: Optional[str] = None, page: int = 1, page_size: int = 25,
) -> dict:
    _, company = _admin_ctx(user, db)
    query = db.query(Referral).filter(Referral.company_id == company.id)
    if status:
        query = query.filter(Referral.status == status)
    if job_id:
        query = query.filter(Referral.job_id == job_id)
    if referrer_id:
        query = query.filter(Referral.referrer_id == referrer_id)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(or_(func.lower(Referral.candidate_name).like(like), func.lower(Referral.candidate_email).like(like)))
    total = query.count()
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows = query.order_by(Referral.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_referral_row(r) for r in rows], "total": total, "page": page, "page_size": page_size}


def get_referral(user: User, referral_id: str, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    r = db.query(Referral).filter(
        Referral.id == _uuid_or_404(referral_id, "Referral"), Referral.company_id == company.id,
    ).first()
    if not r:
        raise NotFoundException("Referral not found.")
    return _referral_row(r, with_events=True, db=db)


def overview(user: User, db: Session) -> dict:
    _, company = _admin_ctx(user, db)
    refresh_rewards(db, company.id)
    db.commit()
    program = get_program(company.id, db)
    cid = company.id

    by_status = {s: n for s, n in db.query(Referral.status, func.count(Referral.id)).filter(Referral.company_id == cid).group_by(Referral.status).all()}
    total = sum(by_status.values())
    applied = total - by_status.get("invited", 0)
    hires = by_status.get("hired", 0)

    rewards = {s: {"count": 0, "amount": 0} for s in ("pending", "eligible", "approved", "paid", "rejected", "cancelled")}
    for s, n, amt in db.query(ReferralReward.status, func.count(ReferralReward.id), func.coalesce(func.sum(ReferralReward.amount), 0)) \
            .filter(ReferralReward.company_id == cid).group_by(ReferralReward.status).all():
        rewards[s] = {"count": n, "amount": int(amt)}

    leaders = []
    for ref_id, name, n, h in (
        db.query(Referrer.id, Referrer.name, func.count(Referral.id), func.count(Referral.id).filter(Referral.status == "hired"))
        .join(Referral, Referral.referrer_id == Referrer.id).filter(Referrer.company_id == cid)
        .group_by(Referrer.id, Referrer.name)
        .order_by(func.count(Referral.id).filter(Referral.status == "hired").desc(), func.count(Referral.id).desc()).limit(5).all()
    ):
        earned = db.query(func.coalesce(func.sum(ReferralReward.amount), 0)).filter(
            ReferralReward.referrer_id == ref_id, ReferralReward.status.in_(("approved", "paid"))).scalar()
        leaders.append({"referrer_id": str(ref_id), "name": name, "referrals": n, "hires": h, "earned_amount": int(earned or 0)})

    top_jobs = [
        {"job_id": str(j), "title": t, "referrals": n, "hires": h}
        for j, t, n, h in db.query(JobPosting.id, JobPosting.title, func.count(Referral.id), func.count(Referral.id).filter(Referral.status == "hired"))
        .join(Referral, Referral.job_id == JobPosting.id).filter(Referral.company_id == cid)
        .group_by(JobPosting.id, JobPosting.title).order_by(func.count(Referral.id).desc()).limit(5).all()
    ]
    return {
        "program_enabled": program.is_enabled,
        "referrers": db.query(func.count(Referrer.id)).filter(Referrer.company_id == cid).scalar(),
        "referrals": total, "by_status": by_status, "hires": hires,
        "conversion_rate": round(hires / applied, 4) if applied else 0.0,
        "rewards_by_status": rewards, "top_referrers": leaders, "top_jobs": top_jobs,
    }


# ── the referrer's own view (teammate or invited employee) ───────────────────────────────────

def my_dashboard(referrer: Referrer, db: Session) -> dict:
    company = db.query(Company).filter(Company.id == referrer.company_id).first()
    program = get_program(referrer.company_id, db)
    refresh_rewards(db, referrer.company_id)
    db.commit()
    configs = _job_configs(referrer.company_id, db)
    usable = program.is_enabled and _referrer_is_usable(referrer, db)

    jobs = []
    if usable:
        for j in _open_jobs_query(referrer.company_id, db).order_by(JobPosting.created_at.desc()).all():
            cfg = configs.get(j.id)
            if job_is_referrable(j, cfg):
                jobs.append({
                    "job_id": str(j.id), "title": j.title, "location": j.location,
                    "bonus_amount": effective_bonus(program, cfg), "share_url": share_url(referrer.code, j.id),
                })

    rows = db.query(Referral).filter(Referral.referrer_id == referrer.id).order_by(Referral.created_at.desc()).limit(200).all()
    referrals = [{
        "id": str(r.id), "candidate": _mask_name(r.candidate_name), "job_title": r.job.title if r.job else "",
        "status": r.status, "source": r.source, "reward_status": r.reward.status if r.reward else None,
        "reward_amount": r.reward.amount if r.reward else None, "created_at": r.created_at,
    } for r in rows]

    sums = {s: int(a) for s, a in db.query(ReferralReward.status, func.coalesce(func.sum(ReferralReward.amount), 0))
            .filter(ReferralReward.referrer_id == referrer.id).group_by(ReferralReward.status).all()}
    return {
        "company_name": company.name, "referrer_name": referrer.name, "program_enabled": usable,
        "currency": program.currency, "hold_days": program.hold_days, "terms": program.terms,
        "jobs": jobs, "referrals": referrals,
        "totals": {
            "referred": len(rows), "hired": sum(1 for r in rows if r.status == "hired"),
            "pending_amount": sums.get("pending", 0), "payable_amount": sums.get("eligible", 0) + sums.get("approved", 0),
            "paid_amount": sums.get("paid", 0),
        },
    }


def referrer_by_token(token: str, db: Session) -> Referrer:
    ref = db.query(Referrer).filter(Referrer.token_hash == hash_token(token)).first() if token else None
    if not ref or not _referrer_is_usable(ref, db):
        raise NotFoundException("This referral page is not available. Ask your HR team for a new link.")
    return ref


# ── public landing for a share link ──────────────────────────────────────────────────────────

def resolve_link(code: str, job_id: str, db: Session) -> dict:
    """What the landing page shows. Reveals nothing beyond the job and the referrer's first name."""
    invalid = {"valid": False}
    ref = db.query(Referrer).filter(Referrer.code == (code or "").strip().upper()).first()
    if not ref or not _referrer_is_usable(ref, db):
        return invalid
    program = db.query(ReferralProgram).filter(ReferralProgram.company_id == ref.company_id).first()
    if not program or not program.is_enabled:
        return invalid
    try:
        job_uuid = uuid.UUID(str(job_id))
    except ValueError:
        return invalid
    job = _open_jobs_query(ref.company_id, db).filter(JobPosting.id == job_uuid).first()
    cfg = db.query(ReferralJobConfig).filter(ReferralJobConfig.job_id == job_uuid).first() if job else None
    if not job or not job_is_referrable(job, cfg):
        return invalid
    company = db.query(Company).filter(Company.id == ref.company_id).first()
    return {
        "valid": True, "job_title": job.title, "company_name": company.name if company else None,
        "location": job.location, "referrer_first_name": (ref.name.split() or [""])[0],
    }
