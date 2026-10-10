# AI Interviewer (Employer): implementation roadmap and test strategy

Status: proposal, 2026-10-10. Nothing here is implemented. Complexity: S (<= 2 days), M (3-7 days), L (1-3 weeks), XL (> 3 weeks), for one engineer familiar with the codebase `[Assumption]`.
Refs: **B#** = Audit bug number, **R#/A#/B#/C#/P#** = Product Requirements IDs, **Arch §** = Architecture, **Eval §** = Evaluation Framework, **Com §** = Commercial Model.
Project rules that apply to every item (from CLAUDE.md): `pg_dump` and name the database (5433 vs 5432) before any bulk change; use `npm run typecheck`, not `npx tsc --noEmit`; run the touched backend test files and then the whole suite; verification-flow tests stay stubbed (no network); after writing a test, break the code once to confirm it fails; do not recreate test profiles without asking.

---

## Phase A: critical fixes (before any pilot, about 2 weeks)

Goal: remove misleading signals and cost exposure from what exists. Small, independent, each shippable alone.

| # | Item | Business value | Technical change | FE / BE / DB | Deps | Cx | Tests | Risks | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|
| A1 | **Fit band after completeness cap** (B1) | Stops "Strong fit" on a 2-of-7 interview | Recompute `fit_band` after `_enforce_completeness_cap` or apply the cap inside `apply_code_scoring`; return `answered/planned` in `get_result` and list; add an "Incomplete" band | FE badge + count; BE `scoring.py`, `feedback.py`, `verified.py`; DB none | none | S | Unit regression reproducing the audit case (2 answers 9/10 of 7 -> not "Strong fit"); band/summary consistency property test | Existing results change band | The audit's reproduction case yields "Incomplete / Needs human review"; no state with `hiring_recommendation`=No Hire and band=Strong fit |
| A2 | **Server-owned questions** (B2) | Candidate cannot pick own question or inject through it | Persist issued follow-ups; accept only ids; ignore client `question_text`; fence question text in scoring prompt; one-question-at-a-time delivery; require all planned questions (or explicit "finish early" -> incomplete); block practice endpoints for `mode=verified` (B15, B17) | FE room change; BE `interaction.py`, `sessions.py`, `router.py`; DB add `interview_followups` (or column) | none | M | API tests: forged `question_text` ignored; submit with 1 of 7 -> incomplete; injection string in question slot has no effect; practice endpoints reject verified sessions | Breaks resume of old sessions (none exist) | A forged question text never reaches the scorer; incomplete flagged; zero verified-mode calls through practice routes |
| A3 | **Entitlement gate + kill switch** (B3, B17) | Prevents unbounded LLM spend, blocks lapsed plans | `require_active_employer_subscription` on verified employer routes; `ai_interviews` quota check at invite; global and per-company daily caps; rate limit `templates/draft`, `next-question`; admin kill switch (config flag) | BE routes, config, `slowapi`; minimal `features` JSON on plans; FE upsell state | A1-A2 not required | M | Over-quota invite -> 402/clear message; lapsed plan blocked; rate-limit tests; kill switch test | Employers currently using it lose access if plan lapsed | No verified interview or LLM draft can start without an entitlement and under the cap |
| A4 | **Tenant and department scoping** (B8) | Prevents department-limited users reading others' transcripts/audio | Replace `_colleague_ids` with the same scoping helper used for applications on results, decisions, audio, templates, invitations | BE `verified.py`; FE none | none | S-M | Two-company and two-department tests via TestClient (the audit found none); negative cases for each route | Users who relied on company-wide visibility | Out-of-scope user gets 404 on every employer route; tests fail if the filter is removed |
| A5 | **Fail closed instead of silent fallback** (B6, B18, B26) | Employer never gets scores built on generic questions or one pass without a flag | In verified mode, LLM failure at start returns a retryable error; mark `is_fallback` share and failed pass 2 into flags; show "scoring delayed" rather than fabricated results | BE `session_setup.py`, `dynamic_interview_engine.py`, `feedback.py`; FE flag chips | none | M | Provider-failure injection tests; fallback share > 30% flagged | Candidates may see "try again" during outages | No verified interview scores or questions derive from hardcoded fallbacks; flags visible to employer |
| A6 | **Decision and delete integrity** (B14, B15) | Correct per-user decisions; no silent erasure of an employer's record | Filter decisions by user; append-only history; soft-delete verified sessions with employer notice | BE; FE | none | S | Unit + API tests | Product decision on candidate deletion rights vs employer record (counsel) | Decisions are per user with history; deleting a verified interview leaves a tombstone and notifies |
| A7 | **Concurrency and sweeper basics** (B7, B11, B12) | No orphan sessions, no stuck "started" | `FOR UPDATE` on start; catch `IntegrityError` on invite; Celery beat sweeper: expire invitations, abandon idle sessions, re-dispatch failed/stale gradings (bounded) | BE worker; DB none | A3 optional | M | Concurrent-start test; sweeper unit tests with frozen time | Duplicate dispatch | Two simultaneous starts create one session; failed gradings recover without candidate action |
| A8 | **Provider policy and data terms** (Research §9) | Legal and reliability baseline | Paid-tier keys and DPA for the scoring provider; add a second provider; stop sending resume/KRS to LLMs in verified mode (B5) | config/ops; BE `session_setup.py` | counsel / vendor accounts | S-M | Config check test that verified mode never includes practice context | Cost | Verified runs on a provider with documented no-training/DPA terms; fallback provider configured and tested |
| A9 | **Run the feature once end to end** | The Audit found zero verified interviews ever created | With owner approval, a documented pilot-data run in a disposable DB or with clearly labelled test accounts (ask first; CLAUDE.md forbids recreating test profiles unasked) | none | A1-A5 | S | Written manual E2E checklist | Needs accounts | One full invite -> consent -> interview -> scoring -> decision run recorded with real provider |

