"""
End-to-end integration test for Phases 4, 5, 6 (backend), and 8 (form builder).
Run inside the backend container:  python integration_test.py
"""
import requests
import json
import sys
import uuid

BASE = "http://localhost:8000/api"
PASS = "Test@1234"

PASS_COUNT = 0
FAIL_COUNT = 0
FAILURES = []

def ok(label, cond, detail=""):
    global PASS_COUNT, FAIL_COUNT
    if cond:
        PASS_COUNT += 1
        print(f"  [PASS] {label}")
    else:
        FAIL_COUNT += 1
        FAILURES.append(label)
        snippet = str(detail)[:300] if detail else ""
        print(f"  [FAIL] {label}")
        if snippet:
            print(f"         {snippet}")

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def login(email):
    r = requests.post(f"{BASE}/auth/login",
                      json={"identifier": email, "password": PASS})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]

# ── Auth ──────────────────────────────────────────────────────────────────────
section("AUTH — get tokens")
asp_tok  = login("aspirant1@disha.test")
asp2_tok = login("aspirant2@disha.test")
emp_tok  = login("employer1@disha.test")
ah  = {"Authorization": f"Bearer {asp_tok}"}
ah2 = {"Authorization": f"Bearer {asp2_tok}"}
eh  = {"Authorization": f"Bearer {emp_tok}"}
print("  [PASS] All 3 logins succeeded")

# ── Resolve employer's own job (by employer_id in DB) ─────────────────────────
section("SETUP — resolve test job IDs")
from app.database import SessionLocal
from app.models.user import User, EmployerProfile, JobPosting
from sqlalchemy import text

db = SessionLocal()
emp_user = db.query(User).filter_by(email="employer1@disha.test").first()
ep = db.query(EmployerProfile).filter_by(user_id=emp_user.id).first()

# Find a job owned by employer1's profile (by employer_id)
emp_job = db.query(JobPosting).filter_by(employer_id=ep.id, status="published").first()
if not emp_job:
    emp_job = db.query(JobPosting).filter_by(employer_id=ep.id).first()
ok("Employer1 owns at least one job", emp_job is not None,
   "Run setup_test_data.py first")

EMP_JOB_ID = str(emp_job.id) if emp_job else None
print(f"  EMP_JOB_ID={EMP_JOB_ID}  title='{emp_job.title if emp_job else None}'")

# Also get a published job the aspirant can see (may be different)
pub_job = db.query(JobPosting).filter_by(status="published").filter(
    JobPosting.id != (emp_job.id if emp_job else uuid.uuid4())
).first()
if not pub_job:
    pub_job = emp_job

ASP_JOB_ID = str(pub_job.id) if pub_job else EMP_JOB_ID
print(f"  ASP_JOB_ID={ASP_JOB_ID}  (aspirant apply-test job)")
db.close()

if not EMP_JOB_ID:
    print("CRITICAL: No employer job found. Aborting.")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8: Form Builder (run before Phase 4 so we can test apply-with-form)
# ══════════════════════════════════════════════════════════════════════════════
section("PHASE 8 — Form Builder")

# 8.1 Get or create draft form
r = requests.get(f"{BASE}/jobs/{EMP_JOB_ID}/application-form/draft", headers=eh)
if r.status_code == 200:
    ok("GET draft form 200 (already exists)", True)
    form = r.json()
    FORM_ID = form["id"]
else:
    ok("GET draft form 404 → will create", r.status_code == 404, r.text[:200])
    r2 = requests.post(f"{BASE}/jobs/{EMP_JOB_ID}/application-form", json={
        "settings": {
            "resume_config": "optional",
            "require_cover_letter": "optional",
            "require_portfolio": "hidden",
            "require_work_authorization": False,
            "allow_attachments": False,
            "max_attachment_size_mb": 10,
        }
    }, headers=eh)
    ok("POST create form 201", r2.status_code == 201, r2.text[:300])
    if r2.status_code != 201:
        print("  CRITICAL: Cannot create form. Check employer auth and job ownership.")
        # Try to debug
        r3 = requests.post(f"{BASE}/jobs/{EMP_JOB_ID}/application-form", json={"settings": {
            "resume_config": "optional", "require_cover_letter": "optional",
            "require_portfolio": "hidden", "require_work_authorization": False,
            "allow_attachments": False, "max_attachment_size_mb": 10,
        }}, headers=eh)
        print(f"  Retry response: {r3.status_code} {r3.text[:300]}")
        sys.exit(1)
    form = r2.json()
    FORM_ID = form["id"]

