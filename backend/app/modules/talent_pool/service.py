"""Talent pool — recruiters bookmark candidates by aspirant (not by a single
application) so a good candidate isn't lost once the req they applied to closes.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, NotFoundException
from app.models.applications import SavedCandidate
from app.models.user import AspirantProfile, EmployerProfile, KrsScore, User
from app.modules.talent_pool.schemas import SavedCandidateOut


def _get_employer_profile_approved(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise AuthException("Employer profile not found.")
    if not profile.is_approved:
        raise AuthException("Your employer account is pending admin approval.")
    return profile


def _get_company_employer_ids(profile: EmployerProfile, db: Session) -> list:
    """Shared across the company so any teammate sees/manages the same pool."""
    if not profile.company_id:
        return [profile.id]
    rows = db.query(EmployerProfile.id).filter(EmployerProfile.company_id == profile.company_id).all()
    return [r[0] for r in rows]


def _to_out(row: SavedCandidate, db: Session) -> SavedCandidateOut:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == row.aspirant_id).first()
    krs = db.query(KrsScore).filter(KrsScore.user_id == row.aspirant_id).first()
    saver = row.saver
    return SavedCandidateOut(
        aspirant_id=str(row.aspirant_id),
        full_name=profile.full_name if profile else None,
        city=profile.city if profile else None,
        state=profile.state if profile else None,
        highest_qualification=profile.highest_qualification if profile else None,
        last_designation=profile.last_designation if profile else None,
        skills=(profile.skills or []) if profile else [],
        composite=krs.composite if krs else None,
        note=row.note,
        saved_by_name=(saver.full_name or saver.email or saver.phone) if saver else None,
        saved_at=row.created_at,
    )


def save_candidate(aspirant_id: str, note: str | None, user: User, db: Session) -> SavedCandidateOut:
    employer = _get_employer_profile_approved(user, db)
    aspirant = db.query(User).filter(User.id == aspirant_id).first()
    if not aspirant:
        raise NotFoundException("Candidate not found.")

    row = (
        db.query(SavedCandidate)
        .filter(SavedCandidate.employer_id == employer.id, SavedCandidate.aspirant_id == aspirant_id)
        .first()
    )
    if row:
        row.note = note
    else:
        row = SavedCandidate(employer_id=employer.id, aspirant_id=aspirant_id, saved_by=user.id, note=note)
        db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row, db)


def unsave_candidate(aspirant_id: str, user: User, db: Session) -> dict:
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    rows = (
        db.query(SavedCandidate)
        .filter(SavedCandidate.employer_id.in_(company_employer_ids), SavedCandidate.aspirant_id == aspirant_id)
        .all()
    )
    if not rows:
        raise NotFoundException("This candidate is not in your talent pool.")
    for row in rows:
        db.delete(row)
    db.commit()
    return {"aspirant_id": aspirant_id, "removed": True}


def list_talent_pool(user: User, db: Session) -> list[SavedCandidateOut]:
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    rows = (
        db.query(SavedCandidate)
        .filter(SavedCandidate.employer_id.in_(company_employer_ids))
        .order_by(SavedCandidate.created_at.desc())
        .all()
    )
    # A candidate may have been saved by more than one teammate — dedupe by
    # aspirant, keeping the most recent save (rows are already newest-first).
    seen: set = set()
    out: list[SavedCandidateOut] = []
    for row in rows:
        if row.aspirant_id in seen:
            continue
        seen.add(row.aspirant_id)
        out.append(_to_out(row, db))
    return out


def is_saved(aspirant_id: str, user: User, db: Session) -> bool:
    employer = _get_employer_profile_approved(user, db)
    company_employer_ids = _get_company_employer_ids(employer, db)
    return (
        db.query(SavedCandidate)
        .filter(SavedCandidate.employer_id.in_(company_employer_ids), SavedCandidate.aspirant_id == aspirant_id)
        .first()
        is not None
    )
