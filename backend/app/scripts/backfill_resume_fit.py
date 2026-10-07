"""Score existing applications that have a resume but no resume-fit score yet.

The migration that introduced resume fit clears the old profile-based number on every application and
marks those with a resume as 'pending'. Run this once after migrating to score them:

    python -m app.scripts.backfill_resume_fit            # score all pending
    python -m app.scripts.backfill_resume_fit --dry-run  # just count

Scoring calls the AI service, so this runs one application at a time. Failures are marked 'failed'
and can be retried by running the script again after resetting their status to 'pending'.
"""
import sys

from app.database import SessionLocal
from app.models.applications import Application
from app.modules.applications.service import (
    RESUME_FIT_FAILED, RESUME_FIT_PENDING, finalize_scored_application,
)
from app.modules.resume_match.application_fit import score_application_sync


def main(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        ids = [str(a.id) for a in db.query(Application.id).filter(Application.resume_fit_status == RESUME_FIT_PENDING)]
    finally:
        db.close()
    print(f"{len(ids)} application(s) awaiting a resume-fit score")
    if dry_run:
        return
    done = failed = 0
    for application_id in ids:
        try:
            ok, reason = score_application_sync(application_id)
            if not ok:
                raise RuntimeError(reason)
            finalize_scored_application(application_id)
            done += 1
        except Exception as exc:
            failed += 1
            print(f"  {application_id}: {exc}")
            db = SessionLocal()
            try:
                db.query(Application).filter(Application.id == application_id).update(
                    {"resume_fit_status": RESUME_FIT_FAILED})
                db.commit()
            finally:
                db.close()
    print(f"scored {done}, failed {failed}")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
