"""Learning system service — Module 05."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.mvp2 import (
    LearningPath, LessonCompletion, PathModule, Lesson,
    UserLearningEnrollment, UserStreak,
)
from app.models.user import AspirantProfile, JobPosting, User, UserCareerSelection
from app.modules.learning.schemas import (
    CompleteLessonResponse, EnrollResponse, LearningPathDetail,
    LearningPathSummary, LessonOut, PathModuleOut, StreakResponse,
)

logger = logging.getLogger(__name__)


def _completed_lesson_ids(user_id, db: Session) -> set[str]:
    rows = db.query(LessonCompletion.lesson_id).filter(LessonCompletion.user_id == user_id).all()
    return {str(r.lesson_id) for r in rows}


def _enrollment_map(user_id, db: Session) -> dict[str, str]:
    """Return {path_id: status} for all enrollments."""
    rows = (
        db.query(UserLearningEnrollment.learning_path_id, UserLearningEnrollment.status)
        .filter(UserLearningEnrollment.user_id == user_id)
        .all()
    )
    return {str(r.learning_path_id): r.status for r in rows}


def _count_path_lessons(path: LearningPath) -> int:
    return sum(len(m.lessons) for m in path.modules)


def _build_path_summary(
    path: LearningPath,
    completed_ids: set[str],
    enrollment_map: dict[str, str],
    gap_skills: set[str] | None = None,
    _gap_db: Session | None = None,
) -> LearningPathSummary:
    total = _count_path_lessons(path)
    done = sum(
        1 for m in path.modules
        for l in m.lessons
        if str(l.id) in completed_ids
    )
    pct = round((done / total) * 100) if total else 0
    status = enrollment_map.get(str(path.id))
    track_name = path.career_track.title if path.career_track else None
    track_slug = path.career_track.slug if path.career_track else None

    covered: list[str] = []
    if gap_skills and path.target_skills and _gap_db is not None:
        from app.modules.krs.skill_gap import compute_gap
        _, _uncovered, _ = compute_gap(list(path.target_skills), list(gap_skills), _gap_db)
        covered = [s for s in gap_skills if s not in _uncovered]
    elif gap_skills and path.target_skills:
        # String-match fallback
        path_lower = {s.lower().strip() for s in path.target_skills}
        covered = [s for s in gap_skills if s.lower().strip() in path_lower]

    return LearningPathSummary(
        id=str(path.id),
        name=path.name,
        description=path.description,
        estimated_hours=path.estimated_hours or 0,
        difficulty=path.difficulty,
        career_track_name=track_name,
        career_track_slug=track_slug,
        total_lessons=total,
        completed_lessons=done,
        progress_pct=pct,
        status=status,
        is_enrolled=status is not None,
        gap_skills_covered=covered,
    )


def get_all_paths(user: User, db: Session) -> list[LearningPathSummary]:
    paths = (
        db.query(LearningPath)
        .options(
            joinedload(LearningPath.modules).joinedload(PathModule.lessons),
            joinedload(LearningPath.career_track),
        )
        .filter(LearningPath.is_active == True)
        .order_by(LearningPath.sort_order)
        .all()
    )
    completed = _completed_lesson_ids(user.id, db)
    enrollment = _enrollment_map(user.id, db)
    return [_build_path_summary(p, completed, enrollment) for p in paths]


def get_recommended_paths(user: User, db: Session) -> list[LearningPathSummary]:
    """Return paths tied to the user's selected career tracks."""
    selections = (
        db.query(UserCareerSelection)
        .filter(UserCareerSelection.user_id == user.id)
        .all()
    )
    if not selections:
        return get_all_paths(user, db)

    track_ids = [str(s.track_id) for s in selections]
    paths = (
        db.query(LearningPath)
        .options(
            joinedload(LearningPath.modules).joinedload(PathModule.lessons),
            joinedload(LearningPath.career_track),
        )
        .filter(
            LearningPath.is_active == True,
            LearningPath.career_track_id.in_(track_ids),
        )
        .order_by(LearningPath.sort_order)
        .all()
    )
    completed = _completed_lesson_ids(user.id, db)
    enrollment = _enrollment_map(user.id, db)
    return [_build_path_summary(p, completed, enrollment) for p in paths]


