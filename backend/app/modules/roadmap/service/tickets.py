"""Work tickets (Stage 4)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.roadmap import (
    TicketSubmission, TicketTemplate,
)
from app.models.user import (
    CareerTrack, User,
)
from app.modules.roadmap.schemas import (
    TicketSubmissionOut, TicketTemplateOut,
)
from app.modules.roadmap.service import core

logger = logging.getLogger(__name__)


def get_tickets(user: User, career_track_id: str | None, db: Session) -> list[TicketTemplateOut]:
    """Return available tickets for the user's career track."""
    q = db.query(TicketTemplate).filter(TicketTemplate.is_active == True)
    if career_track_id:
        q = q.filter(
            (TicketTemplate.career_track_id == career_track_id) |
            (TicketTemplate.career_track_id == None)
        )
    tickets = q.order_by(TicketTemplate.difficulty).all()

    out = []
    for t in tickets:
        track_name = None
        if t.career_track_id:
            tr = db.query(CareerTrack).filter(CareerTrack.id == t.career_track_id).first()
            track_name = tr.title if tr else None
        out.append(TicketTemplateOut(
            id=str(t.id),
            title=t.title,
            context=t.context,
            deliverable=t.deliverable,
            difficulty=t.difficulty,
            estimated_hours=t.estimated_hours or 3,
            evaluation_rubric=t.evaluation_rubric or {},
            career_track_name=track_name,
        ))
    return out


def submit_ticket(
    roadmap_id: str,
    ticket_id: str,
    submission_text: str,
    user: User,
    db: Session,
) -> TicketSubmission:
    """Save a ticket submission and queue async AI review."""
    roadmap = core._get_owned_roadmap(roadmap_id, user, db)
    ticket = db.query(TicketTemplate).filter(
        TicketTemplate.id == ticket_id, TicketTemplate.is_active == True
    ).first()
    if not ticket:
        raise ValueError("Ticket not found.")

    submission = TicketSubmission(
        roadmap_id=roadmap.id,
        user_id=user.id,
        ticket_id=ticket.id,
        submission_text=submission_text,
        review_status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Dispatch async AI review
    try:
        from app.tasks.roadmap_tasks import review_ticket_async
        review_ticket_async.delay(str(submission.id))
    except Exception as exc:
        logger.warning("[ROADMAP] Could not dispatch ticket review for %s: %s", submission.id, exc)

    return submission


def get_submissions(roadmap_id: str, user: User, db: Session) -> list[TicketSubmissionOut]:
    """Return all ticket submissions for this roadmap."""
    roadmap = core._get_owned_roadmap(roadmap_id, user, db)
    subs = (
        db.query(TicketSubmission)
        .filter(TicketSubmission.roadmap_id == roadmap.id)
        .order_by(TicketSubmission.submitted_at.desc())
        .all()
    )
    out = []
    for s in subs:
        ticket_title = None
        if s.ticket_id:
            t = db.query(TicketTemplate).filter(TicketTemplate.id == s.ticket_id).first()
            ticket_title = t.title if t else None
        out.append(TicketSubmissionOut(
            id=str(s.id),
            ticket_id=str(s.ticket_id) if s.ticket_id else None,
            ticket_title=ticket_title,
            submission_text=s.submission_text,
            submitted_at=s.submitted_at,
            review_status=s.review_status,
            ai_review_result=s.ai_review_result,
            ai_reviewed_at=s.ai_reviewed_at,
        ))
    return out

