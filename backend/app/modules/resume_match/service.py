"""Scan orchestration: resolve the resume + job, reuse caches, analyze, persist.

Cost controls: an identical resume against an unchanged job returns the earlier
scan for free; an unchanged resume reuses its parsed profile across jobs; only
genuinely new analyses count against the daily limit.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.ai.providers.groq import RateLimitedError
from app.core.exceptions import BadRequestException, NotFoundException, ServiceUnavailableException
from app.core.storage import BASE_DIR
from app.models.ats import CandidateResumeFile
from app.models.resume import Resume
from app.models.resume_match import ResumeMatchScan
from app.models.user import JobPosting, User

from . import engine, extraction
from .builder_text import resume_to_text
from .jd_parser import get_or_parse_requirements, source_hash
from .profile_parser import parse_resume
from .schemas import AtsSignals, CandidateProfile, MatchReport, RewriteOut, RoadmapLink
from .scoring import SCORING_VERSION

logger = logging.getLogger(__name__)

DAILY_NEW_SCAN_LIMIT = 10
MIN_TEXT_CHARS = 50


def _job_or_404(job_id: str, db: Session) -> JobPosting:
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise NotFoundException("Job not found.")
    job = db.query(JobPosting).filter(JobPosting.id == jid, JobPosting.is_active == True).first()  # noqa: E712
    if not job:
        raise NotFoundException("Job not found.")
    return job


def scans_used_today(user: User, db: Session) -> int:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    return db.query(func.count(ResumeMatchScan.id)).filter(
        ResumeMatchScan.user_id == user.id, ResumeMatchScan.created_at >= since).scalar() or 0


def quota(user: User, db: Session) -> dict:
    used = scans_used_today(user, db)
    return {"limit": DAILY_NEW_SCAN_LIMIT, "used": used, "remaining": max(0, DAILY_NEW_SCAN_LIMIT - used)}


# ── Resume text resolution ───────────────────────────────────────────────────

def text_from_builder(resume_id: str, user: User, db: Session) -> tuple[str, AtsSignals, str]:
    try:
        rid = uuid.UUID(resume_id)
    except ValueError:
        raise NotFoundException("Resume not found.")
    resume = (db.query(Resume).options(joinedload(Resume.sections))
              .filter(Resume.id == rid, Resume.user_id == user.id, Resume.deleted_at == None).first())  # noqa: E711
    if not resume:
        raise NotFoundException("Resume not found.")
    text = resume_to_text([{"section_type": s.section_type, "content": s.content} for s in resume.sections])
    return text, extraction.signals_from_text(text), resume.title or "Resume"


def text_from_library_file(file_id: str, user: User, db: Session) -> tuple[str, AtsSignals, str]:
    from app.modules.resume_library.service import get_resume_or_404
    return text_from_file_record(get_resume_or_404(file_id, user, db))


def text_from_file_record(record: CandidateResumeFile) -> tuple[str, AtsSignals, str]:
    if record.format not in ("pdf", "docx"):
        raise BadRequestException("Only PDF and DOCX resumes can be scanned. Convert this file and upload it again.")
    path = BASE_DIR / record.storage_key
    if not path.exists():
        raise NotFoundException("Resume file not found on storage.")
    text, signals = extraction.extract(path.read_bytes(), record.filename)
    return text, signals, record.label or record.filename


def text_from_upload(data: bytes, filename: str) -> tuple[str, AtsSignals, str]:
    try:
        text, signals = extraction.extract(data, filename)
    except ValueError as exc:
        raise BadRequestException(str(exc))
    return text, signals, filename


# ── Scan ─────────────────────────────────────────────────────────────────────

async def run_scan(
    user: User,
    job_id: str,
    text: str,
    signals: AtsSignals,
    *,
    source: str,
    ref_id: str | None,
    label: str,
    db: Session,
    enforce_quota: bool = True,
) -> tuple[ResumeMatchScan, bool]:
    """Returns (scan, cached). `cached` scans consumed no quota and no LLM calls.

    `enforce_quota=False` is for checks the platform starts itself (scoring an application's resume);
    those must not use up the candidate's own daily allowance."""
    job = _job_or_404(job_id, db)
    if len(text.strip()) < MIN_TEXT_CHARS:
        raise BadRequestException(
            "No readable text found in this resume. If it is a scanned image, export a text-based PDF or DOCX.")

    rhash = engine.resume_hash(text)
    jhash = source_hash(job)

    job_scans = db.query(ResumeMatchScan).filter(ResumeMatchScan.user_id == user.id, ResumeMatchScan.job_id == job.id)

    # Identical resume text against an unchanged job and scoring version: nothing to recompute.
    unchanged = (job_scans.filter(ResumeMatchScan.resume_hash == rhash,
                                  ResumeMatchScan.job_source_hash == jhash,
                                  ResumeMatchScan.scoring_version == SCORING_VERSION)
                 .order_by(ResumeMatchScan.created_at.desc()).first())
    if unchanged:
        return unchanged, True

    # A score change is only meaningful against an earlier version of the SAME resume, not a different one.
    if ref_id:
        same_identity = ResumeMatchScan.resume_ref_id == uuid.UUID(ref_id)
    else:
        same_identity = (ResumeMatchScan.resume_source == source) & (ResumeMatchScan.resume_label == label[:300])
    prior = job_scans.filter(same_identity).order_by(ResumeMatchScan.created_at.desc()).first()

    if enforce_quota and scans_used_today(user, db) >= DAILY_NEW_SCAN_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {DAILY_NEW_SCAN_LIMIT} new resume checks reached. Try again tomorrow.")

    try:
        requirements = await get_or_parse_requirements(db, job)
        same_resume = (db.query(ResumeMatchScan)
                       .filter(ResumeMatchScan.user_id == user.id, ResumeMatchScan.resume_hash == rhash)
                       .order_by(ResumeMatchScan.created_at.desc()).first())
        if same_resume:
            profile = CandidateProfile.model_validate(same_resume.profile)
        else:
            profile = await parse_resume(text)
        report = await engine.analyze(requirements, profile, signals)
    except RateLimitedError:
        raise ServiceUnavailableException("The analysis service is busy. Please try again in a minute.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("[RESUME_MATCH] scan failed for user=%s job=%s", user.id, job.id)
        raise ServiceUnavailableException("Could not analyze this resume right now. Please try again shortly.")

    scan = ResumeMatchScan(
        user_id=user.id, job_id=job.id, resume_source=source,
        resume_ref_id=uuid.UUID(ref_id) if ref_id else None, resume_label=label[:300],
        resume_hash=rhash, job_source_hash=jhash, scoring_version=SCORING_VERSION,
        score=report.score, band=report.band,
        must_haves_met=report.must_haves_met, must_haves_total=report.must_haves_total,
        profile=profile.model_dump(mode="json"), report=report.model_dump(mode="json"),
        previous_scan_id=prior.id if prior else None,
        score_delta=report.score - prior.score if prior else None,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan, False


# ── Reads ────────────────────────────────────────────────────────────────────

def get_scan(scan_id: str, user: User, db: Session) -> ResumeMatchScan:
    try:
        sid = uuid.UUID(scan_id)
    except ValueError:
        raise NotFoundException("Scan not found.")
    scan = db.query(ResumeMatchScan).filter(ResumeMatchScan.id == sid, ResumeMatchScan.user_id == user.id).first()
    if not scan:
        raise NotFoundException("Scan not found.")
    return scan


def list_scans(job_id: str, user: User, db: Session) -> list[ResumeMatchScan]:
    job = _job_or_404(job_id, db)
    return (db.query(ResumeMatchScan)
            .filter(ResumeMatchScan.user_id == user.id, ResumeMatchScan.job_id == job.id)
            .order_by(ResumeMatchScan.created_at.desc()).limit(50).all())


def changes_since_previous(scan: ResumeMatchScan, db: Session) -> list[dict]:
    """Requirements whose credit changed versus the scan this one followed."""
    if not scan.previous_scan_id:
        return []
    prev = db.query(ResumeMatchScan).filter(ResumeMatchScan.id == scan.previous_scan_id).first()
    if not prev:
        return []
    before = {r["requirement"]["name"]: r["credit"] for r in prev.report.get("requirements", [])}
    out = []
    for r in scan.report.get("requirements", []):
        name, after = r["requirement"]["name"], r["credit"]
        if name in before and before[name] != after and r["requirement"]["type"] != "eligibility":
            out.append({"requirement": name, "before": before[name], "after": after})
    return out


def delete_scan(scan_id: str, user: User, db: Session) -> None:
    db.delete(get_scan(scan_id, user, db))
    db.commit()


def to_report(scan: ResumeMatchScan) -> MatchReport:
    return MatchReport.model_validate(scan.report)


# ── Rewrite suggestions ──────────────────────────────────────────────────────

DAILY_REWRITE_LIMIT = 30


def _spend_rewrite(user: User) -> None:
    """Per-user daily cap on rewrite LLM calls. Redis trouble never blocks the user."""
    try:
        from app.database import get_redis_client
        redis = get_redis_client()
        key = f"resume_match:rewrites:{user.id}:{datetime.now(timezone.utc):%Y%m%d}"
        used = redis.incr(key)
        if used == 1:
            redis.expire(key, 86400)
        over = used > DAILY_REWRITE_LIMIT
    except Exception:
        logger.warning("[RESUME_MATCH] rewrite rate limiter unavailable — allowing")
        return
    if over:
        raise HTTPException(status_code=429, detail="Daily limit of resume line suggestions reached. Try again tomorrow.")


def _resume_bullets(profile: CandidateProfile) -> set[str]:
    return ({b for r in profile.roles for b in r.bullets} | {b for p in profile.projects for b in p.bullets})


async def suggest_rewrite(
    scan_id: str, requirement: str, answer: str | None, user: User, db: Session,
) -> RewriteOut:
    from . import rewrite

    scan = get_scan(scan_id, user, db)
    result = rewrite.find_result(scan.report, requirement)
    if result is None:
        raise NotFoundException("That requirement is not part of this scan.")
    req = result.requirement
    if req.type == "eligibility":
        raise BadRequestException("This can't be shown on a resume; confirm it before you apply.")
    profile = CandidateProfile.model_validate(scan.profile)

    if answer is None:
        if result.credit >= 1.0:
            return RewriteOut(requirement=req.name, kind="not_applicable",
                              warnings=["This requirement is already well covered."])
        if req.type in ("education", "certification"):
            return RewriteOut(
                requirement=req.name, kind="not_applicable",
                warnings=[f"Add {req.name} only if you hold it. If you do, list it in the Education or "
                          "Certifications section; if not, this is a real gap."])
        has_bullet = bool(result.evidence) and result.evidence in _resume_bullets(profile)
        # Listed-only or stale skills have no recent bullet to sharpen: ask where they used it.
        if not has_bullet or (result.method == "exact" and result.credit < 0.7):
            return RewriteOut(requirement=req.name, kind="needs_input", question=rewrite.question_for(req.name))

    _spend_rewrite(user)
    try:
        if answer is None:
            return await rewrite.rewrite_existing(result, profile)
        return await rewrite.write_from_answer(result, answer, profile)
    except RateLimitedError:
        raise ServiceUnavailableException("The suggestion service is busy. Please try again in a minute.")
    except Exception:
        logger.exception("[RESUME_MATCH] rewrite failed scan=%s req=%s", scan_id, requirement)
        raise ServiceUnavailableException("Could not write a suggestion right now. Please try again shortly.")


# ── Roadmap link for real gaps ───────────────────────────────────────────────

def roadmap_link(scan: ResumeMatchScan, user: User, db: Session) -> RoadmapLink:
    from app.models.job_plan import JobLearningPlan
    from .matcher import canon

    plan = (db.query(JobLearningPlan)
            .filter(JobLearningPlan.user_id == user.id, JobLearningPlan.job_id == scan.job_id)
            .order_by(JobLearningPlan.generated_at.desc()).first())
    link = RoadmapLink(job_id=str(scan.job_id), plan_status=plan.status if plan else "none")
    gaps = [f["requirement"] for f in scan.report.get("fixes", []) if f.get("type") == "real_gap"]
    if not plan or plan.status != "ready":
        link.not_covered = gaps
        return link

    modules = (plan.plan or {}).get("modules", [])
    skills = [canon(m.get("skill", "")) for m in modules]
    for g in gaps:
        c = canon(g)
        hit = any(c == s or (len(c) > 3 and c in s) or (len(s) > 3 and s in c) for s in skills)
        (link.covered if hit else link.not_covered).append(g)

    resources = [r.get("id") for m in modules for r in m.get("resources", [])]
    done = sum(1 for rid in resources if (plan.progress or {}).get(rid, {}).get("done"))
    link.progress_pct = round(100 * done / len(resources)) if resources else 0
    return link


def find_current_scan(user: User, job: JobPosting, text: str, db: Session) -> ResumeMatchScan | None:
    """A scan of exactly this resume text against the job's current requirements, if one exists."""
    return (db.query(ResumeMatchScan)
            .filter(ResumeMatchScan.user_id == user.id, ResumeMatchScan.job_id == job.id,
                    ResumeMatchScan.resume_hash == engine.resume_hash(text),
                    ResumeMatchScan.job_source_hash == source_hash(job),
                    ResumeMatchScan.scoring_version == SCORING_VERSION)
            .order_by(ResumeMatchScan.created_at.desc()).first())