Exit criteria for Phase A: all nine acceptance criteria met, the whole backend suite green, `npm run typecheck` clean, one recorded end-to-end run.

---

## Phase B: production-ready MVP (about 8-12 weeks after Phase A)

Smallest complete version an employer can genuinely use for first-round screening. Order matters: B1-B3 are the foundation.

| # | Item | Business value | Technical change | FE / BE / DB | Deps | Cx | Tests | Risks | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|
| B1 | **Versioned, employer-approved templates** (Req A1-A4, A9, A10; Arch §3) | Same questions and rubric for all candidates; reuses the JD | Template versions + frozen question table; job-linked creation; AI draft (competencies, questions, rubric); approval gate; remove per-candidate question generation in verified mode; optional transition question | FE job -> AI screening tab and wizard; BE TemplateService; DB `interview_template_versions`, `interview_template_questions` | A2, A8 | L | Unit (versioning immutability), API, FE typecheck + browser run, golden-set generation checks | Employer UX complexity: keep defaults one-click | Publishing is impossible without approval; two candidates of one version get identical questions |
| B2 | **Rubric evaluator + evaluation records** (Eval §3-§7; Arch §4) | The core quality gain | Extraction -> two scoring passes -> deterministic aggregation -> constrained summary; evidence offsets; versioned prompts; `interview_evaluations`, `competency_scores`, `evidence` | BE EvaluationService; FE scorecard; DB 3 tables | B1 | XL | Golden-set harness, schema validation tests, evidence-substring tests, failure injection, stability tests | Quality unproven until validated | Pipeline passes Eval §9 Stage 0 gates; every number reproducible from stored inputs |
| B3 | **Usage metering and plan entitlements** (Com §5-§7) | Revenue and cost control | `ai_usage_ledger`, `company_ai_quota`, plan `features.ai_interviews`, reserve/consume/refund, pack purchase via existing Razorpay flow, admin cost view | FE usage meter, upgrade prompts; BE UsageService, payments; DB 2 tables | A3 | L | Ledger idempotency tests, refund-on-failure, concurrent reserve test, Razorpay stub tests | Payment wiring for employer plans unverified | Reserve/consume/refund balances always reconcile; over-cap blocks |
| B4 | **Invitations v2** (Req B1-B6) | Real operational use: email, reminders, bulk, statuses, retakes | Brevo email with secure link, reminder task, bulk invite endpoint, cancel/resend, invitation events log, status machine, applicant-list column | FE applicant list + job screening tab; BE InviteService; DB invitation columns + `interview_invitation_events` | A7 | L | Email stub tests, status machine tests, duplicate/race tests, link-expiry tests | Email deliverability (Brevo free tier 300/day, `config.py`) | Candidate receives email; reminders fire once; no duplicate invitations under concurrency |
| B5 | **Candidate experience v2** (Req C1-C8) | Trust, completion rate, compliance | New notice/consent screens (per-purpose, versioned), practice question, timer, heartbeat, resume, interruption handling, accommodation request, correct copy (remove false claims), transcript confirmation, receipt | FE interview pages; BE SessionService; DB sessions columns, accommodation table | B1 | L | FE browser tests, a11y checks, interruption tests (kill network mid-answer), consent ledger tests | Counsel review of wording | A candidate can resume after disconnect at the same question; system fault never reduces score; accommodation request reaches employer |
| B6 | **Recruiter results: compare, scorecard, overrides** (Req R1-R10) | The thing recruiters actually use | Job screening dashboard, compare table, evidence-linked scorecard, overrides with audit, flags, stage change on decision, department scoping, PDF/CSV export | FE employer pages; BE ReviewService; DB overrides table, decision history | B2 | L | API + FE tests; override audit tests; scoping tests; export tests | Scope creep: ship compare + scorecard first, export later | Recruiter can compare candidates per competency, override with a reason, and see history |
| B7 | **Admin and operations** (Req P4; Arch §8) | Supportable in production | Admin screens (failed scoring, retry/rescore, appeals linked to invitations, usage/cost, kill switch); structured logs; metrics and alerts; object storage for audio | FE admin pages; BE; ops dashboards in `observability/` | B3 | L | Admin API tests, alert rule tests (synthetic), storage migration test | Infra decisions (S3, Sentry) needed | Admin can find any invitation, retry any failed scoring, see spend per company; alerts fire on a synthetic failure |
| B8 | **Appeals and candidate rights** (B13; DPDP) | Compliance and trust | Appeal -> employer notification and scorecard marker; rescoring path; withdrawal/deletion requests; grievance contact | FE; BE; DB link appeal to invitation | B6 | M | Tests for appeal lifecycle and deletion path | Counsel | An appeal is visible to the employer, resolvable, and changes the audit trail |
| B9 | **Validation and pilot** (Eval §9) | Evidence the scores mean something | Golden set, human rater study with 2-3 pilot employers, threshold calibration per role family, fairness and robustness test suites | tooling in `backend/tests/eval/` | B2 | L | the suites themselves | Rater availability, privacy | Release gates in Eval §9 reported with confidence intervals; role families that fail ship as assistive only |
| B10 | **Compliance sign-off** (Research §8) | Right to sell | Counsel review of DPDP notice/consent/retention, cross-border transfer, EU/US applicability, DPA with providers; retention config; incident runbook | docs + config | B5 | M (calendar-bound) | checklist | Law changes (DPDP substantive duties about May 2027, Research §8) | Written sign-off recorded |
| B11 | **Load, cost and chaos testing** | Confidence at launch | k6/Locust against stubbed then real provider; provider-outage and worker-kill drills; cost-per-interview from the ledger | tooling | B2-B4 | M | the tests | Real-provider cost | Meets Arch §8 targets or documented capacity limits |

