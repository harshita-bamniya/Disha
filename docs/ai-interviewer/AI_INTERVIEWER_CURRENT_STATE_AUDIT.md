# Employer AI Interviews ("Verified Interview"): current-state audit

Audit date: 2026-10-10. Branch `chore/sync-full-working-tree`. Read-only: no application code, migrations or data were changed.
Method: every claim below was traced in code (file:line). Where noted, a claim was also run (unit tests, a small scoring probe inside the backend container, read-only SELECTs against the Docker Postgres on 5433). Prior docs (`docs/ai-interview-engine-plan.md`, `docs/ai-interview-engine-testing.md`) were treated as claims to check, not evidence.

Paths are relative to `backend/app/` (BE) or `frontend/src/` (FE) unless a full path is given.

---

## 1. Executive verdict

**What exists is a credible, carefully built first version of a consent-first "verified interview" workflow. It is not yet a reliable first-round screening product, and it cannot be sold as a paid service today.**

- **Plumbing is real and mostly sound.** Employer templates (competencies + weights + up to 3 own questions, with a protected-attribute filter), invitations tied to real applications, one attempt per invitation, consent-gated expiring/revocable share grants, two-pass scoring, code-computed scores, evidence quotes checked as real substrings, soft integrity observations, human decisions with reason codes, appeals, admin retry, 180-day deletion. 182 unit tests in `test_interview_phase2/6.py` pass (I re-ran them).
- **The interview itself is generic AI-generated questions plus a summary, not a job-specific screen.** The scorer is a UPSC "interview coach" prompt that never sees the employer's competencies, the job description, expected-answer hints or a rubric (`modules/interview/feedback_ai.py:30-72`, called at `service/feedback.py:387-390`). Each candidate gets a different, personalised question set (resume, KRS, prior practice weaknesses are injected: `service/session_setup.py:155-199, 218-222`), so results are not comparable across candidates even though the UI says everyone is "assessed on the same questions" (`service/verified.py:165-168`).
- **Integrity of the numbers has real holes**, including one I reproduced by execution: a candidate who answers 2 of 7 questions can get overall 45, "No Hire" internally, and the employer-facing badge **"Strong fit"** (section 8, B1). The questions asked are also client-asserted, so a candidate can choose their own question text (B2).
- **Not a paid service yet:** no plan gating, metering, quota or billing of any kind for AI interviews on the employer side (B3); no email delivery, reminders or expiry sweeps; no admin UI; scoring depends on a single LLM provider with no fallback in this environment (local `model_runs` show 54% of `answer_score` calls failing on Groq quota); the feature has **never been exercised end to end** here (all verified-interview tables are empty).

Overall: **PARTIAL / pilot-grade.** Good enough for a supervised pilot with a handful of employers if B1-B3 are fixed first; not good enough for unsupervised paid use.

---

## 2. Architecture and end-to-end workflow

### Components

| Layer | Where |
|---|---|
| Employer + candidate HTTP API | `BE modules/interview/verified_router.py` (mounted under `/interview` via `modules/interview/router.py:33-37`) |
| Domain logic | `BE modules/interview/service/verified.py` (694 lines) |
| Practice engine reused for the live room | `service/session_setup.py`, `service/interaction.py`, `service/sessions.py`, `policy.py`, `safety.py`, `transition.py` |
| Scoring and report | `service/feedback.py`, `feedback_ai.py`, `scoring.py`, `BE ai/dynamic_interview_engine.py` |
| Voice | `BE ai/speech.py`, `service/voice.py`, `audio_store.py` (local disk) |
| Background | Celery: `BE tasks/worker.py:554` (grading), `:568` (audio purge), `:595` (verified purge). Worker runs with embedded beat (`docker-compose.yml:106`). |
| Employer UI | `FE modules/employer/pages/VerifiedInterviewsPage.tsx`, `VerifiedInterviewResultPage.tsx`; routes `App.tsx:385-386`; nav `shared/config/navigation.ts:127,153` ("AI Interviews") |
| Candidate UI | `FE modules/interview/pages/Interview{Invitation,Instructions,Check,Room,Report}Page.tsx`, `hooks/useIntegrityEvents.ts`; route `App.tsx:409` |

### Sequence (as implemented)

```
Employer UI            API (verified.py)                         Candidate UI            Celery / LLM
-----------            -----------------                         ------------            ------------
New interview  ------> create_template (L138): competencies,
(Interviews tab)       custom Qs -> compliance filter (L122)
                       [job_id accepted but unchecked, no UI]
Invite tab     ------> invite (L201): application must be on
(first 100 applicants) employer's scoped jobs (L209); template
                       job must match (L210); unique(template,
                       candidate) (L213, DB uq); creates invitation
                       + in-app Notification only (L227-232)  --> bell notification (no email)
                                                                 Invitation page (consent text)
                                                                 -> instructions -> device check
                                                                 -> POST /invitations/{id}/start
                       start_invitation (L334): needs consents
                       ai_processing + employer_share (L47,352);
                       create_session(plan) (L365) -> LLM:
                         blueprint (20B model), questions (20B);
                         employer Qs appended; transition Q
                         prepended; session.mode="verified" (L368)
                                                                 Room: per answer
                                                                 POST /sessions/{id}/respond (text,
                                                                  question_text from CLIENT)
                       submit_response (interaction.py:60):
                         crisis -> abandon; distress -> skip scoring
                       POST /next-question -> LLM "live_decision"
                         (120B default model) may suggest follow-up;
                         policy.py decides (code wins)
                                                                 POST /sessions/{id}/complete
                       complete_session (feedback.py:184):
                         status=completed, grading=pending ------> grade_interview_session
                                                                  (soft 780s / hard 840s)
                                                                  per answer: score pass1 (T=0.1) +
                                                                  retry; pass2 (T=0.4) (L392-399)
                                                                  report LLM (120B) + code scoring
                                                                  (scoring.py:174) -> JobReadinessReport
                       run_grading -> verified.on_graded (L377):
                         invitation=completed; ShareGrant (180d)
                         iff employer_share consent; notify the
                         inviting employer user ONLY (L406)
Results tab    ------> get_result (L492): live grant required;
View scorecard         returns band, score, per-competency,
                       answers+evidence, integrity list
Decision form  ------> decide (L559): shortlist/hold/decline
                       + reason code (stored; no other effect)
```

