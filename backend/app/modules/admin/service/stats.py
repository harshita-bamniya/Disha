"""Admin: platform stats, activity feed, global search, analytics, billing."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.subscription import CompanySubscription, SubscriptionPlan
from app.models.user import (
    AspirantProfile,
    EmployerProfile,
    JobPosting,
    KrsScore,
    User,
)
from app.modules.admin.schemas import (
    AdminActivityItem,
    AdminStatsResponse,
    BillingOverviewResponse,
    GlobalSearchResponse,
    GlobalSearchResult,
    PlanRevenueEntry,
    RevenueTrendPoint,
)


def get_stats(db: Session) -> AdminStatsResponse:
    from app.models.applications import Application
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    total_aspirants = db.query(AspirantProfile).count()
    completed_onboarding = db.query(AspirantProfile).filter(AspirantProfile.is_completed == True).count()
    total_employers = db.query(EmployerProfile).count()
    pending_employers = (
        db.query(EmployerProfile)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(EmployerProfile.is_approved == False, User.phone_verified == True)
        .count()
    )
    approved_employers = db.query(EmployerProfile).filter(EmployerProfile.is_approved == True).count()
    total_job_postings = db.query(JobPosting).count()
    active_job_postings = db.query(JobPosting).filter(JobPosting.is_active == True).count()
    total_applications = db.query(Application).count()
    hired_count = db.query(Application).filter(Application.status == "hired").count()
    new_users_last_7d = (
        db.query(User)
        .filter(User.created_at >= seven_days_ago, User.deleted_at == None)
        .count()
    )
    new_jobs_last_7d = (
        db.query(JobPosting)
        .filter(JobPosting.created_at >= seven_days_ago)
        .count()
    )

    avg_row = db.query(func.avg(KrsScore.composite)).scalar()
    avg_krs = round(float(avg_row), 1) if avg_row else None

    return AdminStatsResponse(
        total_aspirants=total_aspirants,
        completed_onboarding=completed_onboarding,
        total_employers=total_employers,
        pending_employers=pending_employers,
        approved_employers=approved_employers,
        total_job_postings=total_job_postings,
        active_job_postings=active_job_postings,
        total_applications=total_applications,
        new_users_last_7d=new_users_last_7d,
        new_jobs_last_7d=new_jobs_last_7d,
        avg_krs_composite=avg_krs,
        hired_count=hired_count,
    )


def get_activity_feed(db: Session, limit: int = 25) -> list[AdminActivityItem]:
    from app.models.applications import Application

    items: list[AdminActivityItem] = []

    # Recent signups (aspirants only)
    recent_users = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            ~User.id.in_(db.query(User.id).join(User.employer_profile)),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    for user, profile in recent_users:
        name = profile.full_name if profile and profile.full_name else user.phone
        items.append(AdminActivityItem(
            type="signup",
            title=f"{name} joined",
            subtitle=f"{profile.city}, {profile.state}" if profile and profile.city else None,
            timestamp=user.created_at,
        ))

    # Recent applications
    recent_apps = (
        db.query(Application, AspirantProfile, JobPosting, EmployerProfile)
        .join(AspirantProfile, AspirantProfile.user_id == Application.aspirant_id, isouter=True)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .order_by(Application.created_at.desc())
        .limit(limit)
        .all()
    )
    for app, profile, job, emp in recent_apps:
        name = profile.full_name if profile and profile.full_name else "Aspirant"
        items.append(AdminActivityItem(
            type="application",
            title=f"{name} applied to {job.title}",
            subtitle=emp.company_name,
            timestamp=app.created_at,
        ))

    # Recent job postings
    recent_jobs = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .order_by(JobPosting.created_at.desc())
        .limit(limit // 2)
        .all()
    )
    for job, emp in recent_jobs:
        items.append(AdminActivityItem(
            type="job_posted",
            title=f"{emp.company_name} posted {job.title}",
            subtitle=job.sector,
            timestamp=job.created_at,
        ))

    # Sort all by timestamp descending, take top N
    items.sort(key=lambda x: x.timestamp, reverse=True)
    return items[:limit]


def global_search(db: Session, q: str, limit_per_type: int = 5) -> GlobalSearchResponse:
    """Cross-entity search across users/employers/jobs — previously each
    section had its own isolated search box with no way to ask 'where is
    this phone number / company / job title anywhere on the platform'."""
    from app.models.applications import Application

    results: list[GlobalSearchResult] = []
    pattern = f"%{q}%"

    users = (
        db.query(User, AspirantProfile)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            or_(User.phone.ilike(pattern), User.email.ilike(pattern), AspirantProfile.full_name.ilike(pattern)),
        )
        .limit(limit_per_type)
        .all()
    )
    for u, profile in users:
        results.append(GlobalSearchResult(
            type="user", id=str(u.id),
            title=(profile.full_name if profile else None) or u.email or u.phone or "Unnamed user",
            subtitle=u.phone or u.email, section="users",
        ))

    employers = (
        db.query(EmployerProfile, User)
        .join(User, EmployerProfile.user_id == User.id)
        .filter(
            User.deleted_at == None,
            or_(EmployerProfile.company_name.ilike(pattern), User.phone.ilike(pattern), User.email.ilike(pattern)),
        )
        .limit(limit_per_type)
        .all()
    )
    for emp, u in employers:
        results.append(GlobalSearchResult(
            type="employer", id=str(emp.id),
            title=emp.company_name, subtitle=u.phone or u.email, section="employers",
        ))

    jobs = (
        db.query(JobPosting, EmployerProfile)
        .join(EmployerProfile, JobPosting.employer_id == EmployerProfile.id)
        .filter(or_(JobPosting.title.ilike(pattern), EmployerProfile.company_name.ilike(pattern)))
        .limit(limit_per_type)
        .all()
    )
    for job, emp in jobs:
        results.append(GlobalSearchResult(
            type="job", id=str(job.id),
            title=job.title, subtitle=emp.company_name, section="jobs",
        ))

    apps = (
        db.query(Application, User, JobPosting)
        .join(User, Application.aspirant_id == User.id)
        .join(JobPosting, Application.job_id == JobPosting.id)
        .outerjoin(AspirantProfile, AspirantProfile.user_id == User.id)
        .filter(or_(User.phone.ilike(pattern), AspirantProfile.full_name.ilike(pattern), JobPosting.title.ilike(pattern)))
        .limit(limit_per_type)
        .all()
    )
    for app, u, job in apps:
        results.append(GlobalSearchResult(
            type="application", id=str(app.id),
            title=f"{u.phone or u.email or 'Applicant'} → {job.title}",
            subtitle=app.status, section="applications",
        ))

    return GlobalSearchResponse(query=q, results=results)


