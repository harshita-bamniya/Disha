"""Cross-job list views (Phase E)."""
from __future__ import annotations

import logging

from app.models.applications import Application, CandidateInterviewFeedback
from app.models.user import (
    EmployerProfile,
    JobPosting,
)

from app.modules.matching.service import core

logger = logging.getLogger(__name__)


def list_all_applicants(
    user, db,
    status=None,
    job_id=None,
    department_id=None,
    limit=50,
    offset=0,
):
    from datetime import datetime, timezone

    from app.models.user import AspirantProfile
    from app.modules.matching.schemas import AllApplicantsResponse, ApplicantListItem

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    q = (
        db.query(Application, JobPosting)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .filter(Application.job_id.in_(job_ids))
    )
    if status:
        q = q.filter(Application.status == status)
    if job_id:
        q = q.filter(Application.job_id == job_id)
    if department_id:
        q = q.filter(JobPosting.department_id == department_id)

    total = q.count()
    rows = q.order_by(Application.created_at.desc()).offset(offset).limit(limit).all()

    aspirant_ids = [app.aspirant_id for app, _ in rows]
    profiles = {}
    if aspirant_ids:
        for p in db.query(AspirantProfile).filter(AspirantProfile.user_id.in_(aspirant_ids)).all():
            profiles[str(p.user_id)] = p

    dept_names = {}
    dept_ids = {str(job.department_id) for _, job in rows if job.department_id}
    if dept_ids:
        from app.models.company import CompanyDepartment
        for d in db.query(CompanyDepartment).filter(CompanyDepartment.id.in_(dept_ids)).all():
            dept_names[str(d.id)] = d.name

    now = datetime.now(timezone.utc)
    items = []
    for app, job in rows:
        profile = profiles.get(str(app.aspirant_id))
        created = app.created_at.replace(tzinfo=timezone.utc) if app.created_at.tzinfo is None else app.created_at
        days_ago = int((now - created).total_seconds() / 86400)
        items.append(ApplicantListItem(
            application_id=str(app.id),
            aspirant_id=str(app.aspirant_id),
            full_name=profile.full_name if profile else None,
            city=profile.city if profile else None,
            job_id=str(job.id),
            job_title=job.title,
            department_name=dept_names.get(str(job.department_id)) if job.department_id else None,
            status=app.status,
            match_score=app.match_score,
            applied_at=app.created_at.isoformat(),
            days_ago=days_ago,
        ))

    return AllApplicantsResponse(total=total, items=items)


def list_all_interviews(
    user, db,
    status=None,
    job_id=None,
    limit=50,
    offset=0,
):
    from app.models.user import AspirantProfile
    from app.modules.matching.schemas import AllInterviewsResponse, InterviewListItem

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    q = (
        db.query(CandidateInterviewFeedback, Application, JobPosting)
        .join(Application, CandidateInterviewFeedback.application_id == Application.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .filter(Application.job_id.in_(job_ids))
    )
    if status:
        q = q.filter(CandidateInterviewFeedback.status == status)
    if job_id:
        q = q.filter(Application.job_id == job_id)

    total = q.count()
    rows = q.order_by(CandidateInterviewFeedback.scheduled_at.desc().nullslast()).offset(offset).limit(limit).all()

    aspirant_ids = [app.aspirant_id for _, app, _ in rows]
    profiles = {}
    if aspirant_ids:
        for p in db.query(AspirantProfile).filter(AspirantProfile.user_id.in_(aspirant_ids)).all():
            profiles[str(p.user_id)] = p

    interviewer_ids = [iv.interviewer_id for iv, _, _ in rows if iv.interviewer_id]
    interviewer_names = {}
    if interviewer_ids:
        for ep in db.query(EmployerProfile).filter(EmployerProfile.user_id.in_(interviewer_ids)).all():
            interviewer_names[str(ep.user_id)] = ep.contact_person

    dept_names = {}
    dept_ids = {str(job.department_id) for _, _, job in rows if job.department_id}
    if dept_ids:
        from app.models.company import CompanyDepartment
        for d in db.query(CompanyDepartment).filter(CompanyDepartment.id.in_(dept_ids)).all():
            dept_names[str(d.id)] = d.name

    items = []
    for iv, app, job in rows:
        profile = profiles.get(str(app.aspirant_id))
        items.append(InterviewListItem(
            interview_id=str(iv.id),
            application_id=str(app.id),
            candidate_name=profile.full_name if profile else None,
            job_id=str(job.id),
            job_title=job.title,
            department_name=dept_names.get(str(job.department_id)) if job.department_id else None,
            interviewer_name=interviewer_names.get(str(iv.interviewer_id)) if iv.interviewer_id else None,
            scheduled_at=iv.scheduled_at.isoformat() if iv.scheduled_at else None,
            meeting_link=iv.meeting_link,
            status=iv.status,
            recommendation=iv.recommendation,
        ))

    return AllInterviewsResponse(total=total, items=items)


def list_all_offers(
    user, db,
    status=None,
    job_id=None,
    limit=50,
    offset=0,
):
    from app.models.applications import OfferLetter
    from app.models.user import AspirantProfile
    from app.modules.matching.schemas import AllOffersResponse, OfferListItem

    employer = core._get_employer_profile_approved(user, db)
    company_employer_ids = core._get_company_employer_ids(employer, db)
    job_ids = core._get_scoped_job_ids(employer, company_employer_ids, user.role_name, db)

    q = (
        db.query(OfferLetter, Application, JobPosting)
        .join(Application, OfferLetter.application_id == Application.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .filter(Application.job_id.in_(job_ids))
    )
    if status:
        q = q.filter(OfferLetter.status == status)
    if job_id:
        q = q.filter(Application.job_id == job_id)

    total = q.count()
    rows = q.order_by(OfferLetter.sent_at.desc()).offset(offset).limit(limit).all()

    aspirant_ids = [app.aspirant_id for _, app, _ in rows]
    profiles = {}
    if aspirant_ids:
        for p in db.query(AspirantProfile).filter(AspirantProfile.user_id.in_(aspirant_ids)).all():
            profiles[str(p.user_id)] = p

    dept_names = {}
    dept_ids = {str(job.department_id) for _, _, job in rows if job.department_id}
    if dept_ids:
        from app.models.company import CompanyDepartment
        for d in db.query(CompanyDepartment).filter(CompanyDepartment.id.in_(dept_ids)).all():
            dept_names[str(d.id)] = d.name

    items = []
    for offer, app, job in rows:
        profile = profiles.get(str(app.aspirant_id))
        items.append(OfferListItem(
            offer_id=str(offer.id),
            application_id=str(app.id),
            candidate_name=profile.full_name if profile else None,
            job_id=str(job.id),
            job_title=job.title,
            department_name=dept_names.get(str(job.department_id)) if job.department_id else None,
            role_title=offer.role_title,
            salary_ctc=offer.salary_ctc,
            start_date=offer.start_date,
            status=offer.status,
            sent_at=offer.sent_at.isoformat() if offer.sent_at else None,
            responded_at=offer.responded_at.isoformat() if offer.responded_at else None,
        ))

    return AllOffersResponse(total=total, items=items)