Phase B launch gate (all must hold): every Phase A item done; B1-B11 acceptance met; Eval §9 gates passed for each role family offered; counsel sign-off; zero open Critical/High audit items; runbook and on-call exist.

---

## Phase C: advanced capabilities (prioritised by value / feasibility / risk)

| # | Item | Value | Notes | Cx | Priority | Risk |
|---|---|---|---|---|---|---|
| C1 | Auto-invite rules and bulk automation | High (recruiter time) | Needs consent flow and quota guards (Req B2) | M | 1 | Mistaken invites; cost |
| C2 | Template library + role-family starter packs (civil-services-aware competencies: ethics case, administrative judgement, policy writing) | High differentiation (Research §6) | Needs subject-matter review | M | 2 | Quality of curated content |
| C3 | ATS/HR connectors: webhook and CSV first, then Greenhouse/Lever/Ashby | Medium-High | Partner APIs unverified in research (Research appendix) | L per connector | 3 | Partner approval |
| C4 | Candidate feedback report | Medium (lower drop-off, Research §7) | Separate from employer view | M | 4 | Disclosure and consistency |
| C5 | Adaptive follow-ups beyond one probe, constrained | Medium | Only after stability gates hold | M | 5 | Consistency across candidates |
| C6 | Live voice conversation | Medium, high cost | $1-3 per 20 min (Research §9); needs separate pricing | XL | 6 | Latency, ASR bias, validity |
| C7 | Hinglish and more Indian languages with per-language WER reporting | High in India | Needs evaluation data per language | L | 7 | ASR bias (Research §7) |
| C8 | Identity verification and stronger integrity | Medium | Advisory flags, consent, privacy cost | L | 8 | Overreach, false accusations |
| C9 | Advanced analytics and adverse-impact dashboard | Medium (enterprise, compliance) | Needs lawful demographic data | L | 9 | Legal |
| C10 | Enterprise admin: SSO, audit export, retention policies, data residency | Medium (enterprise sales) | | L | 10 | |
| C11 | Code/case simulations | Low-Medium | Not our core | XL | defer | |
| C12 | Video | Not recommended | No validity evidence, legal exposure (Research §7) | n/a | do not build | |

