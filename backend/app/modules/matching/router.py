"""Phase 3 — Module 09: Employer Matching router.

Aspirant routes (/api/jobs/...):
  GET  /api/jobs                          → paginated job listings with match score
  GET  /api/jobs/{job_id}                 → job detail
  POST /api/jobs/{job_id}/apply           → submit application
  GET  /api/jobs/applications             → aspirant's own applications
  GET  /api/jobs/applications/{id}        → application detail + history
  POST /api/jobs/applications/{id}/withdraw → withdraw application

Employer routes (/api/employer/pipeline/...):
  GET  /api/employer/pipeline/{job_id}            → candidate pipeline
  PATCH /api/employer/pipeline/applications/{id}  → update application status
"""
import hashlib
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from redis import Redis
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, BadRequestException, NotFoundException
from app.core.rbac import (
    get_current_verified_user,
    require_employer,
    require_permission,
    require_role,
)
from app.database import get_db, get_redis, get_redis_client
from app.models.user import User
from app.modules.matching import service
from app.modules.matching.schemas import (
    AllApplicantsResponse,
    AllInterviewsResponse,
    AllOffersResponse,
    ApplicationDetailOut,
    ApplicationOut,
    ApplicationResponsesOut,
    ApplicationTrendResponse,
    ApplyRequest,
    BookInterviewSlotRequest,
    BulkEmailRequest,
    BulkEmailResponse,
    BulkStatusUpdateRequest,
    BulkTestInviteRequest,
    BulkTestInviteResponse,
    BulkUpsertPipelineStagesRequest,
    CandidateEmailLogOut,
    CandidateNoteCreateRequest,
    CandidateNoteOut,
    CandidateRatingRequest,
    DashboardKpis,
    EmployerFunnelResponse,
    InterviewFeedbackOut,
    InterviewFeedbackSubmitRequest,
    JobCandidatePipeline,
    JobDetail,
    JobPerformanceResponse,
    JobRecommendationsResponse,
    OfferInterviewSlotsRequest,
    OfferLetterAcceptRequest,
    OfferLetterDeclineRequest,
    OfferLetterOut,
    OfferLetterRequest,
    PipelineStageOut,
    PipelineTemplateCreateRequest,
    PipelineTemplateOut,
    RecruiterPerformanceResponse,
    RequestRescheduleRequest,
    ScheduleInterviewRequest,
    SendCandidateEmailRequest,
    TestInviteRequest,
    UpcomingInterviewEntry,
    UpdateApplicationStatusRequest,
    WithdrawRequest,
)


class UpdateNoteRequest(BaseModel):
    note: str = Field(..., max_length=1000)

_JOBS_CACHE_TTL = 600  # 10 minutes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Employer Matching"])

_aspirant = require_role("aspirant")
_employer = require_employer


_VERSION_KEY_PREFIX = "jobs:recs:ver:"
_GLOBAL_VERSION_KEY = "jobs:recs:global_ver"
_CACHE_TTL = 300  # seconds


def _get_user_cache_version(user_id, redis: Redis) -> int:
    """Return the current cache version counter for a user (0 if not set)."""
    try:
        v = redis.get(f"{_VERSION_KEY_PREFIX}{user_id}")
        return int(v) if v else 0
    except Exception:
        return 0


def _get_global_jobs_version(redis: Redis) -> int:
    """Return the current catalog-wide version counter (0 if not set). Bumped
    whenever any job posting's visibility changes — a per-user version alone
    can't catch that, since a newly-published job affects every aspirant's
    cached list, not just the employer's own."""
    try:
        v = redis.get(_GLOBAL_VERSION_KEY)
        return int(v) if v else 0
    except Exception:
        return 0


def _jobs_cache_key(user_id, sector, job_type, min_salary, q, limit, offset, version) -> str:
    sig = hashlib.md5(
        json.dumps(
            {"s": sector, "jt": job_type, "ms": min_salary, "q": q, "l": limit, "o": offset, "v": version},
            sort_keys=True,
        ).encode()
    ).hexdigest()
    return f"jobs:recs:{user_id}:{sig}"


