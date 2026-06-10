from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, UUID4


class LessonOut(BaseModel):
    id: str
    title: str
    content_type: Optional[str]
    content_url: Optional[str]
    content_body: Optional[str]
    duration_minutes: int
    sort_order: int
    language: str
    is_completed: bool = False

    class Config:
        from_attributes = True


class PathModuleOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    sort_order: int
    skill_focus: Optional[str]
    lessons: list[LessonOut]
    completed_count: int = 0

    class Config:
        from_attributes = True


class LearningPathSummary(BaseModel):
    id: str
    name: str
    description: Optional[str]
    estimated_hours: int
    difficulty: Optional[str]
    career_track_name: Optional[str]
    career_track_slug: Optional[str] = None   # slug for client-side track matching
    total_lessons: int
    completed_lessons: int
    progress_pct: int
    status: Optional[str]  # enrollment status if enrolled
    is_enrolled: bool
    gap_skills_covered: list[str] = []  # subset of user's gap skills this path addresses

    class Config:
        from_attributes = True


class LearningPathDetail(LearningPathSummary):
    modules: list[PathModuleOut]


class EnrollResponse(BaseModel):
    path_id: str
    status: str
    message: str


class CompleteLessonRequest(BaseModel):
    time_spent_sec: int = 0
    score: Optional[int] = None


class CompleteLessonResponse(BaseModel):
    lesson_id: str
    completed: bool
    streak_updated: bool
    current_streak: int


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity: Optional[str]
