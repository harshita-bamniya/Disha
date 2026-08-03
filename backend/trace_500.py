"""Directly call service.create_form and capture the full exception."""
import traceback
from app.database import SessionLocal
from app.models.user import User, EmployerProfile, JobPosting
from app.modules.application_forms import service
from app.modules.application_forms.schemas import ApplicationFormCreateIn, FormSettingsIn
from sqlalchemy import text

db = SessionLocal()
emp = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp.id).first()

# Find a job that does NOT yet have a form
jobs = db.query(JobPosting).filter_by(employer_id=ep.id).all()
print(f"Jobs owned by employer1 ({ep.id}): {len(jobs)}")
for j in jobs:
    count = db.execute(
        text("SELECT count(*) FROM ats_application_forms WHERE job_id = :jid"),
        {"jid": str(j.id)}
    ).scalar()
    print(f"  {j.id}  '{j.title}'  status={j.status}  forms={count}")

# Pick one without a form
target = next((j for j in jobs
               if db.execute(text("SELECT count(*) FROM ats_application_forms WHERE job_id=:jid"),
                             {"jid": str(j.id)}).scalar() == 0), None)

if not target:
    print("\nAll jobs already have forms. Checking existing form query:")
    for j in jobs:
        r = db.execute(text("SELECT id, status FROM ats_application_forms WHERE job_id=:jid"),
                       {"jid": str(j.id)}).fetchone()
        if r:
            print(f"  job {j.id}: form_id={r[0]}  form_status={r[1]}")
    db.close()
    print("Nothing to test — all forms exist. GET draft should work.")
else:
    print(f"\nTesting create_form on job: {target.id}")
    body = ApplicationFormCreateIn(settings=FormSettingsIn(
        resume_config="optional",
        require_cover_letter="optional",
        require_portfolio="hidden",
        require_work_authorization=False,
        allow_attachments=False,
        max_attachment_size_mb=10,
    ))
    try:
        form = service.create_form(str(target.id), body, emp, db)
        print(f"SUCCESS: form_id={form.id}  status={form.status}  sections={len(form.sections)}")
    except Exception as e:
        print(f"EXCEPTION ({type(e).__name__}): {e}")
        traceback.print_exc()

db.close()
