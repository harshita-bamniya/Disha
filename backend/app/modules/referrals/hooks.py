"""Session-level hooks that keep referrals in step with applications.

Why hooks and not calls: an application's status is changed from a dozen places (pipeline moves, offers,
interviews, withdrawals, knockout rules). Hooking the ORM means a referral can never drift out of sync
because someone added a thirteenth code path and forgot the referral call.

  * before_flush: if an Application's `status` changed, update its Referral (and create the reward on hire).
    It runs inside the same transaction, so a rolled-back status change leaves the referral untouched.
  * after_commit: send the emails queued during that transaction. after_rollback: drop them.
"""
from __future__ import annotations

import logging

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.models.applications import Application
from app.models.referrals import Referral
from app.modules.referrals import emails, service

logger = logging.getLogger(__name__)
_installed = False


def sync_referral_with_application(session: Session, application: Application) -> None:
    with session.no_autoflush:
        referral = session.query(Referral).filter(Referral.application_id == application.id).first()
        if referral is None:
            return
        new_status = service.referral_status_for(application.status)
        if referral.status == new_status:
            return
        prior, referral.status = referral.status, new_status
        service._event(session, referral, "status_changed", prior, new_status, note=f"Application is now '{application.status}'")
        if new_status != "hired":
            return
        reward = service.create_reward_for_hire(session, referral)
        referrer = referral.referrer
        job_title = referral.job.title if referral.job else "the role"
        detail = f"<strong>{_esc(service._mask_name(referral.candidate_name))}</strong> was hired for <strong>{_esc(job_title)}</strong>. Thank you for the referral."
        if reward is not None:
            detail += f" Your bonus of <strong>{service._money(reward.amount, reward.currency)}</strong> becomes payable on {reward.eligible_on.isoformat()}."
        service._notify_referrer(session, referrer, "referral_hired", "Your referral was hired", detail)


def _esc(text: str) -> str:
    from html import escape
    return escape(text)


def _before_flush(session: Session, flush_context, instances) -> None:
    for obj in list(session.dirty):
        if isinstance(obj, Application) and inspect(obj).attrs.status.history.has_changes():
            try:
                sync_referral_with_application(session, obj)
            except Exception:
                # A referral problem must never block the hiring decision that triggered it.
                logger.exception("[REFERRAL] sync failed for application=%s", getattr(obj, "id", None))


def _after_commit(session: Session) -> None:
    pending = session.info.pop(service._EMAIL_QUEUE, [])
    for to, subject, html in pending:
        try:
            emails.send(to, subject, html)
        except Exception:
            logger.exception("[REFERRAL] could not send email to %s", to)


def _after_rollback(session: Session) -> None:
    session.info.pop(service._EMAIL_QUEUE, None)


def install() -> None:
    global _installed
    if _installed:
        return
    event.listen(Session, "before_flush", _before_flush)
    event.listen(Session, "after_commit", _after_commit)
    event.listen(Session, "after_rollback", _after_rollback)
    _installed = True