def get_analytics(
    db: Session,
    from_dt: datetime,
    to_dt: datetime,
) -> "AnalyticsResponse":
    from app.models.applications import Application
    from app.modules.admin.schemas import (
        AnalyticsPeriod,
        AnalyticsResponse,
        CohortRow,
        FunnelStage,
        ScoreBin,
        TimeSeriesPoint,
    )

    days = (to_dt.date() - from_dt.date()).days + 1

    # ── User growth ────────────────────────────────────────────────────────────
    user_rows = (
        db.query(
            func.date(User.created_at).label("d"),
            func.count(User.id),
        )
        .filter(User.created_at >= from_dt, User.created_at <= to_dt, User.deleted_at == None)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    user_growth = [TimeSeriesPoint(date=str(row[0]), count=row[1]) for row in user_rows]

    # ── Job posting volume ─────────────────────────────────────────────────────
    job_rows = (
        db.query(
            func.date(JobPosting.created_at).label("d"),
            func.count(JobPosting.id),
        )
        .filter(JobPosting.created_at >= from_dt, JobPosting.created_at <= to_dt)
        .group_by(func.date(JobPosting.created_at))
        .order_by(func.date(JobPosting.created_at))
        .all()
    )
    job_volume = [TimeSeriesPoint(date=str(row[0]), count=row[1]) for row in job_rows]

    # ── Application funnel ────────────────────────────────────────────────────
    FUNNEL_ORDER = ["applied", "shortlisted", "interview_scheduled", "interviewed", "offered", "hired", "rejected"]
    funnel_rows = (
        db.query(Application.status, func.count(Application.id))
        .filter(Application.created_at >= from_dt, Application.created_at <= to_dt)
        .group_by(Application.status)
        .all()
    )
    funnel_map = {status: cnt for status, cnt in funnel_rows}
    application_funnel = [
        FunnelStage(status=s, count=funnel_map.get(s, 0))
        for s in FUNNEL_ORDER
        if funnel_map.get(s, 0) > 0
    ]

    # ── Match score distribution ───────────────────────────────────────────────
    BINS = [("0–20", 0, 20), ("20–40", 20, 40), ("40–60", 40, 60), ("60–80", 60, 80), ("80–100", 80, 100)]
    score_rows = (
        db.query(Application.match_score)
        .filter(Application.match_score != None, Application.created_at >= from_dt, Application.created_at <= to_dt)
        .all()
    )
    scores = [row[0] for row in score_rows]
    match_score_distribution = []
    for label, lo, hi in BINS:
        count = sum(1 for s in scores if lo <= s < hi) if lo < 100 else sum(1 for s in scores if s == 100)
        match_score_distribution.append(ScoreBin(range=label, count=count))

    # ── Cohort table (last 6 completed months) ────────────────────────────────
    six_months_ago = to_dt - timedelta(days=180)
    cohort_signup_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(User.id),
        )
        .filter(User.created_at >= six_months_ago, User.deleted_at == None)
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .order_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    cohort_applied_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(Application.id.distinct()),
        )
        .join(Application, Application.aspirant_id == User.id)
        .filter(User.created_at >= six_months_ago, User.deleted_at == None)
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    cohort_hired_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(Application.id.distinct()),
        )
        .join(Application, Application.aspirant_id == User.id)
        .filter(
            User.created_at >= six_months_ago, User.deleted_at == None,
            Application.status == "hired",
        )
        .group_by(func.to_char(User.created_at, "YYYY-MM"))
        .all()
    )

    applied_map = {r[0]: r[1] for r in cohort_applied_rows}
    hired_map = {r[0]: r[1] for r in cohort_hired_rows}
    cohort_table = [
        CohortRow(month=month, signups=cnt, applied=applied_map.get(month, 0), hired=hired_map.get(month, 0))
        for month, cnt in cohort_signup_rows
    ]

    return AnalyticsResponse(
        period=AnalyticsPeriod(from_date=from_dt.strftime("%Y-%m-%d"), to_date=to_dt.strftime("%Y-%m-%d"), days=days),
        user_growth=user_growth,
        job_volume=job_volume,
        application_funnel=application_funnel,
        match_score_distribution=match_score_distribution,
        cohort_table=cohort_table,
    )


