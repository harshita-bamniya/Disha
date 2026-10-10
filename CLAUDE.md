# BeginablAI (Disha) — notes for Claude sessions

## Accounts (state as of 2026-10-09)
All aspirant/employer/recruiter test profiles were deleted from the Docker database on 2026-10-09 at the
owner's request; they create accounts manually now. Only the two seed staff accounts remain
(`admin@disha.test`, `superadmin@disha.test` — passwords in `user_credentials.md`).

- Do not recreate test profiles unasked. If a limit-free test employer/aspirant is needed, ask first, then
  `cd backend && python seed_unlimited_test_accounts.py` (idempotent; point `DATABASE_URL` at the DB you mean).
- Never re-run `backend/seed_test_profiles.py` (it deletes every aspirant/employer).
- Before any bulk delete, take a `pg_dump` and say which database (5432 vs 5433) you are about to touch.

## Local dev stack
- **The running app is the Docker stack** (`docker compose up -d`): frontend `localhost:5173`, backend
  `localhost:8000`, Postgres on **`localhost:5433`** (`disha` / `disha_db`). Source is bind-mounted, so edits
  hot-reload. If nothing responds, Docker Desktop is probably stopped.
- A *separate* native Postgres runs on `5432`. It is not what the app uses; do not assume data there is real.
- The `.claude/launch.json` entries (`BeginablAI Backend`, `BeginablAI Frontend` on 5181) start extra dev
  servers; the 5181 frontend's origin is not in the Docker backend's CORS list, so use 5173 for real testing.
- Login is email-only; phone is collected in onboarding step 1 (not at signup).

## Before saying something works — use checks that can actually fail
`npx tsc --noEmit` in `frontend/` checks **nothing** (the root tsconfig has `files: []`), and a green result
from it means nothing. A wrong import path once broke the whole app while that "passed".

- **Frontend types:** `cd frontend && npm run typecheck` (real: uses `tsconfig.app.json`; fails on missing
  modules and type errors). Unused imports/variables are a lint backlog and are excluded from this gate.
- **Frontend load:** after editing, make sure Vite compiles the page (open it in the Browser pane, or
  `curl http://localhost:5173/src/<changed file>` returns 200 with no overlay error).
- **Backend tests:** `docker exec -w /app beginablai_backend python -m pytest tests/<file> -q` (tests use a
  rolled-back transaction per test, so they do not leave data behind). Run the file(s) for any module you
  changed, and the whole suite before calling a backend change done.
- **Verification flow tests** (`tests/test_verification_flow.py`, `tests/test_verification_checks.py`) stub the
  AI reader and the email sender; keep them that way (no network in tests).
- **Test data:** a GSTIN embeds the PAN in characters 3–12 and ends in a checksum character; build dummy ones
  with `_gstin(pan, state)` from `tests/test_verification_flow.py`. Example: PAN `GIQPB2788L`, state 22 →
  `22GIQPB2788L1ZR`. Never hand-type a "dummy" GSTIN.
- A test that has never failed proves little: after writing one, break the code on purpose and confirm it fails.

## Team invitations (employer portal)
An invite is not an account: `company_invites` holds a hashed one-time token; the invitee sets their own name and
password at `/auth/accept-invite?token=…`, and only then are the `User` + `EmployerProfile` created. Departments are
created standalone; a "head email" only sends an invitation. Pending invites count toward the plan's seat limit.
To test the accept page without reading an email, overwrite the invite's `token_hash` with
`app.core.security.hash_token("<known token>")` (the real token is never stored). Emailed links use `FRONTEND_URL`.

## Employee referrals (employer portal, `/app/employer/referrals`)
Code: `backend/app/modules/referrals/`, models in `app/models/referrals.py`, UI in
`frontend/src/modules/employer/components/referrals/`. Tests: `tests/test_referrals.py`.
- Referrers are teammates (auto-created on first visit) or invited employees with **no account** (private page at
  `/referrer/<token>`, hashed token, same pattern as team invites). Share link is `/r/<code>/<job_id>`.
- Attribution happens inside `applications.service.submit_application` (`referral_code`, best-effort, savepointed).
- Referral status/reward follow the application through a **SQLAlchemy `before_flush` hook** (`hooks.py`), so any code
  path that sets `Application.status` is covered. It is installed by the router import and in `tasks/worker.py`.
  Never call `db.flush()`/create rows via `get_program()` from code that runs inside that hook.
- Emails are queued on `db.info` and sent `after_commit` (rolled-back changes email nobody). Tests replace `emails.send`.
- Reward amount is a snapshot at hire; payable after `hold_days`; payout is only *recorded* (no money moves).
- Celery beat `release-referral-rewards` (6:30 IST) needs the worker restarted to be picked up.

## Admin dashboard (`/admin/dashboard`)
Plan and evidence: `docs/admin-dashboard/ADMIN_DASHBOARD_PLAN.md`. Phases 1 and 2 (done): "Needs attention" strip, marketplace tiles, sign-up journey, supply and demand. There is deliberately no activity/audit feed on the dashboard (it lives on the Audit log page). Components are in `frontend/src/modules/admin/components/dashboard/`.
- Queues are computed in `backend/app/modules/admin/dashboard/service.py`; each row is role-gated by `ROW_ROLES` and rows a role may not see
  are never computed. Revenue/payments is super admin (+ finance manager) only. Targets (3 days verification, 24 h ticket first response)
  live in `platform_settings` (`verification_target_days`, `ticket_first_response_hours`).
- Active users: `login_history` cannot measure them (15-min access tokens, 30-day refresh). `user_activity_daily` gets a row per user per
  India-time day from `_issue_token_pair` (login and refresh). DAU/WAU/MAU tiles are phase 3, once there is history.
- `stats.pending_employers` (sidebar badge, Employers page) is a *different* definition from the KYC queue (`requested`/`under_review`).
  The dashboard uses the queue. Unify them before reusing the stat anywhere new.
- Marketplace tiles (`dashboard/marketplace.py`): period + compare are URL params (`?days=7|30|90&compare=1`). A rate with fewer than
  30 people is shown as a count ("1 of 1"), never a percentage or a change. "Reached an interview" is `REACHED_INTERVIEW_STATUSES` in
  `models/applications.py`, shared with the admin funnel (the funnel used to look for statuses that do not exist: `interviewed`, `offered`).
  Time to first application is not built: `job_postings` has no `published_at` yet (phase 3).