def invalidate_jobs_cache(user_id, redis: Redis) -> None:
    """Increment the user's cache version counter — all existing keys become stale instantly.
    Version-counter pattern: O(1) vs O(N) scan — safe on large keyspaces."""
    try:
        key = f"{_VERSION_KEY_PREFIX}{user_id}"
        redis.incr(key)
        redis.expire(key, 86400)  # 24 h TTL so orphaned counters self-clean
    except Exception:
        pass  # Cache eviction failure is never fatal


def bump_global_jobs_version(redis: Redis | None = None) -> None:
    """Increment the catalog-wide cache version — every aspirant's cached job
    list becomes stale instantly. Call this whenever a job posting's
    visibility changes (create+publish, publish/pause/close/reopen/archive,
    edit, delete) — previously nothing did, so a newly-published job (or an
    edit to one) could take up to _CACHE_TTL (5 min) to appear on the aspirant
    Jobs page, and stayed invisible indefinitely if that TTL kept getting
    reset by other traffic re-priming the same stale cache key."""
    try:
        r = redis or get_redis_client()
        r.incr(_GLOBAL_VERSION_KEY)
        r.expire(_GLOBAL_VERSION_KEY, 86400)
    except Exception:
        pass  # Cache eviction failure is never fatal — never block the write it's attached to


# ── Aspirant: job discovery ───────────────────────────────────────────────────

