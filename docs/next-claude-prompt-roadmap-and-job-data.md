# Prompt for the next Claude session: roadmap, resume match and job data

Paste everything below the line into a new Claude Code session opened in `E:\GalaxyWeblinks\Disha`.

---

You are continuing work on DISHA / BeginablAI (FastAPI + React, Postgres, Celery, Docker). Three connected features were built in the previous session. Your job now is to finish the next phases below. Read this whole prompt first, then read the memory files named in "Start here". Do not re-do finished work.

## Standing decisions (do not reverse without asking the user)

1. **Roadmap generation never uses a resume.** The job is new to the candidate, so the resume may have nothing about it. Roadmap inputs are only: profile skills, the learning-setup answers, the per-job skill ratings, and the posting's own requirements and responsibilities. A test enforces this (`test_roadmap_engine_never_imports_resume_data`). This rule is about roadmap generation ONLY. The resume IS used for resume-vs-job matching and the employer's resume-fit score. Job finding/recommendations (`recommendations/ranker.py`) currently use profile skills, KRS and embeddings, not resumes: whether resumes should feed job finding (for example parse the resume and let the candidate confirm skills into the profile) is an OPEN product question; ask the user before building it.
2. **Employers see only the resume-fit score on an application.** The profile-based "% match" badge on job pages is a candidate-side discovery aid and is never shown to employers. No resume attached means no score ("no resume").
3. **`UPSC_Master_Database_v2.xlsx` is a reference catalogue, not live jobs.** It was imported into the `market_roles` table (127 company-role records). It is research data, not vacancies: no apply link, no openings. Never publish these as live postings under real company names. Live jobs stay employer-posted in `job_postings`.
4. **Never invent facts about a learner or a resume.** Personal lines are built in code from verified profile skills and the learner's own ratings. AI rewrites go through the fact-check (`resume_match/factcheck.py`).
5. **Do not bypass paywalls, change plans/quotas, reset counters, guess passwords, or modify employer/account approval to make a test pass.** Report the block instead. Local test accounts and their passwords come from `backend/seed_test_profiles.py` only.
6. **Be honest about verification.** Say what was run and what was not. Do not claim a screen works unless it was opened in the browser.
7. Strict, all-or-nothing data imports; real data needs a dry run first.

## Start here (read before coding)

- Memory files (auto-loaded, read them): `resume_job_match.md`, `roadmap_engine_v2.md`, `market_roles_catalogue.md`.
- `git status` (about 230 uncommitted files on `feature/candidate-comparison`; most are NOT ours: interview engine, auth, krs, payments). Only touch what a task needs. Do not commit unless asked.
- Run the test suites below to confirm a green start.

```bash
cd backend
python -m pytest tests/test_resume_match_*.py tests/test_resume_fit_applications.py -q   # 62 pass
python -m pytest tests/test_roadmap_engine.py tests/test_roadmap_engine_inputs.py -q      # 45 pass
python -m pytest tests/test_market_roles_parser.py -q                                     # 25 pass
```