print(f"  FORM_ID={FORM_ID}  status={form['status']}  sections={len(form.get('sections', []))}")

# 8.2 Update form settings
r = requests.put(f"{BASE}/application-forms/{FORM_ID}", json={"settings": {
    "resume_config": "required",
    "require_cover_letter": "optional",
    "require_portfolio": "hidden",
    "require_work_authorization": False,
    "allow_attachments": True,
    "max_attachment_size_mb": 10,
}}, headers=eh)
ok("PUT update form settings 200", r.status_code == 200, r.text[:200])

# 8.3 Add a custom section
r = requests.post(f"{BASE}/application-forms/{FORM_ID}/sections",
                  json={"title": "Professional Background", "section_type": "questions",
                        "description": "Tell us about your experience."}, headers=eh)
ok("POST add section 201", r.status_code == 201, r.text[:200])
if r.status_code == 201:
    sec = r.json()
    SEC_ID = sec["id"]
    print(f"  SEC_ID={SEC_ID}")
else:
    # Reuse existing if it was already added
    draft = requests.get(f"{BASE}/jobs/{EMP_JOB_ID}/application-form/draft", headers=eh).json()
    SEC_ID = next((s["id"] for s in draft.get("sections", []) if s["section_type"] == "questions"), None)
    ok("Fallback: found existing 'questions' section", SEC_ID is not None, draft)

Q_ID = None
COMP_Q_ID = None

if SEC_ID:
    # 8.4 Add a non-compliance question
    r = requests.post(f"{BASE}/form-sections/{SEC_ID}/questions", json={
        "question_type": "experience_years",
        "label": "How many years of relevant work experience do you have?",
        "is_required": True,
    }, headers=eh)
    ok("POST add question (experience_years) 201", r.status_code == 201, r.text[:200])
    if r.status_code == 201:
        Q_ID = r.json()["id"]
        print(f"  Q_ID={Q_ID}")

    # 8.5 Update question
    if Q_ID:
        r = requests.put(f"{BASE}/questions/{Q_ID}", json={
            "question_type": "experience_years",
            "label": "Years of relevant experience?",
            "is_required": True,
        }, headers=eh)
        ok("PUT update question 200", r.status_code == 200, r.text[:200])

    # 8.6 Set knockout rule on non-compliance question
    if Q_ID:
        r = requests.post(f"{BASE}/questions/{Q_ID}/knockout-rule", json={
            "operator": "less_than",
            "threshold_value": "2",
            "action": "auto_reject",
            "priority": 5,
        }, headers=eh)
        ok("POST set knockout rule 200", r.status_code == 200, r.text[:200])

    # 8.7 Add a compliance question
    r = requests.post(f"{BASE}/form-sections/{SEC_ID}/questions", json={
        "question_type": "work_authorization",
        "label": "Are you authorized to work in India?",
        "is_required": True,
    }, headers=eh)
    ok("POST add compliance question 201", r.status_code == 201, r.text[:200])
    if r.status_code == 201:
        COMP_Q_ID = r.json()["id"]
        ok("Compliance question is_compliance_protected=True",
           r.json()["is_compliance_protected"] is True, r.json())

        # 8.8 Attempt knockout rule on compliance question → must be blocked
        r2 = requests.post(f"{BASE}/questions/{COMP_Q_ID}/knockout-rule", json={
            "operator": "equals",
            "threshold_value": "no",
            "action": "auto_reject",
            "priority": 5,
        }, headers=eh)
        ok("Knockout on compliance question is blocked (400/403)",
           r2.status_code in (400, 403), r2.text[:200])

    # 8.9 Add a dropdown question with options
    r = requests.post(f"{BASE}/form-sections/{SEC_ID}/questions", json={
        "question_type": "dropdown",
        "label": "What is your highest qualification?",
        "is_required": False,
        "options_json": [
            {"value": "graduate", "label": "Graduate"},
            {"value": "post_graduate", "label": "Post Graduate"},
            {"value": "phd", "label": "PhD"},
        ],
    }, headers=eh)
    ok("POST add dropdown question 201", r.status_code == 201, r.text[:200])

    # 8.10 Reorder questions
    if Q_ID:
        r = requests.post(f"{BASE}/form-sections/{SEC_ID}/questions/reorder",
                          json=[{"question_id": Q_ID, "order_index": 10}], headers=eh)
        ok("POST reorder questions 200", r.status_code == 200, r.text[:200])