@router.get("/jobs", response_model=JobRecommendationsResponse)
def list_jobs(
    sector: Optional[str] = Query(None, description="Filter by sector (partial match)"),
    job_type: Optional[str] = Query(None, description="remote | pan_india | hybrid | onsite"),
    min_salary: Optional[int] = Query(None, description="Minimum salary in LPA"),
    q: Optional[str] = Query(None, description="Keyword search across title and description"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Browse active job postings ranked by match score for the current aspirant."""
    # Combine the user's own version (bumped on their profile/preference
    # changes) with the catalog-wide version (bumped on any job posting
    # change) — either one moving invalidates this cache key.
    version = f"{_get_user_cache_version(current_user.id, redis)}:{_get_global_jobs_version(redis)}"
    cache_key = _jobs_cache_key(current_user.id, sector, job_type, min_salary, q, limit, offset, version)

    # Skip cache for keyword searches — results should be fresh
    if not q:
        try:
            cached = redis.get(cache_key)
            if cached:
                return JobRecommendationsResponse.model_validate_json(cached)
        except Exception:
            pass

    try:
        result = service.get_job_recommendations(
            current_user, db,
            sector=sector, job_type=job_type,
            min_salary=min_salary, q=q, limit=limit, offset=offset,
        )
    except Exception as exc:
        logger.error("[MATCHING] list_jobs error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch job listings.")

    if not q:
        try:
            redis.setex(cache_key, _JOBS_CACHE_TTL, result.model_dump_json())
        except Exception:
            pass

    return result


@router.get("/jobs/applications", response_model=list[ApplicationOut])
def list_my_applications(
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Return all applications submitted by the current aspirant."""
    return service.list_my_applications(current_user, db)


@router.get("/jobs/applications/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_application_detail(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job_detail(
    job_id: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    try:
        return service.get_job_detail(job_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=201)
def apply_to_job(
    job_id: str,
    body: ApplyRequest,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Submit an application to a job posting."""
    try:
        return service.apply_to_job(job_id, body, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs/applications/{application_id}/withdraw", status_code=200)
def withdraw_application(
    application_id: str,
    body: WithdrawRequest = WithdrawRequest(),
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.withdraw_application(application_id, current_user, db, reason=body.reason, note=body.note)
    except (NotFoundException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs/applications/{application_id}/interviews", response_model=list[InterviewFeedbackOut])
def list_my_interviews(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Aspirant-facing interview visibility — previously only available via email."""
    try:
        return service.list_my_interviews(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/jobs/applications/{application_id}/interviews/{interview_id}/request-reschedule", response_model=InterviewFeedbackOut)
def request_interview_reschedule(
    application_id: str,
    interview_id: str,
    body: RequestRescheduleRequest,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Self-serve reschedule request — flags the interview for the employer
    with the candidate's note; the candidate can't change the time directly."""
    try:
        return service.request_interview_reschedule(application_id, interview_id, body.note, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs/applications/{application_id}/interviews/{interview_id}/book-slot", response_model=InterviewFeedbackOut)
def book_interview_slot(
    application_id: str,
    interview_id: str,
    body: BookInterviewSlotRequest,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Candidate self-booking — picks one of the times the employer offered
    via offer_interview_slots."""
    try:
        return service.book_interview_slot(application_id, interview_id, body.slot, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs/applications/{application_id}/offer-letter", response_model=OfferLetterOut)
def get_my_offer_letter(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_my_offer_letter(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/jobs/applications/{application_id}/offer-letter/pdf")
def download_my_offer_letter_pdf(
    application_id: str,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        pdf_bytes = service.download_my_offer_letter_pdf(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="offer_letter_{application_id[:8]}.pdf"'},
    )


@router.post("/jobs/applications/{application_id}/offer-letter/accept", response_model=OfferLetterOut)
def accept_offer_letter(
    application_id: str,
    body: OfferLetterAcceptRequest,
    request: Request,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    """Self-serve e-signature acceptance — typed full legal name, with IP/user-agent
    captured for an audit trail. Not a legally-binding e-signature (that needs a
    third-party provider); see docs/ENTERPRISE_AUDIT_ROADMAP.md M2."""
    if not body.confirm:
        raise HTTPException(status_code=400, detail="You must confirm you have read and agree to the offer terms.")
    try:
        return service.accept_offer_letter(
            application_id, body.signature_name,
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
            current_user, db,
        )
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs/applications/{application_id}/offer-letter/decline", response_model=OfferLetterOut)
def decline_offer_letter(
    application_id: str,
    body: OfferLetterDeclineRequest,
    current_user: User = Depends(_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.decline_offer_letter(application_id, body.reason, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Employer: candidate pipeline ──────────────────────────────────────────────

@router.get("/employer/pipeline/{job_id}", response_model=JobCandidatePipeline)
def get_job_pipeline(
    job_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    # ATS filters
    status: Optional[str] = Query(None, description="Filter by application status"),
    search: Optional[str] = Query(None, description="Search by candidate name"),
    knockout_triggered: Optional[bool] = Query(None, description="Filter by knockout_triggered flag"),
    knockout_action: Optional[str] = Query(None, description="Filter by knockout action / tag"),
    score_min: Optional[int] = Query(None, ge=0, le=100, description="Minimum ATS application score"),
    score_max: Optional[int] = Query(None, ge=0, le=100, description="Maximum ATS application score"),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Employer views candidates who applied to a specific job (with optional ATS filters)."""
    try:
        return service.get_job_pipeline(
            job_id, current_user, db,
            limit=limit, offset=offset,
            status=status, search=search,
            knockout_triggered=knockout_triggered,
            knockout_action=knockout_action,
            score_min=score_min, score_max=score_max,
        )
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/pipeline/{job_id}/export")
def export_pipeline_csv(
    job_id: str,
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    knockout_triggered: Optional[bool] = Query(None),
    knockout_action: Optional[str] = Query(None),
    score_min: Optional[int] = Query(None, ge=0, le=100),
    score_max: Optional[int] = Query(None, ge=0, le=100),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Export the filtered candidate list as a downloadable CSV."""
    try:
        csv_data = service.export_pipeline_csv(
            job_id, current_user, db,
            status=status, search=search,
            knockout_triggered=knockout_triggered,
            knockout_action=knockout_action,
            score_min=score_min, score_max=score_max,
        )
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="pipeline_{job_id}.csv"'},
    )


@router.get("/employer/pipeline/applications/{application_id}/responses",
            response_model=ApplicationResponsesOut)
def get_application_responses(
    application_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Return the form question answers submitted by a candidate for a specific application."""
    try:
        return service.get_application_responses(application_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/employer/pipeline/applications/{application_id}/note", status_code=200)
def update_application_note(
    application_id: str,
    body: UpdateNoteRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Employer saves a private recruiter note on an application without changing status."""
    from app.models.applications import Application
    from app.models.user import EmployerProfile, JobPosting
    employer = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found.")
    app = (
        db.query(Application)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .filter(Application.id == application_id, JobPosting.employer_id == employer.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    app.employer_note = body.note
    db.commit()
    return {"application_id": application_id, "note": body.note}


@router.patch("/employer/pipeline/applications/{application_id}", status_code=200)
def update_application_status(
    application_id: str,
    body: UpdateApplicationStatusRequest,
    current_user: User = Depends(require_permission("candidates", "shortlist")),
    db: Session = Depends(get_db),
):
    """Employer moves an application through the pipeline (review → shortlist → hire/reject)."""
    try:
        return service.update_application_status(application_id, body, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/employer/pipeline/applications/bulk-action", status_code=200)
def bulk_update_status(
    body: BulkStatusUpdateRequest,
    current_user: User = Depends(require_permission("candidates", "shortlist")),
    db: Session = Depends(get_db),
):
    """Move multiple applications to the same stage in one request (Kanban bulk drag)."""
    try:
        return service.bulk_update_status(body.application_ids, body.status, body.note, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/employer/pipeline/applications/bulk-email", response_model=BulkEmailResponse, status_code=200)
async def bulk_email_candidates(
    body: BulkEmailRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Send one email to multiple candidates selected from the pipeline."""
    try:
        return await service.bulk_email_candidates(
            body.application_ids, body.subject, body.body, current_user, db
        )
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/employer/pipeline/applications/{application_id}/offer-letter", response_model=OfferLetterOut)
async def send_offer_letter(
    application_id: str,
    body: OfferLetterRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Create/send a persisted offer letter — emails the candidate a PDF and
    lets them accept (e-signature) or decline in-product. Replaces the old
    stateless "download a PDF" flow, which had no way for a candidate to
    actually respond."""
    try:
        return await service.send_offer_letter(application_id, body, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employer/pipeline/applications/{application_id}/offer-letter", response_model=Optional[OfferLetterOut])
def get_offer_letter(
    application_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_offer_letter_for_employer(application_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/pipeline/applications/{application_id}/offer-letter/pdf")
def download_offer_letter_pdf(
    application_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        pdf_bytes = service.download_offer_letter_pdf_employer(application_id, current_user, db)
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="offer_letter_{application_id[:8]}.pdf"'},
    )


@router.post("/employer/pipeline/applications/{application_id}/notes", response_model=CandidateNoteOut, status_code=201)
def add_candidate_note(
    application_id: str,
    body: CandidateNoteCreateRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.add_candidate_note(application_id, body.note, body.is_internal, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/employer/pipeline/applications/{application_id}/email", response_model=CandidateEmailLogOut, status_code=201)
async def send_candidate_email(
    application_id: str,
    body: SendCandidateEmailRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Employer emails a candidate directly from the pipeline. Persists a log row."""
    try:
        return await service.send_candidate_email(application_id, body.subject, body.body, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/employer/pipeline/applications/{application_id}/email", response_model=list[CandidateEmailLogOut])
def list_candidate_emails(
    application_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """History of emails sent to this candidate from the pipeline."""
    try:
        return service.list_candidate_emails(application_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/employer/pipeline/applications/{application_id}/rating", status_code=200)
def set_candidate_rating(
    application_id: str,
    body: CandidateRatingRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.set_candidate_rating(application_id, body.rating, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/employer/pipeline/applications/{application_id}/interviews", response_model=InterviewFeedbackOut, status_code=201)
def schedule_interview(
    application_id: str,
    body: ScheduleInterviewRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    try:
        return service.schedule_interview(application_id, body.scheduled_at, body.meeting_link, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/employer/pipeline/applications/{application_id}/test-invite", status_code=200)
def send_test_invite(
    application_id: str,
    body: TestInviteRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    """Direct 2nd-phase invite for jobs that don't require a resume (those
    applications skip shortlisting entirely — see applications/service.py
    submit_application). HR picks this instead of schedule_interview when
    the next step is a test."""
    try:
        return service.send_test_invite(application_id, body.message, body.test_link, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/employer/pipeline/applications/bulk-test-invite", response_model=BulkTestInviteResponse, status_code=200)
def bulk_send_test_invite(
    body: BulkTestInviteRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    """Same as send_test_invite, for multiple candidates selected from the pipeline at once."""
    try:
        return service.bulk_send_test_invite(body.application_ids, body.message, body.test_link, current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/employer/pipeline/applications/{application_id}/interviews/offer-slots", response_model=InterviewFeedbackOut, status_code=201)
def offer_interview_slots(
    application_id: str,
    body: OfferInterviewSlotsRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    """Candidate self-booking — offers 2+ time options instead of picking one
    fixed time; the candidate books via book_interview_slot."""
    try:
        return service.offer_interview_slots(application_id, body.slots, body.meeting_link, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/employer/pipeline/applications/{application_id}/interviews/{interview_id}/reschedule", response_model=InterviewFeedbackOut)
def reschedule_interview(
    application_id: str,
    interview_id: str,
    body: ScheduleInterviewRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    """Updates the existing interview's time (vs. schedule_interview, which
    creates a new row) — also clears any pending reschedule request and
    re-notifies the candidate with a fresh calendar invite."""
    try:
        return service.reschedule_interview(application_id, interview_id, body.scheduled_at, body.meeting_link, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/employer/pipeline/applications/{application_id}/interviews/{interview_id}/ics")
def download_interview_ics(
    application_id: str,
    interview_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Downloadable calendar invite — same content emailed to the candidate
    when the interview was scheduled."""
    try:
        ics = service.get_interview_ics(application_id, interview_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(
        content=ics, media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=interview.ics"},
    )


@router.patch("/employer/pipeline/applications/{application_id}/interviews/{interview_id}/feedback", response_model=InterviewFeedbackOut)
def submit_interview_feedback(
    application_id: str,
    interview_id: str,
    body: InterviewFeedbackSubmitRequest,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    try:
        return service.submit_interview_feedback(
            application_id, interview_id, body.recommendation, body.feedback, current_user, db,
            ratings=body.ratings,
        )
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/employer/pipeline/applications/{application_id}/interviews/{interview_id}/no-show", response_model=InterviewFeedbackOut)
def mark_interview_no_show(
    application_id: str,
    interview_id: str,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    """A deliberate HR confirmation, not automatic detection. First no-show on
    an application emails the candidate a one-time rebook offer; a second
    auto-rejects the application."""
    try:
        return service.mark_interview_no_show(application_id, interview_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BadRequestException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/employer/pipeline/applications/{application_id}/interviews/{interview_id}/cancel", response_model=InterviewFeedbackOut)
def cancel_interview(
    application_id: str,
    interview_id: str,
    current_user: User = Depends(require_permission("candidates", "interview")),
    db: Session = Depends(get_db),
):
    try:
        return service.cancel_interview(application_id, interview_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/interviews/upcoming", response_model=list[UpcomingInterviewEntry])
def list_upcoming_interviews(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_upcoming_interviews(current_user, db, limit)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Employer analytics ────────────────────────────────────────────────────────

@router.get("/employer/analytics/funnel", response_model=EmployerFunnelResponse)
def get_employer_funnel(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_employer_funnel(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/analytics/jobs", response_model=JobPerformanceResponse)
def get_job_performance(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_job_performance(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/analytics/recruiters", response_model=RecruiterPerformanceResponse)
def get_recruiter_performance(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    """Per-teammate activity (applications moved, interviews run, hires
    closed) — lets a hiring manager see whether a recruiter seat is earning
    its cost, which there was previously no visibility into at all."""
    try:
        return service.get_recruiter_performance(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/employer/dashboard/kpis", response_model=DashboardKpis)
def get_dashboard_kpis(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_dashboard_kpis(current_user, db)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/employer/dashboard/application-trend", response_model=ApplicationTrendResponse)
def get_application_trend(
    days: int = Query(30, ge=7, le=180),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_application_trend(current_user, db, days)
    except AuthException as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Cross-job list views (Phase E) ─────────────────────────────────────────────

@router.get("/employer/applicants", response_model=AllApplicantsResponse)
def list_all_applicants(
    status: str | None = Query(None),
    job_id: str | None = Query(None),
    department_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_all_applicants(current_user, db, status=status, job_id=job_id, department_id=department_id, limit=limit, offset=offset)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.get("/employer/all-interviews", response_model=AllInterviewsResponse)
def list_all_interviews(
    status: str | None = Query(None),
    job_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_all_interviews(current_user, db, status=status, job_id=job_id, limit=limit, offset=offset)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.get("/employer/all-offers", response_model=AllOffersResponse)
def list_all_offers(
    status: str | None = Query(None),
    job_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_all_offers(current_user, db, status=status, job_id=job_id, limit=limit, offset=offset)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


# ── Phase F: Pipeline Stages ──────────────────────────────────────────────────

@router.get("/employer/jobs/{job_id}/pipeline-stages", response_model=list[PipelineStageOut])
def get_pipeline_stages(
    job_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.get_pipeline_stages(job_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=403 if isinstance(e, AuthException) else 404, detail=e.detail)


@router.put("/employer/jobs/{job_id}/pipeline-stages", response_model=list[PipelineStageOut])
def bulk_upsert_pipeline_stages(
    job_id: str,
    payload: BulkUpsertPipelineStagesRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.bulk_upsert_pipeline_stages(job_id, payload, current_user, db)
    except (AuthException, BadRequestException, NotFoundException) as e:
        code = 403 if isinstance(e, AuthException) else 400 if isinstance(e, BadRequestException) else 404
        raise HTTPException(status_code=code, detail=e.detail)


@router.post("/employer/jobs/{job_id}/pipeline-stages/from-template/{template_id}", response_model=list[PipelineStageOut])
def apply_template_to_job(
    job_id: str,
    template_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.apply_template_to_job(job_id, template_id, current_user, db)
    except (AuthException, BadRequestException, NotFoundException) as e:
        code = 403 if isinstance(e, AuthException) else 400 if isinstance(e, BadRequestException) else 404
        raise HTTPException(status_code=code, detail=e.detail)


@router.get("/employer/pipeline-templates", response_model=list[PipelineTemplateOut])
def list_pipeline_templates(
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.list_pipeline_templates(current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=403, detail=e.detail)


@router.post("/employer/pipeline-templates", response_model=PipelineTemplateOut)
def create_pipeline_template(
    payload: PipelineTemplateCreateRequest,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        return service.create_pipeline_template(payload, current_user, db)
    except (AuthException, BadRequestException) as e:
        raise HTTPException(status_code=400, detail=e.detail)


@router.delete("/employer/pipeline-templates/{template_id}", status_code=204)
def delete_pipeline_template(
    template_id: str,
    current_user: User = Depends(_employer),
    db: Session = Depends(get_db),
):
    try:
        service.delete_pipeline_template(template_id, current_user, db)
    except (AuthException, NotFoundException) as e:
        raise HTTPException(status_code=403 if isinstance(e, AuthException) else 404, detail=e.detail)
