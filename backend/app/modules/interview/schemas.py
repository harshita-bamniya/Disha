from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class QuestionOut(BaseModel):
    id: str
    question_text: str
    question_type: Optional[str]
    difficulty: Optional[str]
    language: str
    career_track_id: Optional[str]

    class Config:
        from_attributes = True


class SessionSummary(BaseModel):
    id: str
    career_track_name: Optional[str]
    session_type: str
    status: str
    total_questions: int
    responses_count: int
    avg_score: Optional[float]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionDetail(SessionSummary):
    questions: list[QuestionOut]


class CreateSessionRequest(BaseModel):
    career_track_id: Optional[str] = None
    session_type: str = "practice"
    total_questions: int = 5
    difficulty: Optional[str] = None


class SubmitResponseRequest(BaseModel):
    question_id: str
    response_text: str
    response_time_sec: int = 0


class FeedbackOut(BaseModel):
    id: str
    response_id: Optional[str]
    question_text: Optional[str]
    original_response: Optional[str]
    clarity_score: Optional[int]
    conciseness_score: Optional[int]
    impact_score: Optional[int]
    relevance_score: Optional[int]
    star_adherence: Optional[int]
    overall_score: Optional[int]
    strengths: list[str]
    improvements: list[str]
    rewritten_answer: Optional[str]

    class Config:
        from_attributes = True


class SessionFeedbackResponse(BaseModel):
    session_id: str
    overall_avg: float
    feedback_items: list[FeedbackOut]


class PerformanceResponse(BaseModel):
    total_sessions: int
    completed_sessions: int
    avg_overall_score: float
    avg_clarity: float
    avg_conciseness: float
    avg_impact: float
    best_session_score: float
    sessions_by_type: dict[str, int]
