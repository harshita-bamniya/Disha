# DISHA AI — End-to-End QA & Production-Readiness Test Prompt

> Paste this whole file as your message to start the next session's testing pass.

## Goal

Run a full end-to-end functional QA pass on DISHA AI (aspirant / employer / admin
platform) at `E:\GalaxyWeblinks\Disha`. Create real test data through the actual
UI (not just DB seeds), exercise every role's flows, verify computed numbers
against ground truth, verify emails/notifications actually fire, verify RBAC
boundaries hold, and produce (1) a bug list and (2) a production-readiness /
UI-enhancement report. Use the Browser pane tools to drive the app like a real
user — don't just read code and assume it works.

## Setup

1. Start backend + frontend + Celery worker + Redis (check `Makefile`,
   `docker-compose.yml`, `.claude/launch.json` for the right commands — email
   and in-app notifications are dispatched via a Celery task
   (`backend/app/core/notifications.py`), so **nothing fires without a worker
   running**, even in console/dev mode).
2. Check `backend/.env` (or `.env.example`) for `BREVO_SMTP_LOGIN` /
   `BREVO_SMTP_KEY`. If unset, emails go to `ConsoleEmailProvider`
   (`backend/app/core/email.py`) and just log to the backend console —
   that's fine, just read the logs instead of an inbox. If set, real SMTP is
   used automatically regardless of environment.
3. There are existing seed/debug scripts (`backend/seed_test_jobs.py`,
   `seed_test_profiles.py`, `setup_test_data.py`, `debug_*.py`) — you can use
   them to bootstrap baseline data, but the primary testing should go through
   the real UI flows below, not just querying seeded rows.

## 1. Auth & onboarding

- Register a new aspirant (`/auth/register`) → verify OTP/email verification
  → add-phone (`/auth/add-phone`) → confirm `RequirePhone`/`OnboardingGate`
  correctly force onboarding before dashboard access.
- Walk all 6 onboarding steps and confirm each field persists and reappears
  correctly on the profile page afterward:
  - Step 1 Personal: full_name, current_status, date_of_birth, gender, city, state
  - Step 2 Education: highest_qualification, degree, field_of_study, institution, graduation_year
  - Step 3 UPSC Journey: upsc_exam, years_preparing, upsc_attempts, highest_stage_cleared, optional_subject
  - Step 4 Work Experience: has_work_experience, years, domain, last_designation
  - Step 5 Skills: skills list — **this directly feeds job-match scoring, so get real/varied values in**
  - Step 6 Preferences: preferred_sectors, preferred_locations, open_to_relocation, expected_salary_min/max
- Test forgot-password and 2FA-challenge flows.
- Register an employer (`/auth/register/employer`) → verify email →
  `/auth/employer-pending` until admin approves → confirm they're blocked
  from `/app/employer/*` until verified.

## 2. Create multiple aspirant profiles with deliberately different skill sets

Create at least 3-4 distinct aspirant personas (e.g. a fresher with generic
skills, an experienced candidate with a niche skill set that matches only 1-2
open jobs, someone whose skills match nothing posted) specifically to stress
test the recommendation ranker (`backend/app/modules/recommendations/ranker.py`):

- Confirm each aspirant's `/app/jobs` recommendations are actually explained by
  their skills — semantic similarity + skill overlap (45%/35% weighting) +
  K-score fit + sector bonus, not just "everything active."
- Confirm jobs missing 1-2 required skills still appear as **stretch goals**
  instead of being hidden, and that `match_quality` labels (perfect / strong /
  potential / skill_gap / exploratory) look sane against the actual skill diff.
- Apply to a job as one persona → confirm the app appears in
  `MyApplicationsPage` and status transitions correctly as the employer moves
  it through the pipeline.
- Confirm salary-range and location/sector preferences from Step 6 visibly
  influence ranking (soft signals), not just skills.

## 3. Aspirant profile & content correctness

- On the Profile page (`PersonalSection`, `UpscSection`, `PreferencesSection`,
  `KrsPanel`), verify every onboarding answer displays correctly and is
  editable, and that edits round-trip to the backend.
- Resume module: upload a real resume, check `ResumeHubPage` →
  `ResumeEditorPage` → `ScoreBreakdownCard` and `KeywordGapList` actually
  reflect a comparison against a real job's requirements (not placeholder
  numbers).
- Roadmap/learning module, Interview module (setup → lobby → room → report →
  history), Companion, Counsellor — walk each, check for dead ends, broken
  buttons, placeholder/lorem copy, and whether content is contextual to that
  aspirant's real data.
