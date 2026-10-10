"""Two permanent dummy accounts for manual / agent testing with no plan limits:

  unlimited.employer@beginablai.test   — verified company on the `enterprise`
      plan (unlimited jobs, recruiter seats and candidate search, resume access)
  unlimited.aspirant@beginablai.test   — fully onboarded, on `aspirant_premium_annual`
      (no free-tier feature-credit cap)

Both use password Test@1234. Idempotent: safe to re-run; it only creates or
repairs these two accounts and never touches other users.

    python seed_unlimited_test_accounts.py
"""
from datetime import datetime, timezone

from sqlalchemy import inspect

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.company import Company
from app.models.subscription import AspirantSubscription, CompanySubscription, SubscriptionPlan
from app.models.user import AspirantProfile, EmployerProfile, PsychologicalAssessment, Role, User

PASSWORD = "Test@1234"
FAR_FUTURE = datetime(2126, 1, 1, tzinfo=timezone.utc)
EMPLOYER_EMAIL = "unlimited.employer@beginablai.test"
ASPIRANT_EMAIL = "unlimited.aspirant@beginablai.test"
_SKIP_COLS = {"id", "user_id", "created_at", "updated_at"}


def _user(db, email, phone, role_name) -> User:
    role = db.query(Role).filter(Role.name == role_name).one()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, phone=phone, role_id=role.id)
        db.add(user)
    user.password_hash = hash_password(PASSWORD)
    user.role_id = role.id
    user.email_verified = True
    user.phone_verified = True
    user.is_active = True
    user.status = "active"
    user.deleted_at = None
    user.failed_login_attempts = 0
    db.flush()
    return user


def _plan(db, name) -> SubscriptionPlan:
    return db.query(SubscriptionPlan).filter(SubscriptionPlan.name == name).one()


def _clone_columns(model, source) -> dict:
    return {c.key: getattr(source, c.key) for c in inspect(model).mapper.column_attrs if c.key not in _SKIP_COLS}


def seed_employer(db) -> None:
    user = _user(db, EMPLOYER_EMAIL, "+913333333001", "employer")
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    company = db.get(Company, profile.company_id) if profile and profile.company_id else None
    if not company:
        company = Company(name="Unlimited Test Co", industry="IT & Technology", company_size="201-500",
                          website="https://unlimited-test.example.com", headquarters="New Delhi",
                          description="Dummy company for testing — enterprise plan, no limits.")
        db.add(company)
        db.flush()
    company.verification_status = "verified"

    if not profile:
        profile = EmployerProfile(user_id=user.id, company_name=company.name, contact_person="Unlimited Employer",
                                  designation="Founder", city="New Delhi", industry=company.industry,
                                  company_size=company.company_size, website=company.website)
        db.add(profile)
    profile.company_id = company.id
    profile.is_owner = True
    profile.is_approved = True

    sub = db.query(CompanySubscription).filter(CompanySubscription.company_id == company.id).first()
    if not sub:
        sub = CompanySubscription(company_id=company.id, plan_id=_plan(db, "enterprise").id,
                                  current_period_end=FAR_FUTURE)
        db.add(sub)
    sub.plan_id = _plan(db, "enterprise").id
    sub.status = "active"
    sub.current_period_end = FAR_FUTURE


def seed_aspirant(db) -> None:
    user = _user(db, ASPIRANT_EMAIL, "+913333333002", "aspirant")
    template = db.query(AspirantProfile).join(User, User.id == AspirantProfile.user_id) \
        .filter(User.email == "aspirant1@beginablai.test").first()

    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        values = _clone_columns(AspirantProfile, template) if template else {}
        values["full_name"] = "Unlimited Aspirant"
        profile = AspirantProfile(user_id=user.id, **values)
        db.add(profile)
    profile.current_step = 6
    profile.is_completed = True

    if not db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first():
        t = db.query(PsychologicalAssessment).join(User, User.id == PsychologicalAssessment.user_id) \
            .filter(User.email == "aspirant1@beginablai.test").first()
        if t:
            db.add(PsychologicalAssessment(user_id=user.id, **_clone_columns(PsychologicalAssessment, t)))

    plan = _plan(db, "aspirant_premium_annual")
    sub = db.query(AspirantSubscription).filter(AspirantSubscription.user_id == user.id).first()
    if not sub:
        sub = AspirantSubscription(user_id=user.id, plan_id=plan.id, current_period_end=FAR_FUTURE)
        db.add(sub)
    sub.plan_id = plan.id
    sub.status = "active"
    sub.current_period_end = FAR_FUTURE


def main() -> None:
    db = SessionLocal()
    try:
        seed_employer(db)
        seed_aspirant(db)
        db.commit()
        print(f"Employer : {EMPLOYER_EMAIL} / {PASSWORD}  (enterprise plan)")
        print(f"Aspirant : {ASPIRANT_EMAIL} / {PASSWORD}  (aspirant_premium_annual)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
