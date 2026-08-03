"""Debug form creation directly."""
import traceback
from app.database import SessionLocal
from app.models.user import User
from app.modules.application_forms import service
from app.modules.application_forms.schemas import ApplicationFormCreateIn, FormSettingsIn

db = SessionLocal()

# Use employer1
emp_user = db.query(User).filter_by(email="employer1@disha.test").first()
print(f"employer: {emp_user.id}")

# Use first published job ID
from sqlalchemy import text
rows = db.execute(text("SELECT id, employer_id, company_id FROM job_postings WHERE status='published' LIMIT 1")).fetchall()
job_id = str(rows[0][0])
print(f"job_id: {job_id}  employer_id={rows[0][1]}  company_id={rows[0][2]}")

# Try creating a form
body = ApplicationFormCreateIn(
    settings=FormSettingsIn(
        resume_config="required",
        require_cover_letter="optional",
        require_portfolio="hidden",
        require_work_authorization=False,
        allow_attachments=False,
        max_attachment_size_mb=10,
    )
)

try:
    form = service.create_form(job_id, body, emp_user, db)
    print(f"SUCCESS: form_id={form.id}  status={form.status}")
except Exception as e:
    print(f"EXCEPTION ({type(e).__name__}): {e}")
    traceback.print_exc()

db.close()