def get_billing_overview(db: Session) -> BillingOverviewResponse:
    """Platform-wide revenue visibility — previously completely absent.

    Computed from CompanySubscription/SubscriptionPlan state, not a payment
    ledger (no Payment/Invoice model exists yet, so this is MRR-by-subscription-
    state, not reconciled-against-gateway revenue). Still real, queried data —
    not mocked — and the only place an operator can see total MRR at all today.
    """
    active_subs = (
        db.query(CompanySubscription)
        .filter(CompanySubscription.status == "active")
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .all()
    )
    mrr = sum(s.plan.price_monthly for s in active_subs)
    active_count = len(active_subs)
    arpa = (mrr // active_count) if active_count else 0

    past_due_count = db.query(CompanySubscription).filter(CompanySubscription.status == "past_due").count()
    canceled_count = db.query(CompanySubscription).filter(CompanySubscription.status == "canceled").count()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_30d = db.query(CompanySubscription).filter(CompanySubscription.created_at >= thirty_days_ago).count()

    plan_rows = (
        db.query(SubscriptionPlan.id, SubscriptionPlan.name, SubscriptionPlan.price_monthly, func.count(CompanySubscription.id))
        .outerjoin(
            CompanySubscription,
            (CompanySubscription.plan_id == SubscriptionPlan.id) & (CompanySubscription.status == "active"),
        )
        .group_by(SubscriptionPlan.id, SubscriptionPlan.name, SubscriptionPlan.price_monthly)
        .order_by(SubscriptionPlan.price_monthly)
        .all()
    )
    plan_distribution = [
        PlanRevenueEntry(
            plan_id=str(pid), plan_name=name, price_monthly=price,
            company_count=count, mrr=price * count,
        )
        for pid, name, price, count in plan_rows
    ]

    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    month_rows = (
        db.query(
            func.to_char(CompanySubscription.created_at, "YYYY-MM"),
            func.count(CompanySubscription.id),
        )
        .filter(CompanySubscription.created_at >= six_months_ago)
        .group_by(func.to_char(CompanySubscription.created_at, "YYYY-MM"))
        .order_by(func.to_char(CompanySubscription.created_at, "YYYY-MM"))
        .all()
    )
    trend = [RevenueTrendPoint(month=month, new_subscriptions=count) for month, count in month_rows]

    return BillingOverviewResponse(
        mrr=mrr, arpa=arpa,
        active_subscriptions=active_count, past_due_subscriptions=past_due_count,
        canceled_subscriptions=canceled_count, new_subscriptions_30d=new_30d,
        plan_distribution=plan_distribution, trend=trend,
    )