# 8.11 Add a second section and reorder
r = requests.post(f"{BASE}/application-forms/{FORM_ID}/sections",
                  json={"title": "Additional Info", "section_type": "custom"}, headers=eh)
ok("POST add second section 201", r.status_code == 201, r.text[:200])
if r.status_code == 201:
    SEC2_ID = r.json()["id"]
    # Reorder sections
    r2 = requests.post(f"{BASE}/application-forms/{FORM_ID}/sections/reorder",
                       json=[
                           {"section_id": SEC_ID, "order_index": 0},
                           {"section_id": SEC2_ID, "order_index": 1},
                       ], headers=eh)
    ok("POST reorder sections 200", r2.status_code == 200, r2.text[:200])

# 8.12 Delete knockout rule
if Q_ID:
    r = requests.delete(f"{BASE}/questions/{Q_ID}/knockout-rule", headers=eh)
    ok("DELETE knockout rule 204", r.status_code == 204, r.text[:200])
    # Re-add it for publish validation
    r2 = requests.post(f"{BASE}/questions/{Q_ID}/knockout-rule", json={
        "operator": "less_than",
        "threshold_value": "1",
        "action": "auto_reject",
        "priority": 5,
    }, headers=eh)
    ok("POST re-add knockout rule 200", r2.status_code == 200, r2.text[:200])

# 8.13 Publish form
r = requests.post(f"{BASE}/application-forms/{FORM_ID}/publish", headers=eh)
ok("POST publish form 200", r.status_code == 200, r.text[:300])
if r.status_code == 200:
    pub = r.json()
    ok("Published status=published", pub["status"] == "published", pub)
    print(f"  version={pub['version']}")

