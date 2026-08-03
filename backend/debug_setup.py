"""Debug script — check employer/job setup before running integration tests."""
from app.database import SessionLocal
from app.models.user import User, EmployerProfile
from sqlalchemy import text

db = SessionLocal()

# Employer 1 details
emp = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp.id).first() if emp else None
print(f"employer1 user_id: {emp.id if emp else 'NOT FOUND'}")
print(f"employer1 is_approved: {ep.is_approved if ep else 'NO PROFILE'}")
print(f"employer1 company_id: {ep.company_id if ep else 'NONE'}")

if ep and ep.company_id:
    rows = db.execute(
        text("SELECT id, title, status FROM job_postings WHERE company_id = :cid LIMIT 10"),
        {"cid": str(ep.company_id)}
    ).fetchall()
    print(f"\njobs owned by employer1 company: {len(rows)}")
    for r in rows:
        print(f"  {r[0]}  '{r[1]}'  {r[2]}")
else:
    print("\nNo company_id — employer has no company yet")

# All published jobs
pub = db.execute(
    text("SELECT id, title, company_id FROM job_postings WHERE status = 'published' LIMIT 5")
).fetchall()
print(f"\nAll published jobs: {len(pub)}")
for r in pub:
    print(f"  {r[0]}  '{r[1]}'  company={r[2]}")

# Check application_forms table
try:
    af = db.execute(text("SELECT id, job_id, status FROM application_forms LIMIT 5")).fetchall()
    print(f"\nExisting application_forms: {len(af)}")
    for r in af:
        print(f"  {r[0]}  job={r[1]}  {r[2]}")
except Exception as e:
    print(f"\napplication_forms table error: {e}")

# Check applications table
try:
    apps = db.execute(text("SELECT id, job_id, status, reference_number FROM applications LIMIT 5")).fetchall()
    print(f"\nExisting applications: {len(apps)}")
    for r in apps:
        print(f"  {r[0]}  job={r[1]}  {r[2]}  ref={r[3]}")
except Exception as e:
    print(f"\napplications table error: {e}")

db.close()