Each Phase C item needs its own mini-spec with the same fields (value, technical change, FE/BE/DB, dependencies, tests, risks, acceptance) when scheduled.

---

## Recommended order and rough sizing

1. Phase A in the order A1, A2, A4, A3, A5, A7, A6, A8, A9 (about 2 weeks). A1-A2 first because they are cheap and remove the worst signal problems.
2. B1 -> B2 in sequence, with B3 (metering) and B4 (invitations) in parallel by a second engineer. B5, B6 follow. B9 (validation) starts as soon as B2 produces output and runs alongside B5-B7.
3. B10 and B11 before launch. Launch to 3-5 pilot employers first, price after pilot data.
4. Phase C by the priority above.

Rough total to a paid, supervised launch: **about 3-4 months for two engineers** `[Assumption]`, dominated by B2 (evaluator), B9 (validation) and B10 (compliance, calendar-bound).

---

## Test strategy (Phase 8 of the brief)

| Layer | What | Notes tied to the Audit |
|---|---|---|
| Unit | Rubric application, aggregation, band thresholds, status machine, quota arithmetic, discrimination filter, evidence validation | Add the missing B1 regression first; replace `MagicMock` DB tests and `inspect.getsource` tests with real-transaction tests (Audit §9) |
| Integration | Real Postgres (rolled-back transaction per test, already the project's pattern), Celery in eager mode with stubbed providers, email stub, Razorpay stub, ledger reconciliation | No network in tests (project rule) |
| End-to-end | Browser: employer creates and publishes, bulk invites, candidate consents, answers, resumes after disconnect, results, override, decision; run through the Browser pane or Playwright | Audit §12: none exists today |
| Failure | Provider timeout/429/malformed JSON, both providers down, worker killed mid-evaluation, candidate disconnect, abandon, duplicate submit, double start | Assert recovery and no charge on system faults |
| AuthZ / tenancy | Two companies x two departments x roles (owner, recruiter, interviewer, department head) on every route; candidate cannot read others; admin only on admin | Audit B8; tests must fail when the filter is removed |
| Load / concurrency | 200 concurrent interviews, 1,000 submissions/hour burst on a stubbed LLM; then a throttled real run for cost/latency; queue drain time; DB lock contention on quota | Targets in Arch §8 |
| Security / injection | Corpus of injection strings in answers, resume, JD, custom questions; output must not move scores beyond noise; markup/HTML escaping in the scorecard | Audit §7 gaps |
| Regression | Existing recruitment flows (jobs, applications, pipeline, verification, team invites); practice interviews for aspirants unchanged | Run the whole suite, not only touched files |
| Evaluation quality | Golden-set harness in `backend/tests/eval/` producing the Eval §9 metrics as a report; runs on every prompt/model change | |
| Fairness / accessibility / consistency | Counterfactual swaps, paraphrase/dialect variants, typed vs ASR, a11y audit, re-run stability | Needs lawful, consented data |
| Cost / latency | Per-stage token, cost and latency benchmarks from `model_runs`/ledger on the golden set | Feeds Com §2 |

Release rule: no capability is called production-ready without the tests above for that capability and a recorded run of the relevant gate.
