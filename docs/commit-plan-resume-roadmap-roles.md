# Commit and PR plan: resume match, roadmap engine, market-roles catalogue

Status: **proposal only. Nothing has been committed or pushed.** The working tree (`feature/candidate-comparison`) has about 257 changed
paths; most belong to other work (interview engine, auth, KRS, payments, candidate comparison). This plan only covers the files below.

## Why this needs care

1. **Most of our code is untracked** (`??`), so `git add -A` would also sweep in other people's untracked files
   (`backend/app/ai/usage.py`, `speech.py`, `language.py`, `untrusted.py`, `providers/gemini.py` and others are the interview engine's).
   Always add by explicit path.
2. **Shared tracked files hold our hunks mixed with other people's.** Use `git add -p` for these and review each hunk:

   | File | Our hunks |
   |---|---|
   | `backend/app/models/__init__.py` | imports of `MarketRole`, `reference_data` models, `ResumeMatchScan`, role blueprint models |
   | `backend/app/models/user.py` | `learning_stage`, `learning_budget`, `preferred_language`, `resume_scan_consent_at` columns |
   | `backend/app/models/applications.py` | `resume_fit_status`, `resume_fit`, `candidate_outcome(_at)`, `resume_match_scan_id` |
   | `backend/app/config.py` | `gemini_*`, `roadmap_*`, `resume_match_retention_days` settings |
   | `backend/app/main.py` | routers: resume_match, reference_roles, roadmap admin |
   | `backend/app/tasks/worker.py` | `include` list entries, `purge-resume-scans` beat entry |
   | `backend/app/modules/onboarding/{schemas,service}.py` | the 3 learning-setup fields |
   | `backend/app/modules/jobs/plan_router.py` | rewritten to call the roadmap engine; skills-to-rate; ratings |
   | `backend/app/modules/applications/service.py`, `schemas.py` | resume-fit scoring at submit |
   | `backend/app/modules/matching/{schemas.py,service/applications.py}` | `resume_fit_status` on ApplicationOut |
   | `frontend/src/App.tsx`, `shared/config/navigation.ts` | routes and nav for roles, resume match, admin blueprints |
   | `frontend/src/api/{matching,onboarding,jobPlan}.ts` | resume-fit status, setup fields, plan types |
   | `frontend/src/modules/jobs/pages/{MyApplicationsPage,JobDetailPage,ApplyPage}.tsx`, `modules/roadmap/components/{JobLearningPlanPanel,LearningSetupForm}.tsx` | resume-match entry points, rating modal, outcome prompt, setup questions |

3. **Migrations are one linear chain**, with other sessions' migrations interleaved:
   `... d9e0f1a2b3c4 → f3a4b5c6d7e8 (market_roles) → k8m2r5t9v3w1 (reference sheets) → m4p7s2w6y9a3 (setup fields) → p6c3d8f1a5b2 (scan consent) → q8d4e9a2c6f3 (outcome + scan link)`;
   resume-match tables are `x3y4z5a6b7c8`, `y4z5a6b7c8d9`; roadmap tables `v1w2x3y4z5a6`. Splitting into separate PRs means
   re-pointing `down_revision` on rebase, and `alembic heads` must show exactly one head after each PR.
4. **The three features depend on each other**, so PR order matters:
   roadmap grounding reads `market_roles`; the roadmap salary and "partial credit" read the reference sheets; `llm_usage` hooks into both
   LLM wrappers.

## Proposed PRs (in this order, each from a branch off `main`)

### PR 1: Reference catalogue and "Roles hiring UPSC aspirants"
- Backend: `app/models/market_role.py`, `app/models/reference_data.py`, `app/modules/market_roles/`, `app/modules/reference_data/`,
  `app/scripts/import_market_roles.py`, `app/scripts/import_reference_sheets.py`, migrations `f3a4b5c6d7e8`, `k8m2r5t9v3w1`.
- Frontend: `api/referenceRoles.ts`, `modules/roles/`, route + nav hunks.
- Tests: `test_market_roles_parser.py`, `test_reference_data_parser.py`, `test_reference_roles_api.py`.
- Note: `market_roles/router.py` imports `roadmap_engine.skill_bridge` (for skill-fit). Either ship `skill_bridge.py` here or in PR 2 and
  merge PR 2 first. Recommended: move `skill_bridge.py` into PR 1.

### PR 2: Roadmap engine v2 (blueprints, hardening, setup questions, admin review)
- Backend: `app/modules/roadmap_engine/` (all), `app/models/role_blueprint.py`, `app/tasks/roadmap_engine_tasks.py`, `plan_router.py`,
  onboarding hunks, migrations `v1w2x3y4z5a6`, `m4p7s2w6y9a3`, the `roadmap_worker` service in both compose files.
- Frontend: `PlanOverview.tsx`, `SkillRatingModal.tsx`, `JobLearningPlanPanel.tsx`, `LearningSetupForm.tsx`, `api/jobPlan.ts`,
  `admin/pages/RoadmapBlueprintsPage.tsx`, `api/roadmapBlueprints.ts`.
- Tests: `test_roadmap_engine*.py`, `test_roadmap_corpus.py`, `test_roadmap_prefs.py`, `test_roadmap_blueprint_review.py`, `test_job_plan_ratings_api.py`.
- Decide before merging: leave `roadmap_require_reviewed_blueprint` off until at least the first blueprints are human-reviewed.

### PR 3: Resume match, employer resume fit, privacy, outcomes
- Backend: `app/modules/resume_match/` (all), `app/models/resume_match.py`, application hunks (`applications/service.py`,
  `matching/*`, `tasks/application_tasks.py`), `app/tasks/privacy_tasks.py`, `app/ai/llm_usage.py`, `app/scripts/llm_usage_report.py`,
  `app/scripts/backfill_resume_fit.py`, migrations `x3y4z5a6b7c8`, `y4z5a6b7c8d9`, `p6c3d8f1a5b2`, `q8d4e9a2c6f3`.
- Frontend: `api/resumeMatch.ts`, `modules/resume/pages/ResumeMatchPage.tsx` + `modules/resume/components/match/`,
  `employer/components/ResumeFitPanel.tsx`, `jobs/components/OutcomePrompt.tsx`, `MyApplicationsPage.tsx`, `ApplyPage.tsx`, `JobDetailPage.tsx`.
- Tests: `test_resume_match_*.py`, `test_resume_fit_applications.py`, `test_llm_usage.py`.
- Run `python -m app.scripts.backfill_resume_fit` on staging first (it clears old profile-based scores via migration `y4z5a6b7c8d9`).

## Checks before each PR
- `python -m pytest` for that PR's test files, plus the full suite to confirm the known unrelated failures are unchanged
  (`test_krs_scoring`, `test_auth_email_first`, `test_auth_integration`, one in `test_job_plan`).
- `alembic heads` shows one head; `alembic upgrade head` from a fresh DB.
- Frontend: `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0`, filtered to touched files (about 115 older unused-variable errors remain elsewhere).

## Not ready to merge until
- A paid Gemini key with no training on prompts is in production (the free tier may use prompts to improve models; resumes go through it).
- The employer Applicants list and candidate drawer have been opened in a browser with an employer account that has a company.
- Someone who screens candidates has labelled 30-50 resume/job pairs so score weights can be tuned (partial-credit leniency is untuned).

## Not verified in a browser (as of 2026-10-03)
Admin blueprint review screen, the three new setup questions, list-level error state on the roles screen, the employer-side screens.