Candidate-controlled exits: decline (L314), revoke share (L430), appeal (L608), delete whole session (`router.py:88`). Admin: list/resolve appeals, grant one retry (`modules/admin/router.py:886-931`). Daily purge at 04:00 (`worker.py:113`).

---

## 3. Capability classification

| # | Capability | Status | Evidence |
|---|---|---|---|
| 1 | Employer creates interview template (role, language, 10/15/20 min, 1-8 weighted competencies, must-have flag) | WORKS | `verified_schemas.py:28-38`; `verified.py:138-148`; DB check `duration_minutes BETWEEN 10 AND 20` (`models/interview_verified.py:54`) |
| 2 | AI-suggested competencies | WORKS (static taxonomy for 13 roles, else LLM, else 4 generic) | `verified.py:129-135` -> `ai/dynamic_interview_engine.py:233-286`, taxonomy `:21-146`, generic fallback `:221-226` |
| 3 | Employer's own questions (max 3) with discrimination filter | WORKS (keyword filter; English/Hindi/Hinglish phrases) | `compliance.py:17-90`; `verified.py:122-126` |
| 4 | Template linked to a job posting | PARTIAL | column exists (`models/interview_verified.py:39`) and API accepts `job_id` (`verified_schemas.py:33`) but the UI form has no job field (`VerifiedInterviewsPage.tsx:155-159`), the id is never validated (`verified.py:140-141`) and the posting's description is never used |
| 5 | Link interview to an application / company | WORKS | invitation carries `application_id`, `employer_user_id` (`models/interview_verified.py:64-66`); template has `company_id` (`:38`) |
| 6 | Invite a candidate | WORKS for applicants only | `verified.py:201-234`; cannot invite anyone without an application (`verified_schemas.py:46-48`) |
| 7 | Invitation delivery | PARTIAL (in-app only) | `create_notification` only (`verified.py:227-232`; `modules/inbox/service.py:17-20`); email columns are used only by the announcement task (`tasks/announcements.py:61,79`) |
| 8 | Invitation expiry | PARTIAL | computed lazily for `invited` only (`verified.py:194-198`); no sweep job; nothing expires once `started` |
| 9 | Reminders / resend / cancel invitation | MISSING | no code path; "interview-reminders" beat task is for human-scheduled interviews (`worker.py:93-95`) |
| 10 | Duplicate-invite prevention | WORKS | pre-check `verified.py:213-219` + DB unique `uq_interview_invitation_candidate` (`models/interview_verified.py:77`); concurrent race returns a 500 (no `IntegrityError` handling) |
| 11 | One attempt / admin retry | WORKS | `verified.py:344-350`, `allow_retry` `:658-678`; retry grants ONE more attempt and withdraws the old result |
| 12 | Candidate consent capture and ledger | WORKS | required consents `verified.py:47,352-356`; ledger `sessions.py:74-84`, table `interview_consents` (text_version, revoked_at) |
| 13 | Question generation | PARTIAL: LLM-generated per candidate, not fixed per template | `session_setup.py:202-336`; models `LIGHT_MODEL` = gpt-oss-20b (`ai/providers/groq.py:21`, used `dynamic_interview_engine.py:488,544`) |
| 14 | Question quality fallback | MOCKED-HARDCODED on any LLM failure | 5 hardcoded generic questions (`dynamic_interview_engine.py:722-760`), hardcoded blueprint (`:710-719`); no flag to employer |
| 15 | Fixed career-transition question | HARDCODED, always first | `transition.py:14-30`, `session_setup.py:317`; "civil services" text for every candidate |
| 16 | Follow-ups | WORKS (LLM suggests, code decides, 1 per question, cap total/2) | `ai/adaptive_interviewer.py:75-157`; `policy.py:15,26-28,56-87`; `interaction.py:222-256` |
| 17 | Response collection: text | WORKS | `interaction.py:60-161` |
| 18 | Response collection: audio | PARTIAL | browser records, server STT returns text to the client, which submits it as typed text (`voice.py:70-103`; `InterviewRoomPage.tsx:255-265`); audio stored only on opt-in `media` consent, on local disk, not linked to answers (`audio_store.py:39-46`) |
| 19 | Response collection: video | MISSING | camera is a local preview only; no recording/upload code (grep of `MediaRecorder` finds only `useRecordedVoice.ts`) |
| 20 | STT / TTS | WORKS (Groq Whisper `whisper-large-v3-turbo`, Gemini fallback; Gemini TTS with disk cache, 80 calls/interview) | `config.py:78-87`; `voice.py:70-160`. Accuracy for Indian accents/Hindi: UNVERIFIED |
| 21 | Per-answer scoring | PARTIAL | two independent passes (T=0.1 and T=0.4), averaged, flag when gap > 2 (`feedback.py:48-68,392-399`; `scoring.py:249-266`); but generic coach prompt (see 6.2) |
| 22 | Structured-output validation | WORKS | clamps/validates 0-10 ints, list shapes (`feedback_ai.py:167-208`); evidence quote kept only if exact substring (`:273-285`) |
| 23 | Code-computed overall score / skill scores | WORKS | `scoring.py:62-91,174-237` (difficulty-weighted means, competency-weighted overall, must-have x1.5 `verified.py:327`) |
| 24 | Fit band (Strong/Good/Developing/Not yet a fit/Needs human review) | PARTIAL: BUG B1 | `scoring.py:269-288`; computed before completeness cap (`feedback.py:151-154`) |
| 25 | Evidence linked to transcript | PARTIAL | one verbatim quote per answer (`feedback.py:412-414`); no span offsets, no per-competency evidence; report-level strengths/gaps are free text |
| 26 | Hire / no-hire labels | PARTIAL | internal `hiring_recommendation` ("Strong Hire".."No Hire", `scoring.py:36-43`) is stored but NOT exposed to employers (test `test_interview_phase6.py` "coaching content never reaches the employer"); employers see fit bands, which function as labels |
| 27 | Employer result view | WORKS | `verified.py:492-531`; `VerifiedInterviewResultPage.tsx:156-218` |
| 28 | Shortlisting / compare / ranking | PARTIAL | shortlist/hold/decline + reason code per user (`verified.py:559-584`); no compare view, no sort/filter, no bulk, and the decision does not touch the application status |
| 29 | Recruiter override / audit trail | MISSING | cannot edit scores; a changed decision overwrites the row (`verified.py:576-577`), no history; grant has `view_count`/`last_viewed_at` only (`:512-513`) |
| 30 | Candidate sees result, appeals, revokes | WORKS (UI) / appeals have no effect | `InterviewReportPage.tsx:268-330`; `verified.py:608-622`; `resolve_appeal` only stores a note (`:647-655`) |
| 31 | Integrity events | PARTIAL | tab-hidden and window-blur only (`useIntegrityEvents.ts:35-43`); `face_missing`/`multiple_faces` are allowed by the API/DB but nothing emits them (grep empty); shown to both sides, never scored |
| 32 | Safety net (crisis halt / distress skip) | WORKS | `interaction.py:113-126,152-158`; `safety.py` |
| 33 | Plan limits, billing, metering for employers | MISSING | `payments/schemas.py:7` gates only 4 aspirant features; `subscription_plans.features` is NULL for all plans (SELECT); the verified router uses `require_employer` only (`verified_router.py:9,119`), not `require_active_employer_subscription` (`payments/service.py:99`) |
| 34 | Admin dashboard | PARTIAL | API only: list/resolve appeals, allow retry (`modules/admin/router.py:886-931`); no frontend (grep: only candidate pages reference the endpoints); no list of invitations, so admins cannot find an invitation id |
| 35 | Retention / deletion | WORKS | grant 180d (`verified.py:43`), verified sessions purged daily (`verified.py:681-694`, `worker.py:595`); audio 30d (`config.py:89`); never-completed sessions are not purged |
| 36 | Failure recovery of grading | PARTIAL | atomic claim, stale detection at 15 min, in-process fallback if broker down (`feedback.py:164-181,243-267`; `router.py:154-161`); no automatic retry, candidate must press retry |
| 37 | Rate limiting on interview endpoints | MISSING | `slowapi` limits exist only on auth/admin (grep) |

