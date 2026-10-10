"""Referral reward housekeeping."""
import logging

from app.tasks.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.referral_tasks.release_referral_rewards")
def release_referral_rewards() -> dict:
    """Daily: rewards whose retention period has ended become payable, and the company's owner is told
    (once, because each reward moves pending -> eligible only once)."""
    from app.database import SessionLocal
    from app.models.user import EmployerProfile
    from app.modules.inbox.service import create_notification
    from app.modules.referrals import hooks, service

    hooks.install()
    db = SessionLocal()
    try:
        changed = service.refresh_rewards(db)
        by_company: dict = {}
        for r in changed:
            by_company.setdefault(r.company_id, []).append(r)
        for company_id, rewards in by_company.items():
            total = sum(r.amount for r in rewards)
            owners = db.query(EmployerProfile.user_id).filter(
                EmployerProfile.company_id == company_id, EmployerProfile.is_owner == True,  # noqa: E712
            ).all()
            for (uid,) in owners:
                create_notification(
                    db, uid, "referral_reward_ready", "Referral bonuses are ready to approve",
                    f"{len(rewards)} referral bonus(es) totalling {rewards[0].currency} {total:,} have completed their retention period.",
                    "/app/employer/referrals",
                )
        db.commit()
        logger.info("[REFERRAL] released %d reward(s) across %d company(ies)", len(changed), len(by_company))
        return {"released": len(changed), "companies": len(by_company)}
    except Exception:
        db.rollback()
        logger.exception("[REFERRAL] release_referral_rewards failed")
        raise
    finally:
        db.close()
