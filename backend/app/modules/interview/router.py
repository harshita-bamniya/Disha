from typing import Optional

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.user import User
from app.core.exceptions import PaymentRequiredException
from app.modules.payments.service import check_feature_credit, consume_feature_credit
from app.modules.interview import service
from app.modules.interview.service import drills, eligibility, voice
from app.modules.interview.schemas import (
    CompleteSessionResponse,
    CreateSessionRequest,
    DrillRequest,
    PerformanceResponse,
    QuestionOut,
    SessionDetail,
    SessionFeedbackResponse,
    SessionSummary,
    SubmitOutcomeRequest,
    SubmitResponseRequest,
)

router = APIRouter(prefix="/interview", tags=["Mock Interview"])
logger = logging.getLogger(__name__)

# Verified Interviews: employer invitations, scorecards, appeals.
from app.modules.interview.verified_router import candidate_router, employer_router  # noqa: E402

router.include_router(candidate_router)
router.include_router(employer_router)


@router.get("/questions", response_model=list[QuestionOut])
def list_questions(
    career_track_id: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_questions(career_track_id, question_type, difficulty, db)


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.list_sessions(user, db)


@router.post("/sessions", response_model=SessionDetail, status_code=201)
async def create_session(
    body: CreateSessionRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    # Answers are sent to an AI provider to be scored, so starting an interview
    # requires the candidate to have agreed to that.
    if "ai_processing" not in body.consents:
        raise HTTPException(
            status_code=400,
            detail="You need to agree to AI processing of your answers to start an interview.",
        )
    if body.session_type == "stress" and not eligibility.stress_eligibility(user.id, db)["unlocked"]:
        raise HTTPException(status_code=403, detail=eligibility.stress_eligibility(user.id, db)["message"])
    # Check first (no spend) so an out-of-credits user doesn't trigger LLM
    # generation; spend only once the session actually exists.
    check_feature_credit(user, "mock_interview", db)
    session = await service.create_session(body, user, db)
    try:
        consume_feature_credit(user, "mock_interview", db)
    except PaymentRequiredException:
        # Lost a race with a parallel create: discard the session we just made.
        service.discard_session(session.id, user, db)
        raise
    service.record_consents(session.id, user, body.consents, db)
    return session


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Delete an interview and everything stored for it (answers, feedback,
    report). Irreversible; the candidate's own data."""
    if not service.discard_session(session_id, user, db):
        raise HTTPException(status_code=404, detail="Interview not found.")


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_session(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/{session_id}/start")
def start_session(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.start_session(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/respond")
def submit_response(
    session_id: str,
    body: SubmitResponseRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.submit_response(session_id, body, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/next-question")
async def get_next_question(
    session_id: str,
    response_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """After submitting a response, get the adaptive next action.

    Returns either a follow-up probe, a challenge question, or the next bank question.
    """
    try:
        return await service.get_next_question(session_id, response_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _queue_grading(session_id: str, background_tasks: BackgroundTasks) -> None:
    """Hand grading to Celery; if the broker is unreachable, fall back to a
    FastAPI background task so the candidate's report still gets produced."""
    from app.tasks.worker import grade_interview_session, safe_dispatch

    if not safe_dispatch(grade_interview_session, session_id):
        logger.warning("[INTERVIEW] Celery unavailable — grading %s in-process", session_id)
        background_tasks.add_task(service.run_grading, session_id)


@router.post("/sessions/{session_id}/complete", response_model=CompleteSessionResponse)
def complete_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Finish the interview and queue grading. Returns immediately; poll
    GET /sessions/{id}/feedback until grading_status is 'done' or 'failed'."""
    try:
        result, needs_dispatch = service.complete_session(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if needs_dispatch:
        _queue_grading(session_id, background_tasks)
    return result


@router.post("/sessions/{session_id}/regrade", response_model=CompleteSessionResponse)
def regrade_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Retry background grading that failed or got stuck."""
    try:
        result, needs_dispatch = service.regrade_session(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if needs_dispatch:
        _queue_grading(session_id, background_tasks)
    return result


@router.post("/sessions/{session_id}/regenerate-report", response_model=SessionFeedbackResponse)
async def regenerate_report(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Retry a failed Job Readiness Report (e.g. after a transient LLM
    quota exhaustion clears) — refuses if the session already has a real one."""
    try:
        return await service.regenerate_readiness_report(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}/feedback", response_model=SessionFeedbackResponse)
def get_feedback(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_session_feedback(session_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/performance", response_model=PerformanceResponse)
def get_performance(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_performance(user, db)


@router.post("/sessions/{session_id}/outcome")
def submit_outcome(
    session_id: str,
    body: SubmitOutcomeRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Predictive-validity flywheel: candidate self-reports what happened
    after the interview they practiced for (opt-in)."""
    try:
        return service.submit_outcome(session_id, body.outcome, body.notes, user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Voice ─────────────────────────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def _voice_http(exc: voice.VoiceError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=str(exc))


@router.get("/capabilities")
def get_capabilities(user: User = Depends(get_current_aspirant)):
    """What the server can do for the interview room (the browser falls back
    to its own speech APIs for anything that isn't available)."""
    from app.ai import language, speech

    return {**speech.capabilities(), "languages": language.public_list()}


@router.post("/sessions/{session_id}/transcribe")
async def transcribe_answer(
    session_id: str,
    audio: UploadFile = File(...),
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Speech-to-text for one spoken answer. Returns {"text", "saved"}; "saved"
    is true only if the candidate opted in to keeping their answer audio."""
    from app.config import get_settings

    limit = get_settings().interview_max_audio_mb * 1024 * 1024
    data = await audio.read(limit + 1)
    try:
        return await voice.transcribe_answer(session_id, user, data, audio.content_type, db)
    except voice.VoiceError as exc:
        raise _voice_http(exc)


@router.post("/sessions/{session_id}/speak")
async def speak(
    session_id: str,
    body: SpeakRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """The interviewer's voice for one piece of text, as audio/wav."""
    try:
        wav = await voice.speak(session_id, user, body.text, db)
    except voice.VoiceError as exc:
        raise _voice_http(exc)
    return Response(content=wav, media_type="audio/wav", headers={"Cache-Control": "private, max-age=3600"})


@router.get("/sessions/{session_id}/audio")
def list_answer_audio(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Names of the answer recordings saved for this interview (opt-in only)."""
    try:
        return {"files": voice.list_audio(session_id, user, db)}
    except voice.VoiceError as exc:
        raise _voice_http(exc)


@router.get("/sessions/{session_id}/audio/{name}")
def get_answer_audio(
    session_id: str,
    name: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        path, media_type = voice.get_audio(session_id, name, user, db)
    except voice.VoiceError as exc:
        raise _voice_http(exc)
    return FileResponse(path, media_type=media_type)


# ── Drills and eligibility ────────────────────────────────────────────────────

@router.get("/eligibility")
def get_eligibility(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Whether stress mode is unlocked, and how many drills are left today."""
    return {
        "stress": eligibility.stress_eligibility(user.id, db),
        "drills": eligibility.drill_quota(user, db),
    }


@router.post("/drills", response_model=SessionDetail, status_code=201)
async def create_drill(
    body: DrillRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Start a one-question drill (a new question, or repeat an earlier one)."""
    if "ai_processing" not in body.consents:
        raise HTTPException(
            status_code=400,
            detail="You need to agree to AI processing of your answers to start a drill.",
        )
    try:
        drill = await drills.create_drill(body, user, db)
    except drills.DrillLimitReached as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    service.record_consents(drill.id, user, body.consents, db)
    return drill


@router.post("/sessions/{session_id}/drill-answer")
async def answer_drill(
    session_id: str,
    body: SubmitResponseRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Answer a drill and get the scored feedback straight back."""
    try:
        return await drills.answer_drill(session_id, body, user, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