Known unrelated failures (15, other people's work): `test_krs_scoring`, `test_auth_email_first`, `test_auth_integration`, one in `test_job_plan`.

## What is finished

### A. Resume-vs-job match (`backend/app/modules/resume_match/`)
Gemini (`gemini-3.1-flash-lite`, key `GEMINI_API_KEY` in the ROOT `.env`) parses resume and job into structure; plain code scores. Eight weighted sub-scores, knock-out cap 40, bands Strong/Good/Fair/Low, ranked fixes with points gained, fact-checked rewrite suggestions, "Have you used X?" flow, separate rule-based resume-quality score, ATS checklist. API under `/api/resume-match/...`, report page `/app/jobs/:jobId/resume-match`. Judge failures now fail the scan (never silently score 0). Listed-only skills capped at 0.4; generic traits capped at 0.7 without a number and weigh half. Scoring version 1.3.

### B. Employer-visible resume fit
`applications.match_score` is the resume-fit score (NULL if no resume). New columns `resume_fit_status` (no_resume|pending|ready|failed) and `resume_fit` (employer-safe snapshot, no coaching). Cached score is used at submit; otherwise Celery task `score_application_resume` (queue default worker) scores in about 30 s, then auto-shortlist runs. Employer API `GET /api/employer/pipeline/applications/{id}/resume-fit`; panel `modules/employer/components/ResumeFitPanel.tsx`. Candidate confirmation screen polls and shows the score. Backfill: `python -m app.scripts.backfill_resume_fit`. Migration `y4z5a6b7c8d9` clears old profile scores.

### C. Roadmap engine v2 hardening (`backend/app/modules/roadmap_engine/`)
- `targeting.py`: maps blueprint skills to the posting's own requirements and responsibilities (from the JD parser); skills the posting does not ask for go to `stretch_modules` (optional). Grounding level and reviewer flags.
- `personal.py`: summary and `why_for_you` built from facts only.
- `ratings.py` + API `GET /api/jobs/{id}/learning-plan/skills-to-rate` and `POST .../learning-plan {skill_ratings}`: learner rates the posting's skills 0-3 before generating; ratings shorten modules and count as strengths.
- `facts.py`: statute registry (DPDP Rules are "2025", DPIA only for Significant Data Fiduciaries, CERT-In 6-hour reporting, s.43A omitted by DPDP s.44(2)).
- `blueprint.py`: soft-404 detection so invented deep links on catch-all sites no longer pass "verified"; `python -m app.scripts.reverify_blueprints` (already run: 8 bad links dropped).
- Config flag `roadmap_require_reviewed_blueprint` (default off; true blocks unreviewed drafts).
- Frontend: `SkillRatingModal`, grounding notice, "What you already bring", `OptionalSkillsCard`, `PlanNotices`, "Reviewer: generic" chip.
- Result on the test case: 14 modules / 206 h / 21 weeks became 9 modules / 116 h / 12 weeks.

### D. Market roles catalogue
Table `market_roles` (migration `f3a4b5c6d7e8`), model `app/models/market_role.py`, parser `app/modules/market_roles/parser.py`, importer `python -m app.scripts.import_market_roles <xlsx> [--dry-run]` (needs `pip install openpyxl`). 127 records, all 26 columns kept raw plus parsed lists and numeric LPA salary ranges plus `full_description` assembled only from the record's own fields. Verified: 5,460 values compared against the workbook, 0 differences.

## Environment facts and gotchas (these cost time last session)

- Export the DB URL before alembic or scripts: `export DATABASE_URL=$(cd backend && python -c "from app.config import get_settings;print(get_settings().database_url)" | tail -1)`. `alembic.ini` points at the Docker host name.
- Alembic head moves fast (other sessions add migrations). Chain a new migration after `alembic heads`. Current head: `f3a4b5c6d7e8`.
- Running pytest creates tables from models (`conftest.py` `create_all`), so a new model's table can exist before its migration. If `alembic upgrade` says "already exists" and the table is empty and yours, drop it and re-run.
- Docker `env_file` is read only when a container is created. After changing `.env`: `docker compose up -d --no-deps backend`. Celery workers do not auto-reload: `docker restart beginablai_roadmap_worker` (roadmap tasks) and `beginablai_worker` (application tasks) after editing task code.
- Backend and frontend source are bind-mounted. Backend container: `beginablai_backend`. Frontend dev server on `localhost:5173`, backend on `localhost:8000`.
- In bash heredocs, apostrophes inside the body can break the command. Write scripts with the file-writing tool, then run them.
- Redis is not reachable from the host; use code inside the backend container.
- Seed accounts (passwords in `backend/seed_test_profiles.py`): `aspirant1..5@beginablai.test`, `employer1..5@beginablai.test`. Employers 1-5 have no company, so the employer UI redirects to billing; use the API for employer checks. `aspirant1/2` hit a 402 paywall redirect on `/app/roadmap` (counsellor quota used); `aspirant3` works for roadmap UI tests.
- The browser pane cannot open the native file picker (set files from script) and turns `target=_blank` links into same-tab navigation.
- TypeScript: `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` (about 115 pre-existing unused-variable errors elsewhere; check only the files you touch).

## Next implementation plan

Do the phases in order. After each phase: run the tests, verify in the real app where a screen changed, update the memory files, and report what was and was not verified. Ask the user before any change that alters what employers or candidates see in a way not described here.

### Phase 1: Ground the blueprints in the market-roles catalogue (highest value)
Problem: blueprints claim to be built from "12 postings" that are mostly unrelated seed jobs, so 12 of 14 skills in the compliance blueprint match no posting.
- In `roadmap_engine/blueprint.py` replace the corpus (`similar_postings`, `compute_evidence`, `_postings_block`) with `market_roles` records for the same role family (match by embedding of `job_role + required_skills + key_responsibilities`, plus the live job itself). Keep live postings as a secondary source.
- Evidence per skill = number of matched roles whose required/preferred skills or responsibilities mention it. Show it in the plan ("in N of M roles").
- Record the corpus used in `blueprint.sources` (ids, company, role) so a reviewer can see what grounded it.
- Re-draft the 10 existing draft blueprints (`python -u` batch pattern in `roadmap_engine_v2.md`; each draft is about 6 large LLM calls, free tiers are rate-limited, set `ROADMAP_LLM_PRIMARY=gemini`). Compare grounding before/after; recompute `grounding.level`.
- Acceptance: for the compliance and data-analyst blueprints, at least 60% of skills have supporting roles, or the plan honestly says why not. Tests with a fake corpus. No blueprint claims postings that are not in the corpus.

### Phase 2: Import the remaining workbook sheets as reference tables
Sheets in `UPSC_Master_Database_v2.xlsx` not yet imported: `Skill Framework`, `Salary Benchmarks`, `Industry Analysis`, `Candidate Segmentation`, `UPSC Ecosystem & Skills`.
- Follow the same pattern: strict parser, dry run, all-or-nothing, idempotent, independent verification, migration chained after head.
- Use them: (a) `Skill Framework` (UPSC activity to corporate skill, depth 1-10) to map profile skills like "Public Administration" or "Essay Writing" to job skills, replacing the loose "partial" classifier guesses; (b) `Salary Benchmarks` for the roadmap job-search kit salary range (today `based_on_postings: 1`); (c) `Candidate Segmentation` category names already appear in `market_roles.suitable_candidate_categories`.
- Acceptance: row counts equal the workbook, zero cell differences, tests for each parser.

### Phase 3: Catalogue API and screen ("Roles hiring UPSC aspirants")
- Endpoints (aspirant auth): list with filters (industry, company type, location, salary band, skill, category), search, detail by id. Read-only.
- Screen: browse and detail. Every card and page must say it is a **reference role, not an open vacancy**, show the company website link, salary benchmarks as research estimates, and a "Check how my skills fit" action that compares the candidate's profile skills with the role's required skills (profile skills by default; using the resume here is an open question, ask the user).
- Do not add an Apply button. Do not mix these with live jobs in the Jobs list.
- Acceptance: browser-verified at desktop and 375 px, empty and error states, tests for filters.

### Phase 4: Roadmap quality leftovers
- Posting-targeting still keeps weak modules ("Annual cybersecurity incident report" is factually wrong and is kept by a loose mapping plus a prerequisite; Vendor Risk stays as its prerequisite). Tighten: do not pull a prerequisite unless the dependent module is genuinely required; add a minimum evidence rule for mapping.
- Add the remaining design-doc setup questions (current stage, budget, preferred language, location) and use them: language must drive the video language (currently hard-coded `en` in `engine.VIDEO_LANGUAGE`), budget must filter paid resources.
- Browser-verify the paths not yet tested: "Skip and generate", Regenerate, and the plan screen at 375 px.
- Add API-level tests for `skills-to-rate` and generate-with-ratings (ownership, validation, previous ratings reused).
- Human review step: an admin screen/flow to mark a blueprint `reviewed` with notes; then consider turning on `roadmap_require_reviewed_blueprint` for production.

### Phase 5: Resume-match calibration and production readiness
- Partial-credit leniency: a candidate with 1 of 8 must-haves fully met can still score 64. Make partial matches count for less when few requirements are fully met. Do not tune on invented examples: use real role descriptions from `market_roles` as job descriptions and have a person who screens candidates label about 30-50 resume-job pairs; tune weights against those labels. Ask the user to arrange the labeller.
- Privacy: consent at upload, retention policy and scheduled purge for stored scans and parsed profiles, a "Did you hear back?" outcome prompt in My Applications, linking applications to scans.
- Production: a paid Gemini key with no training on data (the free tier may use prompts to improve models), API tests for resume-match routes (ownership, quota, cache, 429), verify the Redis-backed daily suggestion cap inside Docker, cost tracking per call.
- Employer side: verify the Applicants list and candidate drawer in a browser once an employer account with a company is available (ask the user for one; do not alter seed employers).

### Phase 6: Hygiene and delivery
- Separate this feature's changes from the 200+ unrelated uncommitted files; propose a commit and PR plan (resume match, employer resume fit, roadmap hardening, market roles) and wait for the user to approve before committing or pushing.
- Update the reviewer brief (published page "Resume Match Brief") if the user still wants it shared.

## How to work

- Plan first in a few lines, then build in small verified steps. Prefer editing existing modules over new abstractions.
- Every parser or import: dry run, strict validation, idempotent re-run, independent verification against the source.
- Every user-visible change: open it in the browser (desktop and phone width) and check the console. State plainly what you could not verify.
- Keep answers short and concrete: what changed, what was verified, what is left, and the one decision you need from the user.

Start with Phase 1.
