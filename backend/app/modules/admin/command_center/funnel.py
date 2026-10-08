"""Two-sided journey funnel.

A closed funnel over a signup cohort: a person counts at a step only if they also reached every
earlier step, so the funnel only narrows. Progress is evaluated as of now, not just inside the range.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.applications import Application, ApplicationStatusHistory
from app.models.employer_verification import EmployerVerification, EmployerVerificationDocument
from app.models.interview import InterviewSession
from app.models.job_plan import JobLearningPlan
from app.models.learning import LessonCompletion
from app.models.resume import Resume
from app.models.roadmap import UserRoadmap
from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import (
    AspirantProfile, EmployerProfile, JobPosting, KrsScore, Role, User, UserCareerSelection,
)
from app.modules.admin.command_center.stats import LOW_SAMPLE_N, previous_range, wilson

INTERVIEW_STATUSES = ("interview_scheduled", "interviewed", "offered", "hired")

ASPIRANT_STEPS = [
    ("signed_up", "Signed up"), ("onboarding", "Onboarding done"), ("kscore", "K-score built"),
    ("prep", "Prep activity"), ("applied", "Applied"), ("interview", "Interview stage"), ("hired", "Hired"),
]
EMPLOYER_STEPS = [
    ("registered", "Registered"), ("kyc_submitted", "KYC submitted"), ("kyc_approved", "KYC approved"),
    ("job_posted", "Job posted"), ("applicants", "Got applicants"), ("paid", "Paid plan"),
]


def _ids(rows) -> set[uuid.UUID]:
    return {r[0] for r in rows if r[0] is not None}


def _aspirant_cohort(db: Session, start: datetime, end: datetime) -> set[uuid.UUID]:
    return _ids(
        db.query(User.id).join(Role, Role.id == User.role_id)
        .filter(Role.name == "aspirant", User.deleted_at.is_(None), User.created_at >= start, User.created_at < end)
    )


def _aspirant_sets(db: Session, cohort: set[uuid.UUID]) -> dict[str, set[uuid.UUID]]:
    ids = list(cohort)
    if not ids:
        return {key: set() for key, _ in ASPIRANT_STEPS}

    def col(model, attr, *filters) -> set[uuid.UUID]:
        q = db.query(getattr(model, attr)).filter(getattr(model, attr).in_(ids))
        for f in filters:
            q = q.filter(f)
        return _ids(q.distinct())

    def via_history(to_status) -> set[uuid.UUID]:
        q = (
            db.query(Application.aspirant_id)
            .join(ApplicationStatusHistory, ApplicationStatusHistory.application_id == Application.id)
            .filter(Application.aspirant_id.in_(ids))
        )
        q = q.filter(ApplicationStatusHistory.to_status.in_(to_status)) if isinstance(to_status, tuple) else q.filter(ApplicationStatusHistory.to_status == to_status)
        return _ids(q.distinct())

    return {
        "signed_up": set(cohort),
        "onboarding": col(AspirantProfile, "user_id", AspirantProfile.is_completed.is_(True)),
        "kscore": col(KrsScore, "user_id"),
        "prep": (
            col(LessonCompletion, "user_id") | col(InterviewSession, "user_id")
            | col(Resume, "user_id", Resume.deleted_at.is_(None)) | col(UserRoadmap, "user_id")
            | col(JobLearningPlan, "user_id") | col(UserCareerSelection, "user_id")
        ),
        "applied": col(Application, "aspirant_id"),
        "interview": col(Application, "aspirant_id", Application.status.in_(INTERVIEW_STATUSES)) | via_history(INTERVIEW_STATUSES),
        "hired": col(Application, "aspirant_id", Application.status == "hired") | via_history("hired"),
    }


def _employer_cohort(db: Session, start: datetime, end: datetime) -> set[uuid.UUID]:
    return _ids(db.query(EmployerProfile.id).filter(EmployerProfile.created_at >= start, EmployerProfile.created_at < end))


def _employer_sets(db: Session, cohort: set[uuid.UUID]) -> dict[str, set[uuid.UUID]]:
    ids = list(cohort)
    if not ids:
        return {key: set() for key, _ in EMPLOYER_STEPS}
    ver = EmployerVerification
    # Submitted = past "draft", or at least one document uploaded.
    submitted = _ids(db.query(ver.employer_id).filter(ver.employer_id.in_(ids), ver.status != "draft").distinct()) | _ids(
        db.query(ver.employer_id)
        .join(EmployerVerificationDocument, EmployerVerificationDocument.verification_id == ver.id)
        .filter(ver.employer_id.in_(ids)).distinct()
    )
    approved = _ids(db.query(ver.employer_id).filter(ver.employer_id.in_(ids), ver.status == "approved").distinct())
    posted = _ids(db.query(JobPosting.employer_id).filter(JobPosting.employer_id.in_(ids), JobPosting.status != "draft").distinct())
    applicants = _ids(
        db.query(JobPosting.employer_id).join(Application, Application.job_id == JobPosting.id)
        .filter(JobPosting.employer_id.in_(ids), JobPosting.status != "draft").distinct()
    )
    # Paid = an active/past-due subscription on any employer plan other than "free" (enterprise counts).
    paid = _ids(
        db.query(EmployerProfile.id)
        .join(CompanySubscription, CompanySubscription.company_id == EmployerProfile.company_id)
        .join(SubscriptionPlan, SubscriptionPlan.id == CompanySubscription.plan_id)
        .filter(
            EmployerProfile.id.in_(ids), CompanySubscription.status.in_(("active", "past_due")),
            SubscriptionPlan.plan_type == "employer", SubscriptionPlan.name != "free",
        ).distinct()
    )
    return {
        "registered": set(cohort), "kyc_submitted": submitted, "kyc_approved": approved,
        "job_posted": posted, "applicants": applicants, "paid": paid,
    }


def _closed_counts(steps: list[tuple[str, str]], sets: dict[str, set]) -> list[int]:
    """Counts with each step intersected with every earlier one."""
    counts, running = [], None
    for key, _ in steps:
        running = sets[key] if running is None else running & sets[key]
        counts.append(len(running))
    return counts


def _counts_for(db: Session, side: str, start: datetime, end: datetime) -> list[int]:
    if side == "aspirant":
        return _closed_counts(ASPIRANT_STEPS, _aspirant_sets(db, _aspirant_cohort(db, start, end)))
    return _closed_counts(EMPLOYER_STEPS, _employer_sets(db, _employer_cohort(db, start, end)))


def _rate(x: int, n: int) -> float | None:
    return x / n if n > 0 else None


def build_funnel(db: Session, side: str, start: datetime, end: datetime, compare: bool) -> dict[str, Any]:
    steps_def = ASPIRANT_STEPS if side == "aspirant" else EMPLOYER_STEPS
    counts = _counts_for(db, side, start, end)
    prev_counts = _counts_for(db, side, *previous_range(start, end)) if compare else None
    warnings: list[str] = []

    steps: list[dict[str, Any]] = []
    for i, ((key, label), count) in enumerate(zip(steps_def, counts)):
        first = counts[0]
        entry: dict[str, Any] = {
            "key": key, "label": label, "count": count,
            "pct_of_start": round(count / first * 100, 1) if first else 0.0,
            "pct_of_prev": None, "delta_pt": None, "low_sample": False,
        }
        if i > 0:
            entry["pct_of_prev"] = wilson(count, counts[i - 1])
            entry["low_sample"] = counts[i - 1] < LOW_SAMPLE_N
            if prev_counts is not None:
                now_rate, then_rate = _rate(count, counts[i - 1]), _rate(prev_counts[i], prev_counts[i - 1])
                if now_rate is not None and then_rate is not None:
                    entry["delta_pt"] = round((now_rate - then_rate) * 100, 1)
            if count > counts[i - 1]:
                warnings.append(f"Step '{label}' is larger than the step before it.")
        steps.append(entry)

    # Biggest leak: lowest continue-rate among steps whose previous step has enough people (ties: larger loss).
    candidates = [
        (s["pct_of_prev"]["rate"], -(counts[i - 1] - s["count"]), i)
        for i, s in enumerate(steps)
        if i > 0 and counts[i - 1] >= LOW_SAMPLE_N and s["pct_of_prev"]["rate"] is not None
    ]
    leak = None
    if candidates:
        rate, _, i = min(candidates)
        leak = {"from_key": steps[i - 1]["key"], "to_key": steps[i]["key"], "rate": round(rate, 4)}

    overall = wilson(counts[-1], counts[0]) if counts[0] else None
    if overall and prev_counts is not None and prev_counts[0]:
        overall["delta_pt"] = round((counts[-1] / counts[0] - prev_counts[-1] / prev_counts[0]) * 100, 2)

    return {
        "side": side, "steps": steps, "overall": overall, "biggest_leak": leak,
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(), "warnings": warnings,
            "from": start.isoformat(), "to": end.isoformat(), "compare": compare,
        },
    }
