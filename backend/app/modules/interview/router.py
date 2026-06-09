from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.rbac import get_current_aspirant
from app.database import get_db
from app.models.user import User
from app.modules.interview import service
from app.modules.interview.schemas import (
    CreateSessionRequest, PerformanceResponse,
    SessionDetail, SessionFeedbackResponse, SessionSummary,
    SubmitResponseRequest, QuestionOut,
)

router = APIRouter(prefix="/interview", tags=["Mock Interview"])


@router.get("/questions", response_model=list[QuestionOut])
def list_questions(
    career_track_id: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
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
def create_session(
    body: CreateSessionRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.create_session(body, user, db)


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


@router.post("/sessions/{session_id}/complete", response_model=SessionFeedbackResponse)
async def complete_session(
    session_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return await service.complete_session_and_generate_feedback(session_id, user, db)
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
