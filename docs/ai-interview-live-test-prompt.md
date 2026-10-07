# Prompt: live-test the AI interview engine

Paste everything below the line into a fresh Claude Code session opened in `E:\GalaxyWeblinks\Disha`.

---

You are doing the first **live, end-to-end test** of the AI interview engine in this repo (FastAPI backend in `backend/`, Vite + React frontend in `frontend/`, Postgres, Redis, Celery). The feature was just built across six phases and has only been unit-tested with fakes: 358 unit tests pass, but it has **never run against a real database, Celery, Groq or Gemini**. Your job is to run it for real, find what is broken, fix it, and report.

## Read first (in this order)
1. `docs/ai-interview-engine-testing.md`: setup steps, the scenario checklist, and the list of things deliberately not built. This is your test plan.
2. `docs/ai-interview-engine-plan.md`: what each phase delivered and why.
3. Memory file `interview_engine_rework.md` (auto-loaded) for decisions and gotchas.

## What was built (so you know what "correct" means)
- **Practice interview:** 4 dark screens (setup, instructions + consent, system check, live room), then a report. A session is created only at the end of the system check. Free users get 3 interviews (`FREE_TIER_LIMIT`); the credit is checked before and spent after creation.
- **Flow rules in code** (`backend/app/modules/interview/policy.py`): one follow-up per question, a total follow-up cap, a time limit, easy-to-hard question order. The LLM only suggests.
- **Scoring in code** (`.../scoring.py`): the headline score is computed from per-answer scores and competency weights. The model's own estimate is kept only for audit. At most 3 strengths and 3 gaps, no "weak/failed" wording, no confidence score.
- **Grading is asynchronous:** `POST /interview/sessions/{id}/complete` returns immediately; Celery task `grade_interview_session` grades; the report page polls `grading_status`. If Redis is down the API grades in-process. `POST .../regrade` retries.
- **Safety** (`.../safety.py`): a first-person self-harm statement halts the interview, shows helplines and scores nothing; distress offers a break and that answer is not scored. Events go to `interview_safety_events` and `GET /api/admin/interview-safety-events`.
- **Counselling firewall:** interview prompts must never include burnout/confidence data; only `counsellor/interview_tone.py` returns `gentle|standard`.
- **Voice and language:** English / Hindi / Hinglish. Server speech-to-text (Groq Whisper, Gemini fallback) and server text-to-speech (Gemini) from `backend/app/ai/speech.py`; without keys the room uses the browser's speech. Opt-in answer audio is stored under `uploads/interview_audio/<session>/` and shown with a "Rec" badge only when really saved.
- **Drills** (`/app/interview/drill`): one question, instant feedback, retry the same question; no credit, no XP; daily cap.
- **Stress mode:** locked until 3 completed regular interviews, and unavailable after a safety event or when the tone flag is gentle (without saying why).
- **Career-transition question:** always the first question, scored on its own rubric; the career gap is never scored.
- **Verified Interview (employer):** employer templates with a compliance filter (no questions about age, marital status, religion, caste, gender, health, origin), invitations only for people who applied to the employer's jobs, one attempt per invitation, explicit `employer_share` consent creating an expiring, revocable share grant, two independent scoring passes with human-review flagging, fit bands (never "weak"), a scorecard with **no coaching content**, human decisions, tab/window integrity observations shown to both sides, candidate appeals, admin retry, 180-day auto-delete.
- **Model/cost log:** `model_runs` gets a row per LLM/STT/TTS call.

