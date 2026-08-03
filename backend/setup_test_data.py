"""
Setup test data for integration testing:
1. Give employer1 a company
2. Create a published job owned by employer1
3. Verify seeded aspirants have completed onboarding
"""
import uuid
from sqlalchemy import text
from app.database import SessionLocal
from app.models.user import User, EmployerProfile

db = SessionLocal()

# ── Employer1: ensure company record exists ───────────────────────────────────
emp_user = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp_user.id).first()
print(f"employer1: id={emp_user.id}  profile_id={ep.id if ep else None}  company_id={ep.company_id if ep else None}")

if ep and not ep.company_id:
    # Check if a company record exists
    company = db.execute(text("SELECT id FROM companies LIMIT 1")).fetchone()
    if company:
        company_id = company[0]
        print(f"Using existing company: {company_id}")
    else:
        # Create a company
        company_id = uuid.uuid4()
        db.execute(text("""
            INSERT INTO companies (id, name, industry, city, is_verified, created_at, updated_at)
            VALUES (:id, :name, :industry, :city, true, now(), now())
        """), {
            "id": str(company_id),
            "name": "Disha Test Employer Co.",
            "industry": "Education & Training",
            "city": "Mumbai",
        })
        print(f"Created company: {company_id}")

    db.execute(text("""
        UPDATE employer_profiles SET company_id = :cid WHERE id = :pid
    """), {"cid": str(company_id), "pid": str(ep.id)})
    db.commit()
    print(f"Linked employer1 to company {company_id}")

# ── Create a published job owned by employer1 ─────────────────────────────────
existing = db.execute(text("""
    SELECT id FROM job_postings WHERE employer_id = :eid LIMIT 1
"""), {"eid": str(ep.id)}).fetchone()

if existing:
    job_id = existing[0]
    print(f"Employer1 already has job: {job_id}")
    # Ensure it is published
    db.execute(text("UPDATE job_postings SET status='published', is_active=true WHERE id=:id"), {"id": str(job_id)})
    db.commit()
else:
    job_id = uuid.uuid4()
    db.execute(text("""
        INSERT INTO job_postings (
            id, employer_id, company_id, title, description, sector,
            required_skills, min_k_score, job_type, location, employment_type,
            status, is_active, created_at, updated_at
        ) VALUES (
            :id, :eid, :cid, :title, :desc, :sector,
            :skills, :min_k, :jtype, :loc, :etype,
            'published', true, now(), now()
        )
    """), {
        "id": str(job_id),
        "eid": str(ep.id),
        "cid": str(ep.company_id) if ep.company_id else None,
        "title": "Policy Research Associate (Integration Test)",
        "desc": "Test job for integration testing of the ATS application flow.",
        "sector": "Government & Civil Services",
        "skills": "Policy Research;Data Analysis;Report Writing",
        "min_k": 0,
        "jtype": "hybrid",
        "loc": "New Delhi",
        "etype": "full_time",
    })
    db.commit()
    print(f"Created job: {job_id}")

print(f"\nEMPLOYER_JOB_ID={job_id}")

# ── Verify aspirant1 has a completed onboarding profile ──────────────────────
asp = db.query(User).filter_by(email="aspirant1@disha.test").first()
profile = db.execute(text("SELECT id, current_step FROM aspirant_profiles WHERE user_id=:uid"), {"uid": str(asp.id)}).fetchone()
if profile:
    print(f"aspirant1 profile: id={profile[0]}  current_step={profile[1]}")
else:
    print("aspirant1 HAS NO PROFILE — check seed data")

db.close()
print("\nSetup complete.")
