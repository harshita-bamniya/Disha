from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.rbac import get_current_aspirant
from app.modules.learning import service
from app.modules.learning.schemas import (
    CompleteLessonRequest, CompleteLessonResponse, EnrollResponse,
    LearningPathDetail, LearningPathSummary, StreakResponse,
)
from app.models.user import User

router = APIRouter(prefix="/learn", tags=["Learning"])


@router.get("/paths", response_model=list[LearningPathSummary])
def list_paths(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_all_paths(user, db)


@router.get("/paths/recommended", response_model=list[LearningPathSummary])
def recommended_paths(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_recommended_paths(user, db)


@router.get("/paths/for-job/{job_id}", response_model=list[LearningPathSummary])
def paths_for_job(
    job_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Return learning paths ranked by how many of the user's gap skills for this job they cover."""
    try:
        return service.get_paths_for_job_gap(job_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/paths/{path_id}", response_model=LearningPathDetail)
def path_detail(
    path_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.get_path_detail(path_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/paths/{path_id}/enroll", response_model=EnrollResponse)
def enroll(
    path_id: str,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.enroll_path(path_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/enrollments", response_model=list[LearningPathSummary])
def my_enrollments(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    from app.models.mvp2 import UserLearningEnrollment
    enr_ids = [
        str(e.learning_path_id)
        for e in db.query(UserLearningEnrollment).filter(UserLearningEnrollment.user_id == user.id).all()
    ]
    all_paths = service.get_all_paths(user, db)
    return [p for p in all_paths if p.id in enr_ids]


@router.post("/lessons/{lesson_id}/complete", response_model=CompleteLessonResponse)
def complete_lesson(
    lesson_id: str,
    body: CompleteLessonRequest,
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    try:
        return service.complete_lesson(lesson_id, body.time_spent_sec, body.score, user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/streak", response_model=StreakResponse)
def get_streak(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    return service.get_streak(user, db)


@router.get("/due-reviews")
def get_due_reviews(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """
    Return lessons due for spaced-repetition review.

    Schedule: review at 1, 3, 7, 14, 30 days after completion.
    A lesson is "due" when today is within ±12 hours of one of those intervals.
    Returns at most 5 lessons, ordered by most overdue first.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.mvp2 import LessonCompletion, Lesson, PathModule, LearningPath

    INTERVALS = [1, 3, 7, 14, 30]

    now = datetime.now(timezone.utc)
    completions = (
        db.query(LessonCompletion)
        .filter(LessonCompletion.user_id == user.id)
        .all()
    )

    due = []
    for comp in completions:
        if not comp.completed_at:
            continue
        completed_at = comp.completed_at
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        days_since = (now - completed_at).total_seconds() / 86400

        for interval in INTERVALS:
            delta = days_since - interval
            if -0.5 <= delta <= 3:   # due now or up to 3 days overdue
                lesson = db.query(Lesson).filter(Lesson.id == comp.lesson_id).first()
                if lesson and lesson.is_active:
                    module = db.query(PathModule).filter(PathModule.id == lesson.module_id).first()
                    path = db.query(LearningPath).filter(LearningPath.id == module.learning_path_id).first() if module else None
                    due.append({
                        "lesson_id": str(comp.lesson_id),
                        "lesson_title": lesson.title,
                        "path_id": str(path.id) if path else None,
                        "path_name": path.name if path else None,
                        "days_overdue": round(max(0, delta), 1),
                        "review_interval_days": interval,
                    })
                break  # only count the next due interval per lesson

    due.sort(key=lambda x: x["days_overdue"], reverse=True)
    return due[:5]


@router.get("/exercises")
def get_exercise_lessons(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Return all exercise/case_study/quiz lessons from the user's enrolled paths.

    Used by the Stage 3 exercise panel for inline submission without navigating to Learning Hub.
    """
    from app.models.mvp2 import LearningPath, PathModule, Lesson, UserLearningEnrollment, LessonCompletion

    EXERCISE_TYPES = {"exercise", "case_study", "quiz"}

    enrolled_path_ids = [
        str(e.learning_path_id)
        for e in db.query(UserLearningEnrollment).filter(
            UserLearningEnrollment.user_id == user.id,
            UserLearningEnrollment.status.in_(["enrolled", "in_progress", "completed"]),
        ).all()
    ]
    if not enrolled_path_ids:
        return []

    completed_ids = {
        str(c.lesson_id)
        for c in db.query(LessonCompletion.lesson_id).filter(
            LessonCompletion.user_id == user.id
        ).all()
    }

    results = []
    for path_id in enrolled_path_ids:
        path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
        if not path or not path.is_active:
            continue
        for mod in path.modules:
            for lesson in mod.lessons:
                if lesson.content_type in EXERCISE_TYPES and lesson.is_active:
                    results.append({
                        "lesson_id": str(lesson.id),
                        "lesson_title": lesson.title,
                        "content_type": lesson.content_type,
                        "content_body": lesson.content_body,
                        "duration_minutes": lesson.duration_minutes or 15,
                        "module_title": mod.title,
                        "skill_focus": mod.skill_focus,
                        "path_id": str(path.id),
                        "path_name": path.name,
                        "is_completed": str(lesson.id) in completed_ids,
                    })
    return results


@router.get("/next-lesson")
def get_next_lesson(
    user: User = Depends(get_current_aspirant),
    db: Session = Depends(get_db),
):
    """Adaptive learning: return the next uncompleted lesson across enrolled paths.

    Returns null when all enrolled paths are complete.
    Frontend dashboard uses this to show a personalised 'Continue Learning' CTA.
    """
    result = service.get_next_lesson(user, db)
    return result or {"message": "All enrolled paths are complete. Explore new paths!"}