---

## 4. Database schema as it exists

Verified against the live DB (alembic head `z7c8d9e0f1a2`; verified-interview tables present, all with 0 rows; 0 verified sessions; `model_runs` has 313 rows from 2026-10-02 to 2026-10-08).

| Table | Key columns | Relationships / constraints |
|---|---|---|
| `interview_templates` (`models/interview_verified.py:31`) | `employer_user_id`, `company_id` (SET NULL), `job_id` -> `job_postings` (SET NULL, nullable), `title`, `role`, `language`, `duration_minutes` (10-20), `competencies` JSONB `[{skill,weight,must_have}]`, `custom_questions` JSONB, `status` active/archived | No version column. Immutable once any invitation exists (`verified.py:164-168`) |
| `interview_invitations` (`:58`) | `template_id`, `employer_user_id`, `candidate_user_id`, `application_id` (SET NULL), `status` invited/started/completed/declined/expired (expired is never stored, only computed), `expires_at`, `session_id` (SET NULL), `retry_granted`, `started_at`, `completed_at` | UNIQUE(`template_id`,`candidate_user_id`). No `last_reminded_at`, no token, no created_by |
| `interview_sessions` (`models/interview.py:55`) | `user_id`, `session_type` (verified uses `full_mock`), `status`, `total_questions`, `job_role`, `job_description` (auto-generated string, not the posting), `blueprint` JSONB (questions ids, `_competencies`, panel, `_transition_question`, `_distress_response_ids`), `job_readiness_report` JSONB, `grading_status/started_at`, `language`, `mode` practice/verified | Shared with the practice product |
| `session_responses` (`:100`) | `question_id` (nullable), `dynamic_question_text/type` (client-supplied for follow-ups and the first answer), `response_text`, `response_time_sec` (client-reported, clamped), `sequence_num`, `is_followup` (server-derived), `submitted_at` | No link to audio file, no ASR raw text |
| `mock_interview_feedback` (`:124`) | per-answer `clarity/conciseness/impact/relevance/star_adherence/overall_score` (ints), `strengths`, `improvements`, `rewritten_answer`, `is_fallback`, `evidence_quote`, `judge_scores` JSONB (pass_1/pass_2), `judge_disagreement_note` | Deleted and recreated on every grading run (`feedback.py:326-329`) |
| `share_grants` (`:82`) | `session_id`, `invitation_id`, `employer_user_id`, `expires_at`, `revoked_at`, `view_count`, `last_viewed_at` | Only gate to employer reads. One employer user per grant (not per company) |
| `employer_decisions` (`:117`) | `session_id`, `employer_user_id`, `decision` shortlist/hold/decline, `reason_code`, `note` | UNIQUE(session, employer_user); overwritten in place; no updated_at/history |
| `interview_appeals` (`:98`) | `session_id`, `user_id`, `reason`, `status` open/resolved, `resolution_note`, `resolved_by`, `resolved_at` | No link to score changes |
| `integrity_events` (`:135`) | `session_id`, `kind` (4 allowed), `started_ms`, `ended_ms` | Cap 300 per interview (`verified.py:44`) |
| `interview_consents` (`models/interview.py:194`) | `user_id`, `session_id` (SET NULL, survives deletion), `kind` (5 kinds), `text_version`, `granted_at`, `revoked_at` | Good audit design |
| `question_banks` | generated questions are inserted here with `[SKILL:...]` prefix in `expected_answer_guide` (`session_setup.py:279-294`) | Shared table; deleted with the session (`sessions.py:87-100`) |
| `model_runs` (`models/interview.py:174`) | `interview_id`, `purpose`, `model`, tokens, latency, ok, error | Per-call cost/latency log; the only metering that exists, and it is not tied to employers |
| `notifications` | in-app only, types `verified_interview_invite/done` (`models/notifications.py:44`) | |
| `interview_human_reviews` / `interview_outcomes` | admin calibration sampling and candidate-reported outcomes | Calibration sampling does not filter by mode (`calibration_service.py` sample query) |

