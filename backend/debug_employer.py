"""Debug employer auth path for create_form."""
from app.database import SessionLocal
from app.models.user import User, EmployerProfile, JobPosting
from sqlalchemy import text
import uuid

db = SessionLocal()

# employer1 details
emp_user = db.query(User).filter_by(email="employer1@disha.test").first()
print(f"employer1 user.id: {emp_user.id}")

# EmployerProfile
ep = db.query(EmployerProfile).filter_by(user_id=emp_user.id).first()
print(f"EmployerProfile: id={ep.id if ep else None}  company_id={ep.company_id if ep else 'NO PROFILE'}")

# Published jobs
pub_jobs = db.query(JobPosting).filter_by(status="published").limit(5).all()
print(f"\nPublished jobs ({len(pub_jobs)}):")
for j in pub_jobs:
    print(f"  id={j.id}  employer_id={j.employer_id}  company_id={j.company_id}  title={j.title[:40]}")

# Test the auth check against first published job
if pub_jobs and ep:
    job = pub_jobs[0]
    print(f"\nAuth check for job {job.id}:")
    print(f"  job.employer_id = {job.employer_id}")
    print(f"  ep.id           = {ep.id}")
    print(f"  job.company_id  = {job.company_id}")
    print(f"  ep.company_id   = {ep.company_id}")

    match_employer = job.employer_id == ep.id
    match_company = job.company_id == ep.company_id
    print(f"  employer match: {match_employer}")
    print(f"  company match: {match_company}")

    if not match_employer and not match_company:
        print("  => WOULD RAISE ForbiddenException")
    else:
        print("  => AUTH PASSES")

# Check EmployerProfile columns
import inspect
cols = [c.key for c in EmployerProfile.__table__.columns]
print(f"\nEmployerProfile columns: {cols}")

db.close()