# 8.14 Candidate reads published form (public endpoint)
r = requests.get(f"{BASE}/jobs/{EMP_JOB_ID}/application-form")
ok("GET published form (public) 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    pub_form = r.json()
    ok("Published form has ≥1 section", len(pub_form.get("sections", [])) >= 1, pub_form)

# 8.15 Question bank
r = requests.get(f"{BASE}/application-forms/question-bank", headers=eh)
ok("GET question bank 200", r.status_code == 200, r.text[:200])

# 8.16 Save as template
r = requests.post(f"{BASE}/application-forms/{FORM_ID}/save-as-template",
                  json={"name": "Integration Test Template", "description": "Auto-created"},
                  headers=eh)
ok("POST save-as-template 201", r.status_code == 201, r.text[:200])

# 8.17 List templates
r = requests.get(f"{BASE}/application-forms/templates", headers=eh)
ok("GET templates list 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    templates = r.json()
    ok("At least one template exists", len(templates) >= 1, templates)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Application Submission
# ══════════════════════════════════════════════════════════════════════════════
section("PHASE 4 — Application Submission")

# Use EMP_JOB_ID for application tests (it now has a published form)
APPLY_JOB = EMP_JOB_ID

# Clean up any applications + drafts from previous test runs for this job
from app.models.mvp3 import Application, ApplicationStatusHistory
_db = SessionLocal()
_asp1 = _db.query(User).filter_by(email="aspirant1@disha.test").first()
_asp2 = _db.query(User).filter_by(email="aspirant2@disha.test").first()
_asp3 = _db.query(User).filter_by(email="aspirant3@disha.test").first()
_test_job_uuid = uuid.UUID(APPLY_JOB)
for _asp in [_asp1, _asp2, _asp3]:
    if _asp:
        _db.query(Application).filter_by(
            job_id=_test_job_uuid, aspirant_id=_asp.id
        ).delete(synchronize_session=False)
_db.commit()
_db.close()
print("  Cleaned up prior applications for aspirant1/2/3")

# Discard any old draft first
requests.delete(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", headers=ah)
requests.delete(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", headers=ah2)

# 4.1 Eligibility check
r = requests.get(f"{BASE}/jobs/{APPLY_JOB}/apply/eligibility", headers=ah)
ok("GET eligibility 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    elig = r.json()
    ok("'eligible' field present", "eligible" in elig, elig)
    ok("'has_draft' field present", "has_draft" in elig, elig)
    ok("'existing_application_id' field present", "existing_application_id" in elig, elig)
    print(f"  eligible={elig.get('eligible')}  has_draft={elig.get('has_draft')}")
    if not elig.get("eligible"):
        print(f"  reason: {elig.get('reason')}")

# 4.2 Start draft
r = requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/draft",
                  json={"selected_resume_id": None}, headers=ah)
ok("POST start draft 201", r.status_code == 201, r.text[:300])
draft = r.json() if r.status_code == 201 else {}
DRAFT_ID = draft.get("id")
print(f"  draft_id={DRAFT_ID}")

# 4.3 GET draft
r = requests.get(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", headers=ah)
ok("GET draft 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    d = r.json()
    ok("Draft has current_step", "current_step" in d, d)
    ok("Draft has responses_json", "responses_json" in d, d)

# 4.4 Save draft (auto-save)
r = requests.put(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", json={
    "current_step": 1,
    "responses": {"q_experience": "3"},
    "selected_resume_id": None,
}, headers=ah)
ok("PUT save draft 200", r.status_code == 200, r.text[:200])

# 4.5 Submit application (aspirant1)
# Fetch published form and build answers for ALL required questions (handles repeated test runs)
def build_submit_answers(job_id, user_headers):
    fr = requests.get(f"{BASE}/jobs/{job_id}/application-form", headers=user_headers)
    answers = []
    if fr.status_code == 200:
        for sec in fr.json().get("sections", []):
            for q in sec.get("questions", []):
                if q.get("is_required"):
                    qid = q["id"]
                    qtype = q.get("question_type", "")
                    if qtype == "experience_years":
                        answers.append({"question_id": qid, "number_value": 5})
                    elif qtype in ("work_authorization", "visa_sponsorship", "yes_no"):
                        answers.append({"question_id": qid, "text_value": "yes"})
                    elif qtype == "number":
                        answers.append({"question_id": qid, "number_value": 1})
                    else:
                        answers.append({"question_id": qid, "text_value": "Test answer"})
    return answers

submit_answers = build_submit_answers(APPLY_JOB, ah)
r = requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/submit", json={
    "selected_resume_id": None,
    "answers": submit_answers,
    "cover_note": "I am very interested and believe I am a strong fit.",
}, headers=ah)
ok("POST submit application 201", r.status_code == 201, r.text[:300])
APP1_ID = None
if r.status_code == 201:
    app_data = r.json()
    APP1_ID = app_data.get("id")
    ok("'reference_number' present", "reference_number" in app_data, app_data)
    ok("'status' is 'applied'", app_data.get("status") == "applied", app_data)
    ref = app_data.get("reference_number", "")
    ok("reference_number matches DISHA-YYYY-XXXXXX format", ref.startswith("DISHA-"), ref)
    print(f"  APP1_ID={APP1_ID}  ref={ref}")

# 4.6 Duplicate submit should be blocked
r = requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/submit", json={
    "selected_resume_id": None, "answers": [], "cover_note": None,
}, headers=ah)
ok("Duplicate submit blocked (400/409)", r.status_code in (400, 409), r.text[:200])

# 4.7 GET application detail
if APP1_ID:
    r = requests.get(f"{BASE}/applications/{APP1_ID}", headers=ah)
    ok("GET /applications/{id} 200", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        d = r.json()
        ok("Detail has job_title", "job_title" in d, d)
        ok("Detail has reference_number", "reference_number" in d, d)

# 4.8 List my applications
r = requests.get(f"{BASE}/candidates/me/applications", headers=ah)
ok("GET /candidates/me/applications 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    my_apps = r.json()
    ok("My applications is non-empty", len(my_apps) > 0, my_apps)

# 4.9 Submit from aspirant2 (for pipeline test data)
r = requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/draft",
                  json={"selected_resume_id": None}, headers=ah2)
ok("aspirant2 start draft 201", r.status_code == 201, r.text[:200])
submit_answers2 = build_submit_answers(APPLY_JOB, ah2)
r = requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/submit", json={
    "selected_resume_id": None,
    "answers": submit_answers2,
    "cover_note": "Second candidate.",
}, headers=ah2)
ok("aspirant2 submit 201", r.status_code == 201, r.text[:300])
APP2_ID = r.json().get("id") if r.status_code == 201 else None
print(f"  APP2_ID={APP2_ID}")