Missing from the schema: per-employer quota/usage, invitation reminder/audit log, rubric/prompt/model version on reports, score-override audit, links from decision to application status.

---

## 5. AI stack

| Purpose | Provider / model | Temp | Where |
|---|---|---|---|
| Competency draft (free-typed role) | Groq `openai/gpt-oss-20b`, low reasoning | 0.4 | `dynamic_interview_engine.py:248-277` |
| Blueprint (greeting, skills, difficulty ramp) | Groq 20B | 0.4 | `:440-505` |
| Question generation | Groq 20B | 0.5 | `:508-562` |
| Follow-up decision ("live_decision") | Groq default `openai/gpt-oss-120b` | 0.3 | `ai/adaptive_interviewer.py:121-129` |
| Answer scoring, pass 1 (+ one retry) | Groq 120B | 0.1 | `feedback.py:392-396` |
| Answer scoring, pass 2 (verified only) | Groq 120B | 0.4 | `feedback.py:54-56` |
| Readiness report (narrative + provisional numbers) | Groq 120B, low reasoning | 0.3 | `dynamic_interview_engine.py:615-630` |
| STT | Groq `whisper-large-v3-turbo`, fallback Gemini audio | n/a | `config.py:78-79` |
| TTS | Gemini `gemini-3.8-flash-lite-tts` + fallbacks, voice "Kore" | n/a | `config.py:82-84` |
| Fallback LLM | Anthropic `claude-haiku-4-5` only if `ANTHROPIC_API_KEY` set (`ai/providers/__init__.py:create_provider`, `anthropic.py:16`). **Empty in this environment's `.env`**, so there is no LLM fallback here. |

Prompts are inline Python strings; there is no prompt/rubric/model version stored on reports (`models/interview.py` has no such column), so a score cannot be reproduced or audited against the prompt that produced it. Candidate text is fenced with `<candidate_answer>` tags and tag-stripped (`feedback_ai.py:84-86`, `ai/untrusted.py`), but see B2 for the question side.

Rough LLM-call count per verified interview of ~9 answers (derived from code, not measured): 2 setup + up to ~9 follow-up decisions + 18-27 scoring calls + 1-2 report + ~9 STT + up to 80 TTS (cached). No per-interview cost figure is available; `model_runs` has the raw data but nothing aggregates it per employer.

---

## 6. Direct answers to the twelve questions

