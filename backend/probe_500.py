"""Hit the POST create-form endpoint and print the exact error response."""
import requests

BASE = "http://localhost:8000/api"

r = requests.post(f"{BASE}/auth/login",
                  json={"identifier": "employer1@disha.test", "password": "Test@1234"})
tok = r.json()["access_token"]
eh = {"Authorization": f"Bearer {tok}"}

# Find a job without a form
from app.database import SessionLocal
from app.models.user import User, EmployerProfile, JobPosting
from sqlalchemy import text

db = SessionLocal()
emp = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp.id).first()
jobs = db.query(JobPosting).filter_by(employer_id=ep.id).all()

target_id = None
for j in jobs:
    cnt = db.execute(text("SELECT count(*) FROM ats_application_forms WHERE job_id=:jid"),
                     {"jid": str(j.id)}).scalar()
    print(f"  job {j.id} '{j.title}'  forms={cnt}")
    if cnt == 0 and target_id is None:
        target_id = str(j.id)

db.close()

if not target_id:
    print("No job without a form — deleting one form for a fresh test...")
    db2 = SessionLocal()
    # delete the form on the first job
    first_job = jobs[0]
    db2.execute(text("DELETE FROM ats_application_forms WHERE job_id=:jid"), {"jid": str(first_job.id)})
    db2.commit()
    db2.close()
    target_id = str(first_job.id)
    print(f"Deleted form for job {target_id}, will recreate")

payload = {
    "settings": {
        "resume_config": "optional",
        "require_cover_letter": "optional",
        "require_portfolio": "hidden",
        "require_work_authorization": False,
        "allow_attachments": False,
        "max_attachment_size_mb": 10,
    }
}

print(f"\nPOST /api/jobs/{target_id}/application-form")
r2 = requests.post(f"{BASE}/jobs/{target_id}/application-form", json=payload, headers=eh)
print(f"Status: {r2.status_code}")
print(f"Body: {r2.text}")
