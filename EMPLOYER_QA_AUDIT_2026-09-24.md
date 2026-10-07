# Employer-Side End-to-End QA Audit — 2026-09-24

**Tester role:** Acted as a real paying employer ("Horizon Analytics Pvt Ltd", Standard plan) end-to-end — signup, KYC, departments, job posting, candidate applications, and the full ATS pipeline — plus two fresh aspirant accounts created to generate real applications.

**Environment:** Local Docker stack (`beginablai_backend`, `beginablai_frontend`, `beginablai_postgres`, `beginablai_redis`, `beginablai_worker`), frontend at `localhost:5173`, backend at `localhost:8000`.

**Scope:** Employer registration → KYC → departments → job posting → aspirant registration/onboarding → job application → ATS pipeline (screening/shortlist/interview/offer) → Talent Pool, Support, Calendar, Billing, Company Profile.

---

## Methodology notes (read before the bug list)

Two points in the walkthrough required a direct database write because the product's own UI offered no path forward. Both are documented as bugs below (#1 and #3), not just workarounds:

- **Email/OTP verification**: the environment sends real email via Brevo, so a fabricated `@disha.test` address can't receive the OTP. Bypassed by setting `users.email_verified = true` directly. This is expected in this environment and is *not* itself a bug.
- **Admin KYC approval**: could not be done via the admin console because **admin login itself does not work** (Bug #1). Approved the company's verification by writing directly to `employer_verifications` / `employer_profiles.is_approved`, mirroring exactly what `admin/service/employers.py::review_employer_verification` would have done.
- **Recruiter seat limit**: free plan blocked inviting any teammate (Bug #3 confirms this is a real bug, not a config issue). Upgraded the DB-level subscription to "Standard" to continue testing rather than staying blocked.

---

## Bugs — ranked by severity

### 🔴 Critical

#### 1. Admin and super_admin cannot log in through the UI at all — ✅ FIXED 2026-09-24
> **Fix applied:** per product decision, admin login stays email+password only (no phone-based login was added to the form). Migration `backend/alembic/versions/d94ac2fe1001_admin_login_by_email.py` gives the seeded `admin`/`super_admin` accounts a real email (`admin@disha.test` / `superadmin@disha.test`), matched by role name rather than a hardcoded phone number (the super_admin phone had already drifted once in this environment). Zero frontend changes were needed — the login form was already email-only. Verified live: both accounts now log in and reach `/admin/dashboard`; the KYC Queue was confirmed reachable and showed one real employer verification ("Galaxy") that had been sitting unactioned for 4 days, past SLA, purely because no one could log in to approve it — solid confirmation of the original severity. Credentials updated in `user_credentials.md`.
- **Where:** `frontend/src/modules/auth/pages/LoginPage.tsx`
- **Repro:** Go to `/auth/login`. The only field is `type="email"` with `inputMode="email"`. Try typing a phone number (e.g. `9000000000`, the seeded admin's login per `user_credentials.md`).
- **Result:** The browser's native HTML5 validation blocks submission ("Please include an '@' in the email address...") before any request is even sent.
- **Why it's real:** Checked the DB — both `admin` and `super_admin` seeded accounts have a `phone` and **no `email`** (`SELECT phone, email FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name IN ('admin','super_admin')` → both rows have empty `email`). There is no separate admin login page or route. The backend error string `"Incorrect phone/email or password"` implies phone login should work — the frontend just never allows it to be typed.
- **Impact:** Nobody can reach `/admin/*` (KYC queue, employer approvals, sub-admins, roles, platform settings) through the product. Every admin action currently requires direct DB access.
- **Fix direction:** Either give admin/super_admin accounts an email, or drop `type="email"`/`inputMode="email"` and let the identifier field accept both, matching the backend's own stated behavior.

#### 2. Company owners cannot post a job — in any department — ✅ FIXED 2026-09-24
> **Fix applied:** researched how LinkedIn Recruiter and Naukri handle this — on both, the top-level org role (LinkedIn's Recruiter Admin, Naukri's super-user) can post jobs directly; scoped seats are an *additional* capability granted downstream, not the only path to posting. So this was a real bug, not a deliberate split, despite a backend comment claiming parity with those platforms. Removed the `BadRequestException` in `backend/app/modules/jobs/service.py::create_job` that rejected any company-wide profile outright (the department-resolution logic right after it, `_resolve_department_id`, already handled a company-wide caller correctly — it just was never reached). Updated `DepartmentDetailPage.tsx`'s `isMyDepartment` check to also pass when `myPerms.is_company_wide` is true (a field the permissions API already returned but the frontend wasn't using). Verified live: "New Job" now renders for the owner in every department, and job creation succeeds.
- **Where:** `frontend/src/modules/employer/pages/DepartmentDetailPage.tsx:577` and `:668`
- **Repro:** Log in as a company **owner** (not a department-scoped recruiter). Open any department workspace → Jobs tab. There is no "New Job" button anywhere, despite the empty state literally saying *"Post the first job for \<department\>."* The Dashboard's own "Post a Job" button routes to `/app/employer/jobs`, which says *"Jobs are created from within a department's own workspace. Open a department to post one."* — which loops back to the same dead end.
- **Root cause:** Both "New Job" buttons are gated by:
  ```
  const isMyDepartment = myPerms?.department_id === id
  {canCreateJob && isMyDepartment && <Button>New Job</Button>}
  ```
  `myPerms.department_id` is `null` for company-wide roles (owner, hr_admin) by design — so it can never equal any specific department's UUID. The check only ever passes for a recruiter who is scoped to that exact department.
- **Confirmed by isolation test:** Invited a recruiter scoped to "Policy Research" — the "New Job" button appeared immediately for that account and posting worked. The bug is specific to company-wide roles.
- **Impact:** The primary reason an employer pays for the product — posting jobs — is unusable for the account type (owner) that signs up and pays. Every owner needs a workaround (create a dummy scoped recruiter, or every department needs a head) just to post their first job.
- **Fix direction:** `isMyDepartment` should be `true` when the user has company-wide job-creation permission (`jobs:create` with no `department_id` restriction), not just an exact ID match.

#### 3. Free-plan companies can never invite their first team member — ✅ FIXED 2026-09-24
> **Fix applied:** excluded the owner (`EmployerProfile.is_owner == False`) from the recruiter-seat count in both `invite_team_member`'s limit check and `get_subscription_usage` (the query feeding the Billing page's usage bar), so the two stay consistent. Verified live with a brand-new free-plan company (owner only, 0 recruiters): Billing page now shows "Recruiter seats 0/1" instead of "1/1 full"; inviting a first recruiter succeeds ("Account created!"); inviting a *second* recruiter is still correctly blocked with the real plan-limit error ("Your plan allows 1 recruiter seat(s)") — confirming the fix is precise, not just permissive.
- **Where:** `backend/app/modules/companies/service.py:164-169`
- **Repro:** As a fresh free-plan company (1 owner, 0 recruiters), go to Team → Invite Member and try to add anyone.
- **Result:** `400: Your plan allows 1 recruiter seat(s). Upgrade your subscription to add more.` — even though zero recruiters have been added yet. The Billing page's own UI shows **"Recruiter seats 1/1"** (full, red bar) before a single invite.
- **Root cause:**
  ```python
  seat_limit = _get_recruiter_seat_limit(company.id, db)
  current_seats = db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id).count()
  if current_seats >= seat_limit:
      raise ... f"Your plan allows {seat_limit} recruiter seat(s)..."
  ```
  `current_seats` counts **every** `EmployerProfile` row for the company, including the owner. Free plan's `max_recruiter_seats = 1`, so the owner alone already fills the quota.
- **Impact:** A brand-new company on the advertised free plan cannot build a hiring team at all — contradicts the plan comparison table, which lists "Recruiter seats: 1" as if it were an allowance *in addition to* the owner.
- **Fix direction:** Either exclude the owner from the recruiter-seat count, or make the messaging honest ("Free plan is solo-only").

### 🟠 High

#### 4. The aspirant "Job Opportunities" page hides most of a candidate's real matches — ✅ FIXED 2026-09-24
> **Fix applied:** the two endpoints were a red herring — calling `browse.get_job_recommendations()` and `krs_service.get_live_jobs()` directly in a Python shell (bypassing HTTP entirely) returned identical, fully-correct rankings for the same profile. The real cause was the Redis response cache on `GET /api/jobs` (`matching/router.py::list_jobs`): its cache key only changed on a *per-user* version counter, bumped in exactly one place (a KRS-recompute endpoint) — nothing ever invalidated it when an employer created, edited, published, paused, closed, reopened, or deleted a job, even though that changes what belongs in *every* aspirant's cached list. A stale 2-job response from early in this session's testing kept getting served back for up to 5 minutes at a time, indefinitely, since it was legitimately still "not expired" every time it was checked. Added a catalog-wide cache version (`bump_global_jobs_version()` in `matching/router.py`) folded into the same cache key alongside the per-user one, and call it from every job-visibility mutation in `jobs/service.py` (`create_job` on publish, `_transition_job` — covers publish/pause/close/reopen/archive, `update_job`, `delete_job`). Verified live end-to-end: published a brand-new job as the employer, then — with no wait — reloaded the aspirant's Jobs page and the new job was already there ("21 jobs found," including the just-published one), and the original scenario (`Data Research Associate`, 100% skill overlap) now correctly ranks #1 at 62%.
- **Where:** `GET /api/jobs` → `backend/app/modules/matching/router.py::list_jobs` (Redis cache), mutation call sites in `backend/app/modules/jobs/service.py`
- **Repro:** As a fully-onboarded aspirant with 20 active/published/approved jobs in the DB passing all their salary/location preferences, open **Jobs** in the sidebar.
- **Result:** "2 jobs found." Reloading the page, logging out and back in, and re-fetching after editing preferences all still return exactly 2.
- **Compared to:** The **same profile**, fetched via the Dashboard's live-jobs endpoint at the same moment, returns **10 jobs** — correctly ranking a freshly-posted, 100%-skill-overlap job (`Data Research Associate`) as the #1 match at 62%. That job never appears anywhere on the main Jobs page, across reloads and a fresh login.
- **Confirmed via direct API comparison** (both endpoints called back-to-back with the same valid session token):
  ```
  /api/jobs      → total: 2,  titles: [Data Analyst, Content & Editorial Lead]
  /api/krs/jobs  → count: 10, titles: [Data Research Associate, Data Analyst, ...]
  ```
- **Impact:** This is the product's core discovery surface. Aspirants are seeing a small fraction of real, relevant, active jobs — including exact matches — while employers believe their postings are visible to everyone who fits.
- **Fix direction:** Both endpoints call the same `rank_jobs_for_user()` — the two call sites (`browse.py` vs `krs/service.py`) need to be diffed for how/when they fetch or compute the `KrsScore` (embedding) that feeds the ranker; also check for stale React Query caching on the frontend `JobsPage.tsx` query (`queryKey: ['jobs', sector, jobType, q, minSal, page]` never gets invalidated by a profile-preference edit).

#### 5. ~~"Send Offer" never creates an actual offer letter~~ — ❌ RETRACTED 2026-09-24, not a real bug
> **Correction:** this was a testing-process error, not a product bug. When I originally checked the Offers page immediately after setting an application's status to "Send Offer," it correctly showed "No offers found" — because at that point I genuinely hadn't created an offer letter yet, I had only changed the status label. `CandidatePipelinePage.tsx` conditionally renders a full "Offer Letter" section — with its own Role Title / CTC / Start Date / Work Location / Hiring Manager fields and a "Send Offer Letter" button that calls the real `POST .../offer-letter` endpoint — as soon as `candidate.status` reaches `offer_sent`. I simply hadn't scrolled down to it or completed that second step during the original pass. Re-tested end-to-end just now: filled in the Offer Letter section for the same application and submitted it — `offer_letters` got a real row (`role_title`, `salary_ctc`, `start_date`, `hiring_manager_name`, `status='sent'`), and the Offers page correctly shows "1 offer" with full details. The feature works as designed.
>
> **Minor, non-blocking observation (not filed as a bug):** the application's status badge does say "Offer Sent" immediately after the *status-only* dropdown action, one step before the real offer letter is actually created — someone glancing at just the status badge, without opening the candidate detail panel, could momentarily believe an offer has gone out when it hasn't yet. Worth a look if there's ever a report of employers being confused here, but it's a soft labeling nuance, not a data-integrity issue — the original "completely disconnected, no record at all" framing was wrong.
- **Where:** Candidate pipeline status dropdown ("Update Application Status" → "Send Offer") vs. `Offers` page / `offer_letters` table

### 🟡 Medium

#### 6. Interview notifications show the wrong time (off by exactly 5.5 hours)
- **Repro:** Schedule an interview for **10 Oct, 11:30 am**. Check:
  - Interviews page → correctly shows **11:30 am** ✅
  - Candidate's own application timeline → correctly shows **11:30 am** ✅
  - Employer's notification bell → *"Interview with ... on 10 Oct, **06:00 AM**"* ❌
  - Candidate's own notification bell → *"Your interview ... is on 10 Oct, **06:00 AM**"* ❌
- **Root cause hypothesis:** 11:30 − 5:30 = 06:00 — an IST (UTC+5:30) offset applied once too many (or not converted at all) specifically in the notification-text generator, while every other surface (interview record, timeline) formats the same stored datetime correctly.
- **Impact:** Real risk that a candidate reads only the notification and shows up 5.5 hours off from the actual scheduled time.

#### 7. Lists don't refresh after a status change (stale cache)
- **Repro:** Move a candidate's status in the pipeline detail panel (e.g. to "Offer Sent"). Immediately open the cross-job **Applicants** list.
- **Result:** Still shows the old status ("Applied") until a hard page navigation/reload; the underlying DB record is correct immediately (verified directly).
- **Impact:** Employers reviewing the Applicants list right after making a change will see incorrect, stale statuses. Likely a missing React Query cache invalidation after the status-update mutation. (This class of bug may also be contributing to #4.)

#### 8. Dead-end CTA loop for company-wide roles
- Dashboard "Post a Job" → Jobs Overview page ("open a department to post one") → department workspace has no create button for the owner (root cause identical to Bug #2, but worth flagging as its own broken *journey*, since a new owner following the obvious path never reaches a working button).

### ⚪ Low / polish

- **Overlapping sector taxonomy** in the job-posting form: "Government & Civil Services" vs "Government & Policy"; "Consulting" vs "Management Consulting"; "Research & Analytics" vs "Think Tanks & Policy" — confusing which to pick for a given role.
- **Unformatted enum values leak into the UI**: candidate detail panel shows "Highest Stage: `mains`" instead of "Mains"; application timeline shows `applied`, `applied → shortlisted` in raw lowercase instead of title case.
- **"Headquarters" field** is shown (and editable) on the Company Profile page but is never asked for anywhere in the 4-step setup wizard, so every new company starts with it blank.

---

## What worked well

Worth stating plainly, since the bug list above is long: the parts of the product that do work are genuinely well-built and it would be a mistake to read this audit as "the product doesn't work."

- **Company setup wizard** (4 steps: details → company info → branding → verification) is clean and well-paced.
- **Department workspace model** (Overview / Jobs / Team tabs, scoped KPIs, scoped candidate pipeline) matches the intended enterprise-ATS architecture and is fully wired up — this was previously an open gap per internal notes and is now solid.
- **Applicant pipeline** has both Kanban and List views, and the candidate detail panel is rich: KRS composite + Knowledge/Readiness/Skill breakdown, education, UPSC journey, skills, preferences, cover note, application timeline, private recruiter notes, and a working "Email candidate" panel.
- **"Generate with AI"** on the job posting form produces genuinely good, on-topic job descriptions from a one-line prompt.
- **UPSC-specific job targeting** (preparation level: Anyone/Basic/Exposure/Prelims/Mains/Interview) and the K/R/S matching shown on both sides is a real differentiator and is functioning (when using the Dashboard's matching widget — see Bug #4).
- **Aspirant apply flow** (3 steps: contact info → resume → cover note + submit, with a reference number) is smooth.
- **Support tickets** and **Calendar** (with interview sync, "Connect Google Calendar," and a Tasks widget) are complete, not stubs.
- **Team invite flow** (role + department scoping, auto-generated credentials) works correctly once the seat-limit bug is worked around.

---

## Suggested fix priority

1. Bug #2 (owner can't post jobs) — blocks the core paid workflow for the account type that actually signs up.
2. Bug #1 (admin login broken) — blocks all KYC/approval operations without DB access.
3. Bug #4 (job search under-matching) — silently breaks the core marketplace promise for every aspirant.
4. Bug #3 (recruiter seat counts owner) — blocks team-building on the advertised free tier.
5. Bug #5 (offer letters not created) — breaks the final, highest-stakes step of the hiring funnel.
6. Bugs #6–#8 — real but lower blast radius; fix opportunistically.
