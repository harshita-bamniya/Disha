"""Trace the exact failure path for form creation via HTTP with full logging."""
import requests
import logging
logging.basicConfig(level=logging.DEBUG)

BASE = "http://localhost:8000/api"

# Login as employer1
r = requests.post(f"{BASE}/auth/login",
                  json={"identifier": "employer1@disha.test", "password": "Test@1234"})
tok = r.json()["access_token"]
eh = {"Authorization": f"Bearer {tok}"}

# Get the employer's job
from app.database import SessionLocal
from app.models.user import User, EmployerProfile, JobPosting
db = SessionLocal()
emp = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp.id).first()
job = db.query(JobPosting).filter_by(employer_id=ep.id).first()
job_id = str(job.id)
print(f"Using job_id: {job_id}  title: {job.title}")
db.close()

# Try create form
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

print(f"\nPOST /jobs/{job_id}/application-form")
r = requests.post(f"{BASE}/jobs/{job_id}/application-form", json=payload, headers=eh)
print(f"Status: {r.status_code}")
print(f"Body: {r.text[:500]}")

# If it created despite 500 error, get the form
if r.status_code in (500, 201):
    r2 = requests.get(f"{BASE}/jobs/{job_id}/application-form/draft", headers=eh)
    print(f"\nGET draft form status: {r2.status_code}")
    print(f"Body: {r2.text[:200]}")
