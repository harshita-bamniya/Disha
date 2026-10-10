"""Referral endpoints.

Employer portal (signed in):  /api/employer/referrals/...
Public (no account):          /api/public/referrals/...   (share-link landing + the private referrer page)
"""
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.rbac import require_employer
from app.database import get_db
from app.models.user import User
from app.modules.referrals import hooks, service
from app.modules.referrals.schemas import (
    BulkInviteResult,
    JobConfigUpdate,
    LinkInfo,
    MyReferralsOut,
    NominateRequest,
    OverviewOut,
    ProgramOut,
    ProgramUpdate,
    ReferralJobOut,
    ReferralOut,
    ReferralPage,
    ReferrerBulkInvite,
    ReferrerInvite,
    ReferrerOut,
    ReferrerStatusUpdate,
    RewardOut,
    RewardPay,
    RewardReject,
)

hooks.install()

router = APIRouter(prefix="/employer/referrals", tags=["Employer Referrals"])
public_router = APIRouter(prefix="/public/referrals", tags=["Referrals (public)"])
_limiter = Limiter(key_func=get_remote_address)


# ── program ──────────────────────────────────────────────────────────────────────────────────

@router.get("/program", response_model=ProgramOut)
def get_program(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.get_program_for(user, db)


@router.put("/program", response_model=ProgramOut)
def update_program(body: ProgramUpdate, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.update_program(user, body, db)


@router.get("/overview", response_model=OverviewOut)
def overview(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.overview(user, db)


# ── jobs ─────────────────────────────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[ReferralJobOut])
def list_jobs(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.list_jobs(user, db)


@router.put("/jobs/{job_id}", response_model=ReferralJobOut)
def update_job(job_id: str, body: JobConfigUpdate, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.update_job_config(user, job_id, body, db)


# ── referrers ────────────────────────────────────────────────────────────────────────────────

@router.get("/referrers", response_model=list[ReferrerOut])
def list_referrers(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.list_referrers(user, db)


@router.post("/referrers", response_model=BulkInviteResult, status_code=201)
def invite_referrer(body: ReferrerInvite, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.invite_referrers(user, [body], db)


@router.post("/referrers/bulk", response_model=BulkInviteResult, status_code=201)
def invite_referrers_bulk(body: ReferrerBulkInvite, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.invite_referrers(user, body.people, db)


@router.post("/referrers/{referrer_id}/resend", response_model=ReferrerOut)
def resend_invite(referrer_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.resend_invite(user, referrer_id, db)


@router.patch("/referrers/{referrer_id}", response_model=ReferrerOut)
def set_referrer_status(referrer_id: str, body: ReferrerStatusUpdate, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.set_referrer_status(user, referrer_id, body.status, db)


# ── referrals ────────────────────────────────────────────────────────────────────────────────

@router.get("/referrals", response_model=ReferralPage)
def list_referrals(
    status: str | None = Query(None), job_id: str | None = Query(None), referrer_id: str | None = Query(None),
    q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    user: User = Depends(require_employer), db: Session = Depends(get_db),
):
    return service.list_referrals(user, db, status, job_id, referrer_id, q, page, page_size)


@router.get("/referrals/{referral_id}", response_model=ReferralOut)
def get_referral(referral_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.get_referral(user, referral_id, db)


# ── rewards ──────────────────────────────────────────────────────────────────────────────────

@router.get("/rewards", response_model=list[RewardOut])
def list_rewards(status: str | None = Query(None), user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.list_rewards(user, status, db)


@router.get("/rewards/export")
def export_rewards(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return Response(
        service.export_rewards_csv(user, db), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="referral-rewards.csv"'},
    )


@router.post("/rewards/{reward_id}/approve", response_model=RewardOut)
def approve_reward(reward_id: str, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.approve_reward(user, reward_id, db)


@router.post("/rewards/{reward_id}/pay", response_model=RewardOut)
def pay_reward(reward_id: str, body: RewardPay, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.pay_reward(user, reward_id, body.payment_reference, db)


@router.post("/rewards/{reward_id}/reject", response_model=RewardOut)
def reject_reward(reward_id: str, body: RewardReject, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.reject_reward(user, reward_id, body.reason, body.hire_left, db)


# ── my referrals (any teammate) ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=MyReferralsOut)
def my_referrals(user: User = Depends(require_employer), db: Session = Depends(get_db)):
    return service.my_dashboard(service.ensure_self_referrer(user, db), db)


@router.post("/me/nominate", response_model=MyReferralsOut, status_code=201)
def my_nominate(body: NominateRequest, user: User = Depends(require_employer), db: Session = Depends(get_db)):
    referrer = service.ensure_self_referrer(user, db)
    service.nominate(referrer, body, db)
    return service.my_dashboard(referrer, db)


# ── public ───────────────────────────────────────────────────────────────────────────────────

@public_router.get("/link/{code}/{job_id}", response_model=LinkInfo)
@_limiter.limit("60/minute")
def link_info(request: Request, code: str, job_id: str, db: Session = Depends(get_db)):
    return service.resolve_link(code, job_id, db)


@public_router.get("/portal/{token}", response_model=MyReferralsOut)
@_limiter.limit("30/minute")
def portal(request: Request, token: str, db: Session = Depends(get_db)):
    return service.my_dashboard(service.referrer_by_token(token, db), db)


@public_router.post("/portal/{token}/nominate", response_model=MyReferralsOut, status_code=201)
@_limiter.limit("10/minute;60/hour")
def portal_nominate(request: Request, token: str, body: NominateRequest, db: Session = Depends(get_db)):
    referrer = service.referrer_by_token(token, db)
    service.nominate(referrer, body, db)
    return service.my_dashboard(referrer, db)