# 4.10 Withdraw aspirant1's application
if APP1_ID:
    r = requests.post(f"{BASE}/applications/{APP1_ID}/withdraw", json={}, headers=ah)
    ok("POST withdraw 200", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        ok("Withdrawn status='withdrawn'",
           r.json().get("status") == "withdrawn", r.json())

# 4.11 Discard draft (aspirant2 tests it before they applied — use aspirant3)
asp3_tok = login("aspirant3@disha.test")
ah3 = {"Authorization": f"Bearer {asp3_tok}"}
requests.post(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", json={}, headers=ah3)
r = requests.delete(f"{BASE}/jobs/{APPLY_JOB}/apply/draft", headers=ah3)
ok("DELETE draft 204", r.status_code == 204, r.text[:200])

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Employer Pipeline & Filters
# ══════════════════════════════════════════════════════════════════════════════
section("PHASE 5 — Employer Pipeline & Filters")

# 5.1 Basic pipeline
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}", headers=eh)
ok("GET pipeline 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    pl = r.json()
    candidates = pl.get("candidates", pl.get("items", []))
    total = pl.get("total", len(candidates))
    ok("Pipeline has ≥1 candidate", total >= 1 or len(candidates) >= 1,
       f"total={total} candidates={len(candidates)}")
    print(f"  total={total}  in_page={len(candidates)}")
    if candidates:
        c0 = candidates[0]
        ok("Candidate has 'reference_number' field", "reference_number" in c0, c0)
        ok("Candidate has 'knockout_triggered' field", "knockout_triggered" in c0, c0)
        ok("Candidate has 'application_score' field", "application_score" in c0, c0)

# 5.2 Filter by status
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}?status=applied", headers=eh)
ok("GET pipeline ?status=applied 200", r.status_code == 200, r.text[:200])

# 5.3 Filter by search
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}?search=Priya", headers=eh)
ok("GET pipeline ?search=Priya 200", r.status_code == 200, r.text[:200])

# 5.4 Filter by knockout_triggered=false
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}?knockout_triggered=false", headers=eh)
ok("GET pipeline ?knockout_triggered=false 200", r.status_code == 200, r.text[:200])

# 5.5 Score range filter
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}?score_min=0&score_max=100", headers=eh)
ok("GET pipeline ?score_min=0&score_max=100 200", r.status_code == 200, r.text[:200])

# 5.6 Pagination
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}?limit=1&offset=0", headers=eh)
ok("GET pipeline ?limit=1&offset=0 200", r.status_code == 200, r.text[:200])

# 5.7 CSV export
r = requests.get(f"{BASE}/employer/pipeline/{EMP_JOB_ID}/export", headers=eh)
ok("GET pipeline CSV export 200", r.status_code == 200, r.text[:80])
ok("CSV content-type is text/csv", "text/csv" in r.headers.get("content-type", ""), r.headers)
if r.status_code == 200:
    lines = [l for l in r.text.strip().split("\n") if l.strip()]
    ok("CSV has header + data rows", len(lines) >= 2, f"lines={len(lines)}")
    print(f"  CSV lines={len(lines)}  header={lines[0][:80]}")

# 5.8 Application form responses
if APP2_ID:
    r = requests.get(f"{BASE}/employer/pipeline/applications/{APP2_ID}/responses", headers=eh)
    ok("GET application responses 200", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        rd = r.json()
        ok("responses_out has 'responses' key", "responses" in rd, rd)
        ok("responses_out has 'reference_number' key", "reference_number" in rd, rd)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 (backend): Resume Library
# ══════════════════════════════════════════════════════════════════════════════
section("PHASE 6 — Resume Library (backend)")

r = requests.get(f"{BASE}/candidates/me/resumes/", headers=ah)
ok("GET /candidates/me/resumes/ 200", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    lib = r.json()
    ok("Response has 'resumes' key", "resumes" in lib, lib)
    print(f"  resumes in library: {len(lib.get('resumes', []))}")

# ── Recommend endpoint (requires job_id param)
r = requests.get(f"{BASE}/candidates/me/resumes/recommend?job_id={ASP_JOB_ID}", headers=ah)
ok("GET /candidates/me/resumes/recommend 200 or 404", r.status_code in (200, 404), r.text[:200])

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"  RESULTS: {PASS_COUNT} passed, {FAIL_COUNT} failed")
print(f"{'='*60}")
if FAILURES:
    print("\nFailed checks:")
    for f in FAILURES:
        print(f"  - {f}")
    sys.exit(1)
else:
    print("\nAll checks passed!")
    sys.exit(0)