def get_paths_for_job_gap(job_id: str, user: User, db: Session) -> list[LearningPathSummary]:
    """Return learning paths ranked by how many of the user's gap skills for a specific job they cover."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if not job:
        raise ValueError("Job not found.")

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    user_skills = {s.lower().strip() for s in (profile.skills if profile else []) or []}
    required = job.required_skills or []
    gap_skills = [s for s in required if s.lower().strip() not in user_skills]

    if not gap_skills:
        # No gap — return all recommended paths, still useful for skill reinforcement
        return get_recommended_paths(user, db)

    paths = (
        db.query(LearningPath)
        .options(
            joinedload(LearningPath.modules).joinedload(PathModule.lessons),
            joinedload(LearningPath.career_track),
        )
        .filter(LearningPath.is_active == True)
        .all()
    )

    completed = _completed_lesson_ids(user.id, db)
    enrollment = _enrollment_map(user.id, db)
    gap_set = set(gap_skills)

    summaries = [_build_path_summary(p, completed, enrollment, gap_set, _gap_db=db) for p in paths]

    # Sort: most gap skills covered first; paths with zero coverage go last
    summaries.sort(key=lambda s: len(s.gap_skills_covered), reverse=True)

    # Only return paths that cover at least one gap skill; if none do, return all
    relevant = [s for s in summaries if s.gap_skills_covered]
    return relevant if relevant else summaries


def get_path_detail(path_id: str, user: User, db: Session) -> LearningPathDetail:
    path = (
        db.query(LearningPath)
        .options(
            joinedload(LearningPath.modules).joinedload(PathModule.lessons),
            joinedload(LearningPath.career_track),
        )
        .filter(LearningPath.id == path_id, LearningPath.is_active == True)
        .first()
    )
    if not path:
        raise ValueError("Learning path not found.")

    completed = _completed_lesson_ids(user.id, db)
    enrollment = _enrollment_map(user.id, db)
    summary = _build_path_summary(path, completed, enrollment)

    modules_out = []
    for m in path.modules:
        lessons_out = [
            LessonOut(
                id=str(l.id),
                title=l.title,
                content_type=l.content_type,
                content_url=l.content_url,
                content_body=l.content_body,
                duration_minutes=l.duration_minutes or 5,
                sort_order=l.sort_order,
                language=l.language or "en",
                is_completed=str(l.id) in completed,
            )
            for l in m.lessons if l.is_active
        ]
        done_in_module = sum(1 for l in lessons_out if l.is_completed)
        modules_out.append(
            PathModuleOut(
                id=str(m.id),
                title=m.title,
                description=m.description,
                sort_order=m.sort_order,
                skill_focus=m.skill_focus,
                lessons=lessons_out,
                completed_count=done_in_module,
            )
        )

    return LearningPathDetail(**summary.model_dump(), modules=modules_out)


def enroll_path(path_id: str, user: User, db: Session) -> EnrollResponse:
    path = db.query(LearningPath).filter(LearningPath.id == path_id, LearningPath.is_active == True).first()
    if not path:
        raise ValueError("Learning path not found.")

    existing = (
        db.query(UserLearningEnrollment)
        .filter(
            UserLearningEnrollment.user_id == user.id,
            UserLearningEnrollment.learning_path_id == path_id,
        )
        .first()
    )
    if existing:
        return EnrollResponse(path_id=path_id, status=existing.status, message="Already enrolled.")

    enr = UserLearningEnrollment(user_id=user.id, learning_path_id=path_id, status="enrolled")
    db.add(enr)
    db.commit()
    return EnrollResponse(path_id=path_id, status="enrolled", message="Enrolled successfully.")


def complete_lesson(
    lesson_id: str,
    time_spent_sec: int,
    score: int | None,
    user: User,
    db: Session,
) -> CompleteLessonResponse:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.is_active == True).first()
    if not lesson:
        raise ValueError("Lesson not found.")

    existing = (
        db.query(LessonCompletion)
        .filter(LessonCompletion.user_id == user.id, LessonCompletion.lesson_id == lesson_id)
        .first()
    )
    if not existing:
        db.add(LessonCompletion(
            user_id=user.id,
            lesson_id=lesson_id,
            time_spent_sec=time_spent_sec,
            score=score,
        ))

    # Update enrollment status to in_progress / completed
    module = db.query(PathModule).filter(PathModule.id == lesson.module_id).first()
    if module:
        enr = (
            db.query(UserLearningEnrollment)
            .filter(
                UserLearningEnrollment.user_id == user.id,
                UserLearningEnrollment.learning_path_id == module.learning_path_id,
            )
            .first()
        )
        if enr and enr.status == "enrolled":
            enr.status = "in_progress"
            enr.updated_at = datetime.now(timezone.utc)

        # Check if all lessons in path are done
        if enr and module:
            path = db.query(LearningPath).options(
                joinedload(LearningPath.modules).joinedload(PathModule.lessons)
            ).filter(LearningPath.id == module.learning_path_id).first()

            if path:
                all_lesson_ids = {str(l.id) for m in path.modules for l in m.lessons if l.is_active}
                completed_ids = _completed_lesson_ids(user.id, db)
                completed_ids.add(lesson_id)
                if all_lesson_ids.issubset(completed_ids):
                    enr.status = "completed"
                    enr.completed_at = datetime.now(timezone.utc)

    # Update streak
    streak = _update_streak(user.id, db)
    db.commit()

    # XP award
    try:
        from app.modules.xp.service import award_xp
        xp_event = "lesson_complete"
        if score is not None and score >= 80:
            xp_event = "exercise_score_80"
        award_xp(user.id, xp_event, ref_id=lesson_id,
                 note=f"Lesson: {lesson.title}", db=db)
        db.commit()
    except Exception as exc:
        logger.warning("[LEARNING] XP award failed: %s", exc)

    # Skill competence hook — update competence for the module's skill_focus
    if score is not None:
        try:
            from app.modules.roadmap.service import update_skill_competence
            if module and module.skill_focus:
                is_exercise = lesson.content_type in ("exercise", "case_study", "quiz")
                update_skill_competence(
                    user_id=str(user.id),
                    skill_text=module.skill_focus,
                    quiz_score=float(score) if lesson.content_type == "quiz" else None,
                    exercise_score=float(score) if is_exercise and lesson.content_type != "quiz" else None,
                    db=db,
                )
        except Exception as exc:
            logger.warning("[LEARNING] Skill competence update failed: %s", exc)

    return CompleteLessonResponse(
        lesson_id=lesson_id,
        completed=True,
        streak_updated=True,
        current_streak=streak.current_streak,
    )


def _update_streak(user_id, db: Session) -> UserStreak:
    today = date.today()
    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()

    if not streak:
        streak = UserStreak(user_id=user_id, current_streak=1, longest_streak=1, last_activity=today)
        db.add(streak)
        return streak

    if streak.last_activity == today:
        return streak

    yesterday = date.fromordinal(today.toordinal() - 1)
    if streak.last_activity == yesterday:
        streak.current_streak += 1
    else:
        streak.current_streak = 1

    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.last_activity = today
    streak.updated_at = datetime.now(timezone.utc)
    return streak


def get_next_lesson(user: User, db: Session) -> dict | None:
    """Adaptive learning: return the next uncompleted lesson across all enrolled paths.

    Algorithm:
    1. Fetch user's enrolled + in_progress paths, ordered by progress descending
       (resume the path closest to completion — momentum matters psychologically).
    2. Within the top path, find the first uncompleted active lesson in sort_order.
    3. Returns a dict with path info + lesson info, or None if everything is done.

    Phase 3 extension: This can be enhanced with KRS-gap analysis to surface lessons
    that target the specific skill categories where the user scored lowest.
    """
    enrollments = (
        db.query(UserLearningEnrollment)
        .filter(
            UserLearningEnrollment.user_id == user.id,
            UserLearningEnrollment.status.in_(["enrolled", "in_progress"]),
        )
        .all()
    )
    if not enrollments:
        return None

    completed = _completed_lesson_ids(user.id, db)
    enrollment_map = {str(e.learning_path_id): e.status for e in enrollments}

    # Load paths in progress
    paths = (
        db.query(LearningPath)
        .options(
            joinedload(LearningPath.modules).joinedload(PathModule.lessons),
            joinedload(LearningPath.career_track),
        )
        .filter(
            LearningPath.id.in_([str(e.learning_path_id) for e in enrollments]),
            LearningPath.is_active == True,
        )
        .all()
    )

    # Score paths by progress % (descending) — resume closest-to-done path first
    def _progress(p: LearningPath) -> float:
        total = _count_path_lessons(p)
        if not total:
            return 0.0
        done = sum(1 for m in p.modules for l in m.lessons if str(l.id) in completed and l.is_active)
        return done / total

    paths.sort(key=_progress, reverse=True)

    for path in paths:
        for module in sorted(path.modules, key=lambda m: m.sort_order):
            for lesson in sorted(module.lessons, key=lambda l: l.sort_order):
                if lesson.is_active and str(lesson.id) not in completed:
                    summary = _build_path_summary(path, completed, enrollment_map)
                    return {
                        "path": {
                            "id": str(path.id),
                            "name": path.name,
                            "progress_pct": summary.progress_pct,
                            "career_track_name": summary.career_track_name,
                        },
                        "module": {
                            "id": str(module.id),
                            "title": module.title,
                            "skill_focus": module.skill_focus,
                        },
                        "lesson": {
                            "id": str(lesson.id),
                            "title": lesson.title,
                            "content_type": lesson.content_type,
                            "duration_minutes": lesson.duration_minutes or 5,
                            "language": lesson.language or "en",
                        },
                    }
    return None  # All enrolled paths are complete


def get_streak(user: User, db: Session) -> StreakResponse:
    streak = db.query(UserStreak).filter(UserStreak.user_id == user.id).first()
    if not streak:
        return StreakResponse(current_streak=0, longest_streak=0, last_activity=None)
    return StreakResponse(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_activity=str(streak.last_activity) if streak.last_activity else None,
    )
