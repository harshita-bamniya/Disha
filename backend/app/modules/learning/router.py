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