- Confirm the landing-page rename (`DishaLanding` → `BeginablAILanding`) left
  no stale references, broken imports, or mismatched branding anywhere.

## 4. Employer flow

- After admin approval, complete `EmployerSetupWizardPage` →
  `CompanyTeamPage` (invite a teammate — verify role options `employer_owner`,
  `hr_manager`, `recruiter`, `interviewer`, `hiring_manager` behave
  differently) → post a job via `JobForm` / `JobTemplatesPage` /
  `FormBuilderPage`.
- Confirm the new job shows up correctly in aspirant search/detail pages and
  is matchable by the ranker above.
- Move an application through the pipeline (`CandidatePipelinePage`,
  `ApprovalQueue`) and schedule an interview (`EmployerCalendarPage`) —
  confirm the interview-scheduled email/notification fires.
- **Cross-check every KPI on `EmployerDashboardPage` against ground truth** by
  counting manually or querying the DB: `active_jobs`, `draft_jobs`,
  `paused_jobs`, `closed_jobs`, `applications_today`, `total_applications`,
  `interviews_scheduled`, `offers_sent`, `hires`, `response_rate_pct`,
  `avg_time_to_hire_days`, and per-job `total_applicant_count`. Flag any
  number that's off.
- Check `SubscriptionPage`, referrals/templates/departments pages, employer
  `SupportPage` for functionality and whether the employer-side UI visually
  matches the aspirant-side design system (spacing, components, tokens) —
  flag inconsistencies or pages that feel bolted-on/unnecessary.

## 5. Admin & sub-admin RBAC

- Log in as `super_admin`: confirm access to every `/admin/*` route,
  including the super-admin-only pages (`SubAdminsPage`, `RolesPage`,
  `IntegrationsPage`, `SystemMonitoringPage`, `AiConfigPage`,
  `PlatformSettingsPage`).
- Create each sub-admin role from `SubAdminsPage`
  (`moderator`, `verification_officer`, `finance_manager`,
  `support_executive`) and confirm:
  - `super_admin` itself cannot be assigned through `create_sub_admin`.
  - The privilege-escalation guard on `create_role` holds — an admin can't
    grant a permission they don't personally have.
  - Log in as each sub-admin and confirm they're actually blocked (not just
    hidden in nav) from super-admin-only pages, and that within their own
    scope they can do what their title implies and nothing more (e.g.
    `verification_officer` can approve/reject employer KYC, `finance_manager`
    can access `BillingPage`/`SubscriptionsPage`/`FinancialReportsPage`,
    `support_executive` can only touch `SupportPage`/`TicketDetailPage`).
  - `AuditLogPage` correctly records who did what.
- Walk `EmployersPage`, `CandidatesPage`, `KycQueuePage` (approve/reject an
  employer), `JobsPage`/`JobDetailPage`, `ApplicationsPage`,
  `CareerTracksPage`, `InterviewCalibrationPage`, and all four
  `*ReportsPage` variants (Employer/Job/Candidate/Financial) — confirm the
  numbers shown there reconcile with what you generated in steps 2-4.

## 6. Emails & notifications

- Confirm which provider is active (console vs Brevo, per Setup above).
- Trigger and verify each of: registration OTP, application-status-change,
  interview-scheduled, employer-verification-approved/rejected,
  new-application-to-employer. Check they actually dispatch (console log or
  real inbox) — not just that the code path is called.
- Check `NotificationsPage` (admin) and any in-app notification affordance
  reflect the same events consistently.

## 7. UI/content polish pass

- Read through page copy for placeholder/lorem/dev-only text, inconsistent
  terminology (aspirant vs candidate vs student — pick one and flag drift),
  and broken links.
- Re-check responsive behavior on mobile/tablet/desktop (a prior session did
  a responsive sweep — confirm no regressions since).
- Flag pages/components that look redundant, half-finished, or that no
  longer make sense given the current flows (e.g. anything that still
  references the deleted `LearningSetupSection.tsx`, or feature modules like
  Counsellor/Companion that feel disconnected from the rest of the app).
- Check loading/empty/error states everywhere, not just the happy path.

## Deliverables

1. **Bug list** — for each: file:line, route, repro steps, expected vs
   actual, severity.
2. **Production-readiness report** — what's missing (e.g. real in-app
   notification center, test coverage gaps, rate limiting, monitoring
   dashboards actually wired up) and a prioritized list of UI/UX
   enhancements to make the site feel production-ready, ranked by
   impact vs effort.
