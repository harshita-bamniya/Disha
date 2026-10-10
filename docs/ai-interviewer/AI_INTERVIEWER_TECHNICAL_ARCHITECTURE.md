# AI Interviewer (Employer): technical architecture proposal

Status: proposal, 2026-10-10. No code or database has been changed.
Tags: `[Code]` audit-observed (Audit B#/§), `[Research]`, `[Decision]` recommendation, `[Assumption]` to validate.

## 1. Guiding decision: evolve, do not rewrite

`[Decision]` Keep the working parts (Audit §1: consent ledger, share grants, invitations tied to applications, code-computed scoring, evidence-substring check, safety net, purge job, Celery grading with atomic claim, 182 passing tests). Change four things that are structurally wrong:

1. **Questions and rubric become employer-approved template data**, frozen per version, instead of per-candidate LLM output (Audit B5).
2. **Scoring moves from a UPSC-coach prompt to a per-competency rubric evaluator** that receives the competency, anchors and answers (Audit B4).
3. **The server owns the interview**: it issues questions, persists follow-ups, and tracks completeness (Audit B1, B2).
4. **Add the commercial and operational layer** that does not exist: entitlements, usage ledger, delivery, sweeper, overrides, versioned evaluations (Audit B3, B7, B11).

The practice product for aspirants keeps using the existing engine untouched; verified mode forks at the question source and the scorer (both already switch on `session.mode == "verified"`, Audit §3).

## 2. Target architecture

```
Employer UI ──► FastAPI (verified_router, new: screening_router)
                   │   authz: company + department scope on every route
                   ├─ TemplateService   (draft → approve → publish version)
                   ├─ InviteService     (invite, remind, cancel, expire) ──► Brevo email + Notification
                   ├─ SessionService    (server-issued questions, follow-ups, timer, heartbeat)
                   ├─ EvaluationService (stage pipeline, below)  ◄── Celery queue "grading"
                   ├─ UsageService      (reserve / consume / refund, ledger, caps)
                   └─ ReviewService     (overrides, decisions, appeals, audit log)
Candidate UI ──► same API, candidate-scoped
Celery beat: sweeper (expire/abandon/re-dispatch scoring), reminders, purge, usage rollup
LLM gateway (ai/providers): provider abstraction, structured output, retry/fallback, run log (model_runs)
Postgres: shared with practice; new tables prefixed interview_*
Object storage (S3-compatible) for audio, replacing local disk
```

## 3. Database changes

Reuse: `interview_templates`, `interview_invitations`, `interview_sessions` (mode `verified`), `session_responses`, `share_grants`, `employer_decisions`, `interview_appeals`, `integrity_events`, `interview_consents`, `model_runs`, `notifications`, `job_postings`, `applications`, `company_subscriptions`/`subscription_plans` (Audit §4). Do **not** duplicate candidate or job data: reference by id and snapshot only what must be frozen.

### 3.1 Altered tables

| Table | Change | Reason |
|---|---|---|
| `interview_templates` | add `current_version_id`, `status` adds `draft`; `job_id` FK validated in service (company + department); keep `competencies` JSONB as legacy and migrate | A1, A9; Audit B22 |
| `interview_invitations` | add `template_version_id`, `status` expanded (see Requirements B4), `opened_at, consented_at, submitted_at, last_activity_at, last_reminded_at, reminder_count, cancelled_at, cancelled_by, source` (manual/auto), `attempt_no`; unique `(template_id, application_id, attempt_no)`; keep `uq` semantics for active attempt | B3-B6; Audit B11, B12 |
| `interview_sessions` | add `template_version_id`, `deadline_at`, `completed_questions`, `planned_questions`, `completeness` (computed on submit), `last_heartbeat_at` | R6, C3, C6; Audit B1, B19 |
| `session_responses` | add `template_question_id` (FK), `issued_followup_id` (FK), `asr_raw_text`, `asr_confidence`, `audio_object_key`, `time_spent_sec_server`; **stop accepting `dynamic_question_text` from the client** | Audit B2, B16 |
| `share_grants` | keep; add `company_id` and scope check helper by department | Audit B8 |
| `employer_decisions` | add `application_id`, `superseded_at`, drop unique `(session, user)` in favour of append-only history with `is_current` | Audit B14 |
| `subscription_plans.features` (JSONB, currently NULL for all plans, Audit B3) | populate `{ "ai_interviews": {"included": N, "overage_rupees": X, "max_template_questions": 8, "auto_invite": false} }` | P1 |

### 3.2 New tables

| Table | Purpose / key columns |
|---|---|
| `interview_template_versions` | `id, template_id, version_no, status (draft/published/retired), jd_snapshot JSONB, objective_requirements JSONB, competencies JSONB [{key,name,weight,must_have,description}], rubric JSONB {competency_key: {anchors 1..5, positive_signals, negative_signals, evidence_needed}}, settings JSONB (mode, duration, followups, retake policy, language), approved_by, approved_at, prompt_set_version`. Immutable once published. |
| `interview_template_questions` | `id, template_version_id, competency_key, position, text, type (behavioural/situational/knowledge/info), expected_signals JSONB, max_followups, is_custom, source (ai/employer)`. Frozen question set (Audit B5). |
| `interview_followups` | `id, response_id, question_id, probe_type, text, generated_by_model_run_id, issued_at`. Server-recorded follow-ups (Audit B2). |
| `interview_evaluations` | One per (session, evaluation_run): `id, session_id, run_no, status, rubric_version (= template_version_id), prompt_set_version, model_map JSONB, started_at, finished_at, overall_recommendation, completeness, flags JSONB, cost_usd_micro, is_current`. Re-scoring creates a new run; old runs kept (reproducibility). |
| `interview_competency_scores` | `evaluation_id, competency_key, score (1-5 or NULL), evidence_status (strong/weak/missing/contradictory/insufficient), confidence_band, rationale, pass_scores JSONB, needs_human_review`. |
| `interview_evidence` | `competency_score_id, response_id, quote, char_start, char_end, supports (positive/negative/neutral), validated bool`. Offsets into the stored transcript so the UI can highlight the segment. |
| `interview_score_overrides` | `evaluation_id, competency_key NULL (=overall), original_value, new_value, reason, user_id, created_at`. Append-only. |
| `interview_invitation_events` | audit log: `invitation_id, event (created, emailed, reminded, opened, consented, started, resumed, submitted, scored, expired, cancelled, retake_granted, accommodation_requested…), actor, at, meta JSONB`. |
| `interview_accommodation_requests` | `invitation_id, kind, note, status, resolved_by, resolved_at`. |
| `ai_usage_ledger` | `id, company_id, invitation_id, session_id, kind (reserve/consume/refund/adjust), units, unit_price_rupees NULL, llm_cost_usd_micro, stt_seconds, tts_chars, created_at, idempotency_key UNIQUE`. Single source for metering and margin. |
| `company_ai_quota` | `company_id, period_start, period_end, included_units, used_units, reserved_units, hard_cap_units, source (plan/addon/manual)`. Row-locked updates. |
| `audit_log` (generic, if none exists) | `actor, action, entity, entity_id, before, after, at, ip`. Check for an existing admin audit table first (`audit_logs` relation exists on `User`, Audit §4); extend rather than add. |

### 3.3 Indexes, transactions, access rules

- Indexes: `interview_invitations(template_version_id,status)`, `(application_id)`, `(status, expires_at)` for the sweeper, `(status, last_activity_at)`; `interview_evaluations(session_id, is_current)`; `interview_competency_scores(evaluation_id)`; `ai_usage_ledger(company_id, created_at)` and the idempotency unique.
- **Transaction boundaries:** invite = one transaction (row-lock quota, insert invitation, insert reserve ledger row, insert event; commit; then enqueue email). Start = `SELECT ... FOR UPDATE` on the invitation so a double click cannot create two sessions (Audit B12). Scoring completion = one transaction writing evaluation, scores, evidence, consume ledger row, and `invitation.status='scored'`; idempotent via the existing atomic claim and the ledger idempotency key.
- **Data access rule:** one helper `visible_job_ids(user)` (reuse `matching/service/core.py:127-161`) applied to *all* employer read paths; replaces `_colleague_ids` (Audit B8). Contract tests with two companies and two departments.
- **Migrations:** additive and backward compatible first (new tables, nullable columns), then backfill, then constraint tightening. Never drop `interview_templates.competencies` in the same release. Every migration reviewed against the Docker DB on 5433 after a `pg_dump` (project rule in CLAUDE.md).

## 4. Evaluation pipeline (detail in Evaluation Framework)

Celery task `evaluate_verified_session(session_id, run_no)`:

1. **Pre-checks (code):** completeness, per-answer length/language, fallback markers, ASR confidence, injection pattern scan, similarity vs other candidates of the same template version.
2. **Per-answer, per-competency extraction (LLM, structured):** for each question, extract claims/examples and map them to the competency's rubric anchors; output JSON validated by schema (pydantic), with `quote` verified to be an exact substring of the transcript and offsets computed in code.
3. **Independent second pass** (same temperature, different prompt phrasing or a second model); disagreement > 1 anchor level -> `needs_human_review`.
4. **Deterministic aggregation (code):** competency score from anchored scores with documented weights; must-have rules; evidence_status rules; insufficient-evidence rules; recommendation category from configurable bands.
5. **Summary (LLM, constrained):** writes the recruiter narrative only from validated scores and quotes; a verifier step rejects any sentence that cites a quote not in the evidence table.
6. Persist evaluation + scores + evidence + flags + cost in one transaction; enqueue notification.

`[Research]` Evidence quotes per score are the accepted explainability pattern (Research §7), and structure beats unconstrained judgement (Research §1.2). `[Code]` Reuses `scoring.py` ideas (code-computed overall, must-have x1.5, disagreement flag) and `feedback_ai.py` validation helpers.

## 5. AI orchestration

| Concern | Design |
|---|---|
| Provider abstraction | Keep `ai/providers` (`create_provider`). Add a **verified-mode provider policy**: primary and secondary provider, per-purpose model map (setup/draft, follow-up decision, extract, verify, summary). Today the only fallback is an Anthropic key that is empty here (Audit §5). |
| Data-processing terms | `[Research §9]` Use paid-tier Gemini (free tier trains on and may human-review data), Groq with zero-data-retention enabled and a signed DPA, or OpenAI/Anthropic with DPAs. **Do not run production candidate data on a free-tier key.** Confirm the current local keys' tier before any pilot. |
| Structured output | Pydantic models for every LLM reply; provider JSON-mode/tool-schema where available; one repair retry, then fail closed (no silent fallback to generic output, Audit B6, B18). |
| Prompt versioning | Prompts live in versioned files `ai/prompts/verified/<name>@<semver>.md`; `prompt_set_version` stored on every evaluation and template version. Golden-set tests run per change. |
| Context management | Each scoring call gets only: competency definition, rubric anchors, the question, the candidate's answer(s) for that question, and nothing else. No resume/KRS/practice history in verified mode (Audit B5). |
| Question/follow-up logic | Questions come from the frozen set. Follow-up model chooses *whether* and *which approved probe type*; text is generated within the probe template; code enforces count, relevance (must reference the same competency) and the discrimination filter; the issued text is stored (`interview_followups`). |
| Timeouts/retries/rate limits | Per-call timeout 30-60s, exponential backoff with jitter on 429/5xx, circuit breaker per provider, automatic switch to secondary after N failures, **bounded automatic re-dispatch** of scoring by the sweeper (3 attempts over ~2h), then `scoring_delayed` visible to the employer and an alert to admins. |
| Reproducibility | Store model id, provider, temperature, prompt version, rubric version, seed where supported. Re-scoring creates a new `interview_evaluations` run rather than rewriting (Audit §3 row 21 notes today's feedback rows are deleted and regenerated). Exact reproducibility is not guaranteed by hosted LLMs; stability is measured instead (Evaluation Framework §7). |
| Prompt injection | Defence in depth: (1) fence all candidate text with a per-request random delimiter and strip lookalike tags; (2) system prompt states that fenced text is data; (3) schema-constrained outputs; (4) code-side evidence validation, so injected claims cannot fabricate quotes; (5) a classifier/heuristic pass for instruction-like text in answers, resume and JD, which raises a flag rather than changing the score; (6) job descriptions and employer questions are also fenced; (7) scoring prompts never receive question text from the client (Audit B2). |

## 6. Modalities

| Mode | Recommendation | Why |
|---|---|---|
| Text | **MVP, default.** | Lowest cost, no ASR bias, accessible, easiest to audit. |
| Audio answer -> STT -> candidate-confirmed transcript | **MVP optional.** | Already built (Groq Whisper, Gemini fallback, Audit §3 row 18/20). Keep both raw ASR text and confirmed text; store audio in object storage with the answer id, not local disk (Audit B16); report accuracy by language before enabling Hinglish. `[Research]` ASR error rates differ by demographic group; typed fallback is mandatory. |
| Live voice conversation (realtime) | **Phase C.** | `[Research §9]` roughly $1-3 per 20-minute interview vs cents for batch; latency and failure handling are significantly harder; adaptive follow-ups carry more consistency risk. Validate demand first. |
| Video | **Not recommended** initially. | No validity evidence for visual signals; legal exposure (Illinois, Maryland, EU emotion-recognition ban, Research §7-8); storage cost. If employers want a video introduction, treat it as unscored context. |
| Facial expression, eye contact, voice tone, accent, emotion, "personality" | **Never scored.** | Research §7. Integrity events remain advisory only. |

TTS for the interviewer's voice is optional; cache fixed question audio per template version (questions are now static, so caching becomes complete rather than per-candidate).

## 7. API surface (new or changed)

```
Employer
 POST   /interview/employer/templates                    create draft (job_id required)
 POST   /interview/employer/templates/{id}/generate      AI draft competencies/questions/rubric  [rate-limited, metered]
 PUT    /interview/employer/templates/{id}/draft         edit questions/rubric
 POST   /interview/employer/templates/{id}/publish       approve → immutable version
 POST   /interview/employer/templates/{id}/preview       employer test run (unbilled)
 POST   /interview/employer/invitations/bulk             [{application_id}…] with quota reserve
 POST   /interview/employer/invitations/{id}/remind|cancel|retake
 GET    /interview/employer/jobs/{job_id}/screening      funnel + compare table
 GET    /interview/employer/results/{session_id}         scorecard (+ ?run=)
 POST   /interview/employer/results/{session_id}/override
 POST   /interview/employer/results/{session_id}/decision   append-only; optional stage change
 GET    /interview/employer/usage                         quota, used, cost-free summary
Candidate
 GET    /interview/invitations/{id}                       notice + consent text
 POST   /interview/invitations/{id}/accommodation
 POST   /interview/sessions/{id}/answer                   {question_id, text|audio_key}; server returns the next question
 POST   /interview/sessions/{id}/heartbeat
 POST   /interview/sessions/{id}/submit                   rejected unless all planned questions answered or explicitly "finish early" (→ incomplete)
Admin
 GET    /admin/ai-interviews/usage|failed|appeals|invitations ; POST retry/rescore/kill-switch
```
Existing practice `/respond`, `/next-question`, `/complete` must reject `mode=verified` sessions so the candidate cannot call them directly (Audit §7, B15, B17).

## 8. Reliability and scalability requirements

- **Async everywhere heavy:** scoring only in Celery; request path never calls an LLM except `next question decision` (bounded to ~3 s with a deterministic fallback to "no follow-up").
- **Queues:** separate Celery queues (`grading`, `email`, `sweeper`) and concurrency limits per provider token bucket, so a burst of 500 submissions queues instead of failing on 429s.
- **Idempotency:** keep `_claim_grading` and add ledger idempotency keys and a unique `(session_id, run_no)`.
- **Sweeper (every 5 min):** re-dispatch `pending/failed/stale` scoring (bounded), expire invitations, abandon idle sessions, send reminders, release unused reservations.
- **Rate limiting:** `slowapi` (already a dependency) on candidate answer/heartbeat and on every employer LLM-triggering endpoint; per-company daily cap from the plan (Audit B17).
- **Storage:** audio and any recordings in S3-compatible storage with server-side encryption and per-object retention tags; signed short-lived URLs; no local disk (Audit §7). Transcripts in Postgres, encrypted at rest at the volume level; consider column-level encryption for transcripts as a later hardening `[Assumption]`.
- **Tenant isolation:** department-scoped helper, plus Postgres row-level policies considered later; tests for every route.
- **Observability:** structured JSON logs with `company_id, invitation_id, session_id, evaluation_id`; metrics: scoring latency, failure rate by provider, tokens and cost per interview, queue depth, completion funnel; alerts on failure rate > 10% over 15 min, queue age > 15 min, daily spend > cap. Existing `observability/` directory can host dashboards. Error tracking (Sentry or equivalent) `[Assumption: none configured; verify]`.
- **Provider outage:** circuit breaker to secondary provider; if both fail, sessions remain `scoring_delayed` with automatic retries and no candidate action.
- **Load targets** `[Assumption]`: 200 concurrent interviews, 1,000 submissions/hour burst. Verify with Locust/k6 against a stubbed LLM first, then a rate-limited real provider for cost/latency.
- **Cost controls:** per-company hard cap, per-interview token budget (abort and flag if a session exceeds 3x the median), template generation limited to N/day, cached TTS, cheaper model for extraction if golden-set quality holds.

## 9. Security

- Authorisation by company + department on every route (Audit B8); candidate routes by `user_id`; admin by role.
- Invitation links: signed, short-lived, single-candidate; still require login (existing model) with step-up option later.
- Integrity v1 (advisory): server-side timing, copy/paste and tab events, cross-candidate answer similarity; labelled as observations, never auto-penalised (Audit B20, Research §4).
- Secrets and PII: no names/phones/emails in LLM prompts; logs redact candidate text; no candidate data in error trackers.
- Retention (proposal `[Decision]`, counsel to confirm): transcripts and scorecards 180 days after decision or job close (existing), audio 30 days (existing, but the grant outlives it: align or label), consents and audit logs 3 years, usage ledger 8 years (accounting). Deletion requests honoured by the existing purge path extended to the new tables.
- Incident response: documented runbook, 72-hour breach notification path (`[Research §8]` DPDP; confirm with counsel).

## 10. What we deliberately do not build now

Video capture, facial or voice analytics, real-time voice agent, ATS connectors, identity verification, automated rejection, ML-trained ranking on past hiring outcomes (historical decisions embed bias, Research §7), a self-hosted LLM.