**(1) Configuration / linkage.** Employer opens AI Interviews -> Interviews -> New interview (`VerifiedInterviewsPage.tsx:161-251`). A template belongs to the creator and company (`verified.py:140-141`), is visible to the whole company (`_colleague_ids`, `verified.py:69-78`), and is optionally tied to a job via `job_id`, which the UI never sets and the API never validates (`verified.py:140`; a nonexistent id would 500 on the FK; a foreign company's job id is accepted). In practice templates are standalone. Invitations are always tied to an application (`InviteIn.application_id` required) and, through it, to the employer's own jobs (`_get_employer_application`, `modules/matching/service/core.py:150-161`, which does apply department scoping). The posting's description is never fed to the AI; the "job description" given to the generator is a one-line string listing competency names (`verified.py:361-363`).

**(2) Invitation and start.** Authenticated, account-bound (no token/magic link). The candidate gets an in-app notification only (`verified.py:227-232`) with link `/app/interview/invitations/{id}`. Statuses: invited/started/completed/declined/expired, expiry 1-30 days (default 7, `verified_schemas.py:49`), computed lazily and only before start (`verified.py:194-198`); once started there is no deadline and no abandonment handling. Duplicates blocked (unique per template+candidate). Retake only via admin `allow_retry` (one extra attempt, API only). Candidate must tick `ai_processing` + `employer_share` (`verified.py:352-356`). No email, no reminders, no resend, no cancel/withdraw by the employer. The invite UI lists only the first 100 applicants with no job filter (`VerifiedInterviewsPage.tsx:87`).

**(3) Session and state machine.** `InterviewSession.status`: scheduled -> in_progress (first respond/start) -> completed (candidate calls `/complete`, needs >= 1 response, `feedback.py:184-215`) or abandoned (crisis halt `interaction.py:122`, admin retry `verified.py:673-674`). `grading_status`: pending -> running -> done/failed, stale after 15 min (`feedback.py:164-181`). Invitation status moves invited -> started (`verified.py:369`) -> completed only when grading succeeds (`on_graded`, `:377-411`). There is no server-side timer for the interview; `duration_minutes` only decides the question count (5/7/8, `verified.py:62-64`); verified sessions are typed `full_mock`, so the soft cut-off is 30 minutes regardless of template length (`policy.py:19-20,36-38`), and it only stops the server from offering more follow-ups/questions, not from accepting answers.

**(4) Question generation.** LLM, per candidate, at the moment they start (`session_setup.py:202-336`): blueprint then questions from the 20B model, over the employer's competencies (must-haves only get more scoring weight, not guaranteed coverage; only the first 6 `skills_to_assess` are passed to the question prompt, `dynamic_interview_engine.py:519`). Employer's own questions are appended (`session_setup.py:256-260`) and ordered by difficulty ramp like the rest (`policy.py:90-105`). A fixed civil-services transition question is always first. Generation is personalised with the candidate's resume, UPSC profile, KRS scores and prior weak practice skills (`session_setup.py:155-199,222`) and a counselling-derived "gentle" tone flag (`:230-231`). On LLM failure it silently falls back to generic hardcoded questions. Follow-ups: the 120B model proposes one probe per question, capped at `max(1, total/2)`, code decides (`policy.py:56-87`).

**(5) Responses.** Text is the system of record. Voice: browser records a segment, `POST /transcribe` returns ASR text, the candidate can edit it, then submits text (`InterviewRoomPage.tsx:117-120,255-265`). So the stored "transcript" is whatever the client sent. Audio is saved only with `media` consent, in `<upload_dir>/interview_audio/<session>/` with generated names (`audio_store.py:39-46`), with no mapping to answers; the employer UI labels files "Answer 1..n" by index (`VerifiedInterviewResultPage.tsx:78-79`), which is wrong when a candidate recorded several segments or re-recorded. Audio is purged at 30 days while the employer grant lasts 180. No video.

**(6) Evaluation.**
- Rubric/prompt: `_SYSTEM_PROMPT` (`feedback_ai.py:30-59`) is "an expert interview coach specialising in helping UPSC civil services aspirants transition to private sector roles... coach them toward STAR". Inputs: question text, answer, "career track" (= the role string) and session type (`:61-72`). **It does not receive the employer's competency, weight, must-have flag, the job description, `expected_answer_hints` (generated but only used as a tag carrier, `session_setup.py:279`), or any anchored rubric.** It scores generic clarity/conciseness/impact/relevance/STAR and an `overall_score`. Domain correctness is not assessed in verified mode because the persona judges, including the "domain specialist", are skipped (`feedback.py:435`).
- Models/validation: section 5; parse and clamp `feedback_ai.py:167-208`; two passes averaged, gap > 2 routes to human review (`scoring.py:242-266`). If pass 2 fails, pass 1 stands with **no flag** (`feedback.py:57-59`).
- Code-computed: yes, overall = competency-weighted mean of difficulty-weighted per-skill means (`scoring.py:62-91`); the model's own estimate is kept for audit and a >15 point gap forces human review (`:207-211`). Answers whose `skill_assessed` does not match a competency name are silently dropped from the score when at least one answer matches (probe: skill "Experience" scored 2/10 plus "A" scored 9/10 gave 90.0).
- Evidence: per-answer verbatim quote verified as substring (`feedback_ai.py:273-285`). Not per-competency, no offsets.
- Determinism: temperatures 0.1/0.4, no seed, questions differ per candidate; reruns of grading change numbers (feedback rows are deleted and regenerated, `feedback.py:326-329`). Consistency is therefore bounded by the model, not guaranteed. The completeness cap exists (`dynamic_interview_engine.py:660-707`) but see B1.
- Override/audit: none for scores. Recruiters only record a decision.

**(7) Results.** The employer sees: fit band, overall /100, per-competency scores (including "Career transition story" and "Employer-specific questions" as competencies, `session_setup.py:324`, `transition.py:33-37`), LLM summary, up to 3 strengths and 3 "worth probing" items, each answer with the candidate text, 5 sub-scores, a verbatim evidence quote, a "passes differed" badge, integrity observations, optional audio, and their decision form (`VerifiedInterviewResultPage.tsx:156-218`). Hire/no-hire: the stored `hiring_recommendation` is hidden; the four bands are the label. No compare/rank/filter, no export, no completeness indicator (answered vs planned is not returned by `get_result`, `verified.py:517-531`).

**(8) Integration.** Jobs/applications: invitation requires an application; template may match a job; no link back from the pipeline/applicant pages (grep of FE finds only the nav entries) and the decision does not change application status. Employer accounts: `require_employer` roles incl. `recruiter` and `interviewer` (`core/rbac.py:69`); approved profile needed (`matching/service/core.py:91-97`). Plans/billing/metering: none (see row 33; the only plan fields are `max_active_jobs`, `max_recruiter_seats`, `resume_access`, `candidate_search_limit`, `features` NULL). Admin: appeals and retry endpoints only. Candidate side keeps practice metering separate (`router.py:76,84` charge `mock_interview` credits for practice only; verified starts charge nothing).

**(9) Failure handling.**
- Disconnect: answers are saved per submit; the room resumes (`InterviewRoomPage.tsx:210-221`; `verified.py:346-349`); resume re-requests the next question from the LLM, so the follow-up can differ. No ping/heartbeat, no inactivity timeout.
- Invalid response: below 30 or above 5000 chars -> that answer becomes an unscored fallback (`feedback_ai.py:17-27`, `feedback.py:381,404-405`); UI blocks < 30 chars (`InterviewRoomPage.tsx:33`).
- Abandonment: invitation stays "started" forever; employer sees amber "started"; not purged (`verified.py:681-694` targets completed only).
- AI failure: scoring call retried once (`feedback.py:394-396`), then fallback; if nothing scorable or the report errors -> `GradingUnavailable` -> `failed` (`:531-534`); fallback share < 30% is not flagged to the employer.
- Provider rate limit: Groq 429 retried briefly, > 15 s wait raises `RateLimitedError` (`ai/providers/groq.py:25-32`); Anthropic fallback only if configured. Local evidence: `answer_score` 43/80 failed and `report` 22/26 failed with "Groq API quota exhausted" (free-tier dev key; not necessarily representative of production).
- Celery: grading task has `soft_time_limit=780`, `time_limit=840`, no autoretry (`worker.py:554-565`); worker death -> `running` becomes stale after 15 min -> shown as failed -> only the candidate can retry (`router.py:182-196`). Idempotency: `_claim_grading` atomic UPDATE (`feedback.py:243-267`) and `on_graded` idempotent (`verified.py:390-405`).

**(10) Security.** See section 7.

**(11) Tests.** See section 9.

**(12) Bugs and risks.** See section 8.

---

## 7. Security, privacy and tenant isolation

Endpoint-by-endpoint (`verified_router.py`):

| Endpoint | Check | Verdict |
|---|---|---|
| Candidate `GET/POST /invitations*` (L34-66) | `candidate_user_id == user.id` (`verified.py:297-306`) | OK |
| `POST /sessions/{id}/integrity-events`, `GET`, appeal, appeals, revoke-share (L69-113) | `InterviewSession.user_id == user.id` and `mode == verified` (`verified.py:447-457`) | OK |
| Employer templates list/update/archive (L118-150) | `employer_user_id IN company colleagues` (`verified.py:151-159,182-189`) | Tenant-safe; **not** department-scoped |
| `POST /employer/invitations` | application must be in employer's department-scoped job ids (`matching/service/core.py:150-161`) | OK |
| `GET /employer/invitations` | colleagues filter, limit 200 (`verified.py:259-268`) | Tenant-safe; not department-scoped |
| `GET results/{id}`, `/decision`, `/audio`, `/audio/{name}` (L167-198) | colleagues filter + live grant; audio name resolved inside the session dir (`audio_store.py:56-63`) | Tenant-safe. Any approved employer-role user in the same company (incl. department-limited recruiters/interviewers) can open results for candidates of jobs outside their department |
| `POST /employer/templates/draft` | any employer role, no approval check, no rate limit | triggers an LLM call; abusable for spend |
| Admin endpoints | `require_admin` (`modules/admin/router.py:886-931`) | OK |

Generic practice endpoints also work on verified sessions and are candidate-owned: `/respond`, `/next-question`, `/complete`, `/regrade`, `/regenerate-report`, `DELETE /sessions/{id}` (`router.py:88-210`). The candidate can therefore delete a verified interview (cascading the employer's decision and grant) or call `next-question` without limit.

Other findings:
- **Token handling:** none by design (login-bound invitation id in the URL, not a secret). Anyone holding the candidate's session can sit the interview: no identity check, no liveness, no device binding.
- **Prompt injection:** answers are fenced and tag-stripped in scoring and follow-up (`feedback_ai.py:84-103`, `adaptive_interviewer.py:101-113`); the report transcript is fenced (`dynamic_interview_engine.py:602`). Gaps: the question text is interpolated unfenced into the scoring prompt (`feedback_ai.py:61-65`) and it is client-supplied for follow-ups and the first answer (B2); the judge prompt does not strip tags (`:245-253`, unused in verified). Output is clamped, which limits the blast radius to score manipulation within 0-10.
- **PII / consent / retention:** well designed. Consent text versioned (`sessions.py:74`), share grant 180 days, revocable, purge job, consent rows survive session deletion. Resume content, UPSC profile and KRS scores are sent to Groq in prompts under `ai_processing` consent (`session_setup.py:155-199`); the employer-facing consent text on the invitation page does not mention that practice history/resume influence the questions. Employer sees the candidate's email/phone as the "name" when no full name exists (`verified.py:91-96`).
- **Rate limiting:** none on interview endpoints (only auth/admin use `slowapi`).
- **Integrity/proctoring:** tab-hidden/blur only, from the client, trivially bypassed; sent by the same client being observed. Candidate sees the same list. Fine as a soft signal; not proctoring.
- **Local-disk audio** (`audio_store.py`): breaks on multiple backend instances or ephemeral containers.

---

## 8. Bugs and risks, ranked

Severity guide: Critical = produces a misleading hiring signal, lets the candidate game the result, or blocks charging; High = materially undermines reliability/fairness/operability; Medium/Low = correctness or hygiene.

### Critical

**B1. Fit band is computed before the completeness cap, so an incomplete interview can read "Strong fit".**
`service/feedback.py:151-154` calls `scoring.apply_code_scoring` (sets `fit_band` from the uncapped score, `scoring.py:229`) and only then `_enforce_completeness_cap` (`dynamic_interview_engine.py:660-707`), which lowers `overall_readiness_score` and `hiring_recommendation` but never `fit_band`. Reproduced in the backend container: two answers scored 9/10 out of 7 planned gave `overall_readiness_score=45`, `hiring_recommendation="No Hire"`, `fit_band="Strong fit"`. The employer's list view shows only the band (`verified.py:243-253`, `VerifiedInterviewsPage.tsx:63`). Because the room lets a candidate finish after one answer (`feedback.py:208-209`), this is reachable. Fix: recompute the band after the cap (or apply the cap inside `apply_code_scoring`), and surface "answered X of Y planned" and a hard "Incomplete" band to employers.

**B2. The question being scored is client-asserted, and the candidate can finish at will.**
`interaction.py:138-147` stores `dynamic_question_text` from the request body for any id-less answer (every follow-up and the first answer); the server never records which follow-up it actually issued (`interaction.py:279-292` returns it to the client only). Scoring then evaluates the answer against that stored text (`feedback.py:356-358`). A candidate can submit an easy self-chosen question with a good answer, or use the unfenced question slot for prompt injection (`feedback_ai.py:61-65`). Also `complete_session` only requires one response (`feedback.py:208-209`), and the full question list is handed to the client at start (`session_setup.py:80-97`, `sessions.py:167-307`), contradicting the invitation page's "questions aren't shown in advance" (`InterviewInvitationPage.tsx:94`). Fix: persist each issued follow-up server-side (id), accept only an id, fence/escape the question in prompts, require all planned questions (or mark incomplete), and return one question at a time.

**B3. No metering, quotas or billing for employer AI interviews.**
Nothing consumes or checks entitlement: `verified_router.py:119-198` uses `require_employer`; `payments/schemas.py:7` lists only aspirant features; all employer plans have `features = NULL` and no interview field (`models/subscription.py:12-26`, SELECT on `subscription_plans`); lapsed subscriptions are not blocked (`require_active_employer_subscription`, `payments/service.py:99`, is not applied); starting a verified interview charges nobody (`verified.py:334-372`, vs practice `router.py:76,84`). Each interview is ~30+ LLM calls plus STT/TTS. Fix: add an `ai_interviews` entitlement/quota to `SubscriptionPlan`, check at invite time, consume at start/grade, aggregate `model_runs` per company, add a company-level rate cap.

### High

**B4. The scorer is a UPSC practice coach prompt and ignores the job.** `feedback_ai.py:30-72`, `feedback.py:387-390`. No competency, weight, must-have, JD, expected-answer hints or anchors reach it; STAR is rewarded regardless of question type; the technical-accuracy judge is disabled for verified (`feedback.py:435`). Scores measure answer style, not role fit. Fix: a hiring-rubric prompt per competency (anchored 1-5 behaviours, must-have handling, evidence per competency), pass question hints/JD, keep two passes at the same temperature.

**B5. Candidates are not assessed on the same questions, and context leaks into the employer's assessment.** Questions are generated per candidate at start (`session_setup.py:246-255`) with resume, UPSC stage, KRS and prior practice weak areas (`:155-199,222`). The template lock message claims otherwise (`verified.py:165-168`). Different questions and difficulty make scores incomparable and open a fairness/legal exposure. Fix: freeze a question set on the template (generate once, employer reviews), drop candidate-history inputs for verified mode.

**B6. Silent degradation to generic hardcoded questions/blueprint on LLM failure** (`dynamic_interview_engine.py:503-505,559-562,710-760`). Fallback questions use skill names ("Experience", "Time Management") that do not match employer competencies, so those answers are dropped from the score (probe above) with no flag. Fix: fail the start (retry later) in verified mode, or flag the session and the scorecard.

**B7. Grading is not self-healing and depends on one provider.** No autoretry (`worker.py:554-565`); stale/failed grading waits for the candidate to press retry (`router.py:182-196`); the invitation stays "started" for the employer meanwhile (`verified.py:369,390`); this environment has no LLM fallback (`ANTHROPIC_API_KEY` empty) and shows 54% `answer_score` failures from Groq quota (`model_runs`). Fix: scheduled sweeper that re-dispatches pending/failed verified gradings, a paid-tier/fallback provider, and an employer-visible "scoring delayed" state.

**B8. Company-wide visibility ignores department scoping.** `_colleague_ids` (`verified.py:69-78`) is used for results/decisions/audio/templates, while inviting is department-scoped (`matching/service/core.py:150-161`, `_is_company_wide:127-136`). A department-limited recruiter or an `interviewer` role can read every candidate's transcript and recording in the company. Fix: scope by the invitation's application -> job -> department the same way applications are scoped.

**B9. Fixed civil-services "transition story" question and competency.** Always asked first, scored with weight 10, shown to employers as a competency, not removable (`transition.py:14-30,33-37`, `session_setup.py:317,323`). It is irrelevant to many roles and a proxy for career history. Fix: make it optional per template and exclude it from employer-facing scores by default.

**B10. Employer cannot distinguish incomplete from weak.** `get_result` returns no answered/planned counts (`verified.py:517-531`); abandoned and "started" interviews show no explanation. Combine with B1.

**B11. No email, reminders, resend, withdrawal, or expiry job; no post-start deadline.** `verified.py:227-232,194-198,346-350`. Candidates must open the app to learn of the invitation; started-but-abandoned attempts stay forever. Fix: email via the existing email service, reminder task, nightly expiry/abandon sweep, resend/cancel endpoints.

### Medium

**B12. Race on start and invite.** `start_invitation` reads status without a row lock (`verified.py:338-350`): two concurrent starts both generate sessions (LLM spend) and one session is orphaned; `invite` race hits the unique constraint as a 500 (`:213-225`). Fix: `with_for_update()` on the invitation; catch `IntegrityError`.

**B13. Appeals change nothing.** `resolve_appeal` stores a note only (`verified.py:647-655`); no rescoring, no employer notification, no marker on the employer scorecard; admins cannot map an appeal to an invitation (list returns session id, `:636-644`; retry takes an invitation id, `:658`); no admin UI. Fix: link appeal to invitation, notify employer, support rescoring/adjustment with audit.

**B14. Decision handling.** `get_result` and the list fetch the first decision for the session regardless of which employer user (`verified.py:254,510`) so colleagues see each other's or an arbitrary one; `decide` overwrites with no history (`:576-577`); no effect on application status or candidate notification. Fix: filter per user, keep history, update the application pipeline.

**B15. Candidate can delete a verified interview.** `DELETE /interview/sessions/{id}` ignores `mode` (`sessions.py:103-116`), cascading grant/decision (`models/interview_verified.py:88,122`), leaving the invitation "completed" with no result and no retake. Possibly intended as erasure, but the employer gets no notice. Fix: soft-delete or notify; block deletion while a decision exists, or record a tombstone.

**B16. Audio/transcript integrity.** Transcript is client-supplied; audio not linked to answers; "Answer N" labels can be wrong (`VerifiedInterviewResultPage.tsx:78-79`); stored on local disk; 30-day audio retention vs 180-day grant (`config.py:89,91`).

**B17. No rate limiting on interview/LLM endpoints.** `next-question` can be re-rolled (follow-up not persisted) and `templates/draft` is open to any employer role (`verified_router.py:123-126`).

**B18. Second-pass failure is silent** (`feedback.py:57-59`): the "two independent passes" assurance silently drops to one pass with no flag. Pass 1 and 2 use different temperatures (0.1 vs 0.4), so they are not "the same measurement twice".

**B19. Duration is not enforced.** Template length only sets question count; verified sessions use the 20-minute `full_mock` target (`policy.py:19,36-38`); no countdown/timer in the room; server accepts answers indefinitely.

**B20. Integrity feature overstated.** `face_missing`/`multiple_faces` exist in the DB/API (`models/interview_verified.py:149`) but no client sends them; camera is preview-only; no identity verification.

**B21. Invite UI scale.** Only the first 100 applicants, no job filter, no bulk invite, no applicant-page entry point (`VerifiedInterviewsPage.tsx:87-97`); `list_invitations_for_employer` is N+1 and capped at 200 with no paging (`verified.py:259-268`).

### Low

- B22. `job_id` unvalidated and not exposed in the form (`verified.py:140,169-170`).
- B23. `sanitize_text` rewrites "failure/weak/poor" inside employer-facing text, including technical phrases like "single point of failure" (`scoring.py:140-164,231-236`).
- B24. The 14-day "How did your search go?" prompt is also sent for verified sessions with wording "You practiced for this role" (`worker.py:511-536`; no mode filter).
- B25. Candidate page says the employer sees "the same scorecard" (`InterviewReportPage.tsx:291-293`), but employers get a different, coaching-free view.
- B26. Fallback share below 30% is not flagged (`scoring.py:222`); at 7-9 answers two unscored answers pass silently.
- B27. `own_effort` consent is sent by the UI but not required by the API (`verified.py:47`).
- B28. Report narrative is in the interview language (Hindi/Hinglish) so an English-reading recruiter may get a Hindi summary (`dynamic_interview_engine.py:624`, `language.py:51-63`).
- B29. Fit-band thresholds (80/65/50) and the 2-point pass-disagreement threshold are uncalibrated; no calibration data exists (`calibration_service.py`; 0 verified sessions).

---

## 9. Tests: present vs missing

Present (re-run: `docker exec -w /app beginablai_backend python -m pytest tests/test_interview_phase6.py tests/test_interview_phase2.py -q` -> **182 passed**). `test_interview_phase6.py` (74 test functions) covers: compliance filter, pass reconciliation, fit-band thresholds, schemas, plan/status helpers, invite/start/decline logic, `on_graded` idempotency, scorecard content (no coaching leakage), grant query shape, decisions, revoke, integrity cap, appeals, retry, retention query, second-pass behaviour.

Weaknesses of what exists:
- Service tests use `MagicMock` sessions with canned query results (`test_interview_phase6.py` `_chain`/`_db`), so "someone else's invitation is not found" proves only that a `None` result raises; it does not prove the SQL tenant filter is correct. Some tests assert on source text (`inspect.getsource`, "TestGradingWiring") rather than behaviour.
- No HTTP-level test of `verified_router.py`; no role/permission tests; no cross-company or department-scope test; no real-DB test of grants, uniqueness races or purge.
- No LLM-failure/rate-limit scenarios, no test for the completeness cap against `fit_band` (which is why B1 exists), no test that a hardcoded-fallback interview is flagged.
- No frontend tests for the employer pages or room verified mode; no end-to-end/Playwright run; no test of Celery wiring.
- Docs claim "311+ unit tests... never run against real Postgres/Celery/Groq" (`ai-interview-engine-testing.md:3-5`); the DB confirms no verified data was ever created, so the manual checklist in section 5 of that doc is still unrun.

Missing tests worth adding first: B1 (cap vs band), tenant/department isolation via TestClient with two companies, concurrent start, grading failure and recovery, injection strings in `question_text`, plan-limit enforcement (once built).

---

## 10. Docs vs code

| Doc claim | Reality |
|---|---|
| Plan 1b: employer invites/share grants/scorecard "Missing" (`ai-interview-engine-plan.md:37`) | Now built (Phase 6 note at `:148-151`); the table was not updated (stale rather than wrong) |
| Plan 1c #7: `GET /interview/questions` unauthenticated | Now requires an aspirant and hides generated questions (`sessions.py:35-71`, `router.py:40-48`) |
| Plan 1c #5/#4: time limits and follow-up flag client-controlled | Partly fixed: `is_followup` is server-derived (`interaction.py:133`), response time clamped (`:48-57`); the question text remains client-controlled (B2) |
| Phase 6 "invitations tied to real applications" | True |
| Phase 6 "two independent scoring passes" | True, but temperatures differ and a failed pass 2 is silent (B18) |
| Phase 6 "enforced in the API layer" share-grant model | True for employer reads; department scope not honoured (B8) |
| Template lock: "assessed on the same questions" (`verified.py:165-168`) | False: questions are generated per candidate (B5) |
| Phase 6 "Not built: admin UI screens (API only)" | Accurate |
| Testing doc: model names "not verified" | STT/TTS/LLM model ids are config strings (`config.py:78-84`); no live verification of voice accuracy was found; `model_runs` shows 10 STT calls (all ok) and 26 TTS calls (25 ok) in dev |
| Testing doc section 6 "face detection / video not built" | Accurate; but the DB/API enum suggests otherwise (B20) |

---

## 11. Direct questions

**Can the AI conduct a meaningful first-round interview, versus generic questions plus a summary?**
Not yet. The interview is conversational (voice in/out, one capped follow-up per question, safety net), but the questions are LLM-written per candidate from a role string and competency names, with a fixed UPSC-story opener; the posting itself is never used and there are no employer-reviewed questions beyond up to three of their own. Scoring judges answer style (clarity/STAR) rather than role competence. Output is "generic questions + a fairly well-structured summary + evidence quotes", plus real safeguards. It can support a recruiter's judgement on communication and structure; it cannot reliably tell a technically strong from a technically weak candidate.

**Is evaluation consistent, job-relevant, explainable, useful for hiring decisions?**
- Consistent: no. Different questions per candidate, personalised context, unseeded sampling, regrading changes numbers, plus B1/B6 distortions.
- Job-relevant: weakly. Competency names steer question generation, but the scorer never sees them; one competency is a fixed non-job topic.
- Explainable: partly yes. Scores are code-computed from per-answer scores with a visible weighting, evidence quote per answer, disagreement flags and "needs human review". Missing: per-competency evidence, rubric/prompt/model versioning, override audit.
- Useful for decisions: as a triage aid with a human reading answers, yes; as a ranked shortlist, no (no compare/rank, uncalibrated bands, B1).

**Can an employer independently screen applicants for their own job openings today?**
Mechanically yes, for people who applied: create an interview, invite from the first 100 applicants, candidate completes it (if they notice the in-app notification), results appear only if grading succeeds and the candidate's consent is live, then record a decision. Practically it needs hand-holding: no email/reminders, no pipeline integration, candidate-triggered retry on grading failure, admin retry only via API/DB, single-provider LLM, and no end-to-end run has ever been recorded in this database.

**Is it suitable as a paid production service, and what blocks it?**
No. Blockers: (1) no entitlement/metering/billing (B3); (2) score integrity bugs and gaming vectors (B1, B2); (3) comparability/fairness (B4, B5, B9) before any hiring-decision use, plus legal review of retention/consent wording (noted by the project's own docs); (4) delivery and operations: email/reminders/expiry, self-healing grading, admin tooling, provider redundancy and cost monitoring per company (B7, B11, B13); (5) tenant scoping by department (B8); (6) evidence of real use: live pilot run, calibration against human raters, load/cost measurement.

---

## 12. Unknowns (could not verify)

- Real end-to-end behaviour: there are no verified interviews, invitations or templates in the Docker DB; I did not create any (instructions forbade writes). Frontend runtime in a browser was not exercised.
- STT/TTS accuracy for Indian accents, Hindi and Hinglish; Gemini TTS model availability (`gemini-3.8-*` ids are configuration strings I could not check against a live account).
- Production configuration: whether an Anthropic fallback key, Redis, a separate worker and persistent upload volume exist in production.
- Quality of the LLM-generated questions and scores against human raters (calibration data absent); whether Groq `gpt-oss-20b/120b` meets any quality bar; actual cost per interview in rupees (no pricing verified; counts above are code-derived estimates).
- Legal sufficiency of consent text, 180-day retention, and use of automated scoring in hiring under applicable Indian law.
- Whether a department-scoped user can actually hold the roles that reach these endpoints in production data (roles exist in `core/rbac.py:69`; no such users were checked).
- Behaviour under a worker crash mid-grading and under concurrent starts: reasoned from code only.