## Setup (do this yourself; ask me only if something needs a secret)
1. Docker Desktop must be running. Bring up Postgres, Redis, backend, **Celery worker and beat**, and the frontend (see `docker-compose*.yml` and `.claude/launch.json`).
2. Apply migrations: `alembic upgrade head`. Expected new revisions in order: `z5a6b7c8d9e0`, `a6b7c8d9e0f1`, `b7c8d9e0f1a2`, `c8d9e0f1a2b3`, `d9e0f1a2b3c4`. Confirm there is exactly one head. If a migration fails against real Postgres, that is a finding: fix it.
3. `.env` needs `GROQ_API_KEY` for scoring and `GEMINI_API_KEY` for voice. **Never print, log or paste key values.** If a key is missing, tell me which one and continue with what works (the browser-speech fallback is itself something to test).
4. Seed or create **test** users only on the local dev host: one aspirant (finished onboarding, phone on file), one approved employer with a job that the aspirant applied to, one admin. Prefer the project's seed scripts (`backend/seed_*.py`, `setup_test_data.py`). Use test values only. Do not use any real person's credentials.

## How to test
- Drive the real app: backend API with `curl`/Python for flows that need no camera, and the Browser pane (`preview_start`) for UI. **The Browser pane blocks the camera and microphone**, so for voice use API calls with a short recorded or synthesized audio file, and test the UI's no-camera and denied-permission states. Say clearly which parts you could not exercise and why.
- Work through every scenario table in `docs/ai-interview-engine-testing.md` (sections 2-5). For each one record: **pass / fail / not testable**, and the evidence (response body, DB row, screenshot or log line).
- Check the database directly where the checklist says so (`model_runs`, `interview_safety_events`, `share_grants`, `interview_consents`).
- Specifically hunt for these likely failure points:
  - SQL/ORM errors against real Postgres (unit tests used fakes): CHECK constraints, foreign keys, `with_for_update`, JSONB mutation not persisting (e.g. `blueprint["_distress_response_ids"]`), the atomic grading claim `_claim_grading`.
  - Celery: is the task registered and executed; stale/duplicate delivery; `asyncio.run` inside the worker.
  - `model_runs` rows written from a separate DB connection (the session must be committed first).
  - Voice: the Groq and Gemini request formats and **model names in `.env`/`config.py` were written from memory and are unverified**. Confirm they work, or correct them from the providers' current docs.
  - Frontend: console errors, wrong routes, state lost on refresh (the setup/instructions/check pages share a `sessionStorage` draft), the report page polling.
  - Permissions: an aspirant cannot call employer endpoints and vice versa; an employer cannot read a result without a live share grant, after revoke, or after expiry; one employer cannot see another company's templates or results.
  - Privacy: the employer scorecard must contain no roadmap, model answers, improvements, delivery stats or hire/no-hire labels.

## Rules
- **Fix bugs you find** in the code, with the smallest correct change, and add or update a unit test for each. Run tests with `pytest --noconftest tests/test_interview_phase*.py` from `backend/` (the shared fixtures need Postgres), and type-check the frontend with `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0`. The project has many unrelated pre-existing type errors; only touch files under `modules/interview`, `modules/employer/pages/Verified*`, `api/interview.ts`, `api/verifiedInterview.ts`.
- Known unrelated failure: `tests/test_krs_scoring.py::TestKScore::test_interview_cleared_highest`. Do not chase it.
- Do **not** commit, push, or run destructive database commands outside the local test data. Ask before anything irreversible.
- Do **not** build the "not built" items (KRS write-back, reviewed question bank, LiveKit, video/face detection, admin UI screens). List them only if a test depends on them.
- Environment quirks: the Bash tool halves backslashes in commands, so write multi-line patch scripts with the Write tool and run them; many source files use CRLF line endings, so preserve them.
- Do not change product decisions (free tier = 3 interviews, no accent/pronunciation scoring, practice scores private, humans make hiring decisions).

## Deliverable
A report with: (1) a table of every scenario with pass/fail/not-testable and evidence, (2) the bugs you fixed (file, cause, fix, test added), (3) bugs you found but did not fix and why, (4) what you could not test and what I must check by hand (camera, real voice quality in Hindi/Hinglish), (5) the exact `.env` values or settings I need to change. Be plain and honest: if something only works with mocks, say so.
