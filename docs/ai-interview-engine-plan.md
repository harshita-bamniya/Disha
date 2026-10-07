# AI Interview Engine: blueprint verification and phased plan

Source: `Disha_AI_Interview_Engine_Blueprint.md` (team review, 25 Sep 2026), checked against the codebase on 2026-10-02.

## 1. Is the blueprint correct?

**Verdict:** the product thinking is sound and almost all of it is genuinely missing from the code. The blueprint is wrong about the stack it builds on and about parts of the current state, so it can't be executed literally.

### 1a. Where the blueprint doesn't match this repo

| Blueprint assumes | Reality in the codebase | Consequence |
|---|---|---|
| Next.js, Supabase (RLS, pgvector, pgmq, Storage) | Vite + React 19 frontend, FastAPI backend, Postgres via Alembic, Celery, JWT auth. | No RLS. Consent and share-grant enforcement must live in FastAPI services. Use plain Postgres tables and Celery instead of pgmq. Skip pgvector unless a real need appears. |
| Claude Haiku 4.5 live, Sonnet 5 grading | The provider layer is Groq `gpt-oss-120b` / `gpt-oss-20b`, with an Anthropic Haiku fallback only on 429/5xx. Gemini exists for other modules. | Reuse `create_provider()`. Making a Claude model the grader is a config and provider-routing choice, not a rewrite. |
| Real-time voice via LiveKit Agents, Sarvam, Deepgram | The backend has no STT, TTS, WebRTC or WebSocket code. The browser uses Web Speech API, hardcoded to `en-US`. The flow is turn-based REST. | This is the biggest gap. It is also the most expensive part, so it is phased last (see Phase 4). |
| "No resume upload needed; resume already structured" | True that Disha holds resume data (`session_setup` already pulls resume highlights and UPSC profile). The interview UI has no resume or JD-file input, only a pasted JD. | Replace the Internshala "upload PDF" with "use my Disha resume" and optional PDF. This also matches your screenshots. |
| Mock Interview exists and "promises 0-10 scores" | Per-answer scoring on a 0-10 scale and a 0-100 readiness report exist. Confidence is scored (`confidence_score`), which the blueprint says is invalid. | Remove or relabel the confidence score (see Phase 3). |
| Hotjar on interview routes | No Hotjar code was searched for. | Unverified. Check the analytics snippets before Phase 1. |
| Bolna as voice orchestrator | Not found in the backend. | Moot. |
| Vendor prices, ₹ cost per session, concurrency maths | I did not verify these. They are the document's own estimates. | Treat as planning figures. Build `model_runs` first, then measure. |

### 1b. Blueprint claims checked against code (backend)

| Blueprint item | Status | Evidence |
|---|---|---|
| Practice vs Verified modes, separate scores | **Missing.** Only `practice/timed/full_mock`, derived from question count. | `schemas.py`, `InterviewSetupPage.tsx:406` |
| Drill mode, quick/standard/full/stress | **Missing.** | No such types. |
| Hindi / Hinglish | **Missing.** Questions are hardcoded `language="en"`, and STT is `en-US`. | `session_setup.py:254` |
| Consent (recording, AI processing, sharing) | **Missing.** The candidate's burnout/confidence data goes to external LLMs with no consent step. | `session_setup.py:175` |
| Safety / crisis handling | **Missing.** `core/safety.py` exists but only the counsellor and companion use it. | |
| Tone flag, counsellor firewall | **Missing.** The interview reads `PsychologicalAssessment` directly. This is the opposite of the firewall. | `session_setup.py:175-178` |
| Integrity flags | **Partial.** Only post-hoc text heuristics (typing speed, repeats, pacing). No events table. | `core.py:258-321` |
| Evidence quotes | **Present** per answer, with substring verification. Missing at report level. | `feedback_ai.py:195` |
| Two-pass grading | **Partial.** The second pass only sets a `confidence_note`. The final score is not adjusted. | `dynamic_interview_engine.py` |
| Deterministic orchestrator | **Partial.** Question count is deterministic. Follow-up vs advance is decided by the LLM. Time limits are client-only. The blueprint's `difficulty_ramp` is never used. | `adaptive_interviewer.py`, `interaction.py:804` |
| Weighted rubric computed in code | **Missing.** Weights are shown to the LLM, which returns its own number. | |
| Appeals, employer invites, share grants, scorecard | **Missing.** Employer-side "interviews" are human scheduling, a separate system. | |
| Question bank with SME review, versions | **Basic.** Generated questions are dumped into the shared `question_banks` table with no review status or version. | |
| `model_runs` cost logging, audit versions | **Missing.** Token counts are available but never stored. No rubric, prompt or model version on reports. | `providers/groq.py:45-50` |
| Retention, deletion | **Missing.** No purge job, no delete endpoint. | |
| KRS write-back | **Missing.** Only roadmap skill competence and XP are updated. | `feedback.py:335-350` |
| Fair use | **Weak.** Free tier gets 3 lifetime uses. Premium is unlimited with no cap. The credit is consumed before generation succeeds. | `payments/service.py:151` |

### 1c. Bugs and risks found that the blueprint doesn't mention (fix regardless)

1. `POST /sessions/{id}/complete` is one synchronous request. For N answers it makes N scoring calls, 2N judge calls and 2 report calls. It can run for minutes and hit gateway timeouts. The session is marked completed before the LLM work, so a crash leaves a completed session with no feedback.
2. `session_type` and `total_questions` are not validated. A bad `session_type` returns a 500 from the DB CHECK.
3. `/respond` has no length validation, no check that `question_id` belongs to the session, and `sequence_num` can race on a double-submit.
4. `is_followup` is client-controlled, and the one-follow-up cap trusts it. Follow-ups also eat the question budget.
5. All time limits and the pacing/integrity flags rely on client-reported `response_time_sec`.
6. Prompt injection: `job_description`, `job_role` and resume text go into prompts unguarded. The adaptive interviewer and report transcript lack the `<candidate_answer>` guard that the scorer has.
7. `GET /interview/questions` has no auth and exposes every session's generated questions.
8. Fallback questions repeat when count is above 5.
9. Almost no tests: only `validate_response_text`.
10. A "completed" report can show a failed answer as 0. Failed reports default to score 0, "No Hire".

## 2. What the UI looks like now vs your reference

The target is the minimal dark flow from your screenshots:

1. **Setup:** one page. Role card, experience level (3 options), duration (2 options), optional resume, **Start new interview**.
2. **Instructions:** duration, 4 guidelines, a cheating-consent checkbox, **I'm ready to continue**.
3. **System check:** a checklist (internet, camera and mic, mic, speaker) next to a camera preview.
4. **Live room:** interviewer tile, candidate tile with a **Rec** badge, and a transcription panel below. An Exit button. Nothing else.

Current UI (`frontend/src/modules/interview/pages/`, 3,222 lines in total):

- **Setup:** a 4-step wizard with a navy sidebar stepper, 12 emoji role cards, 🌱🌿🌳🌲 experience cards, ⚡🎯🔬 length cards by question count, and a pasted-JD box. No resume option and no consent.
- **Lobby:** an extra dark page with a second device check, "Meet Alex", fake panel avatars, skill chips and tips.
- **Room (1,291 lines):** light theme, 🤖/🧠 gradient avatar with ripples and an orbiting dot, a right sidebar of Tips, Progress and Live Assessment scores, a gradient mic button and 12 keyframe animations.
- **Report:** emoji headlines ("🌟 Outstanding Performance!"), gradient hero, emoji sub-scores.
- **History:** duplicate duration cards and a gradient CTA.

There is no dark theme and no dark tokens. Most of these pages use inline styles with hardcoded hex.

## 3. Phased implementation plan

Order is chosen so each phase ships on its own, and the UI redesign (your explicit priority) goes first and does not depend on any backend work.

### Phase 0: Decisions (locked 2026-10-02)
- **Stack:** the blueprint's stack section (Next.js, Supabase, Claude-first) is not used. We build on the existing Vite/React + FastAPI + Postgres + Celery stack.
- **LLM:** stay on Groq, with Gemini as the other option. No Claude-as-grader for now.
- **Voice:** the owner wants real voice. Provider and cost are still being chosen (see Phase 4).
- **Avatar:** a placeholder avatar for now (no photo). Swap later.
- **Limits:** free users keep 3 AI interviews (existing `FREE_TIER_LIMIT`). The paid limit is decided later from measured cost, so Phase 2's `model_runs` logging comes before any paid cap.
- Scope of the first release: Practice only. Verified Interview (employer side) comes after Phase 5.

### Phase 1: UI redesign to the minimal flow (frontend only; about 1 week) — DONE 2026-10-02
Goal: make the existing backend feel like the reference. No backend changes except two optional fields noted below.

1. **Interview shell and dark tokens.** Add a dark palette (bg, surface, border, text, accent) to `design-system/tokens.ts` and as CSS variables, scoped to an `InterviewShell` wrapper with a slim header (logo left, Exit on room only). Do not add a global dark mode.
2. **Dark-capable primitives.** Add a `surface` / `tone` prop to `Card`, `Button`, `Checkbox` instead of forking components. Use Tailwind and tokens, not inline hex.
3. **Setup page, single screen.** Replace the wizard. Contents: Go back; title and subtitle; role card (role name, one-line description); experience level (Internship / Fresher / Experienced); duration (Quick 10 min, 4-5 questions; In-depth 20 min, 7-8 questions); optional resume (use my Disha resume, or PDF); **Start new interview**, disabled until choices are made. Remove emoji, the 12-role grid (role comes from the job or active prep context, with a plain select for custom), and the pasted-JD textarea (move behind a "Add job description" link).
4. **Instructions page.** Duration, 4 guidelines, a required checkbox: "I understand that cheating... will result in disqualification". The consent text must match what is actually enforced (see Phase 3), so keep the wording honest. Also state the recording and AI-processing statement truthfully (see Phase 3).
5. **System check page.** A checklist (internet speed, camera and mic access, microphone, speaker with Yes/Retry) beside a camera preview. This replaces both the setup step 3 and the whole lobby. Delete `InterviewLobbyPage` and its route, and redirect it.
6. **Live room.** Two equal tiles (interviewer, candidate with Rec badge only when something is really being recorded, otherwise no badge), and a single transcription panel below showing the current question and the live candidate transcript. Remove the right sidebar, live per-answer scores, tips, gradient mic button and the 12 keyframes. Keep a small speaking indicator (a thin accent border, as in the reference). Keep "type instead" as a quiet text link. Split the 1,291-line file into hooks (`useCamera`, `useVoiceInput`, `useAISpeech`) and small components.
7. **Report and history.** Remove emoji and gradients, use `PageHeader`, `Card`, `Badge`, `ScoreRing`. Neutral headlines, strengths first. History: a plain table, one "Start new interview" button.
8. **Routes.** Keep `/setup`, `/room/:id`, `/report/:id`, `/history`. Add `/instructions` and `/check`, or keep both as steps inside one route with a URL state. Redirect `/lobby`.

Exit criteria: the flow is 4 screens, no emoji or gradients in interview pages, one camera permission prompt instead of three, and it passes keyboard and screen-reader checks. Verify in the browser at desktop and mobile widths.

Note on "Rec": the room currently records nothing. Show the badge only after Phase 4b adds real recording. Until then, no badge, so we don't claim something false.

### Phase 2: Backend foundation and bug fixes (about 1-1.5 weeks; can run in parallel with Phase 1) — DONE 2026-10-02 except as noted

Built: request validation; row-locked, duplicate-safe `/respond` with server-derived follow-up flag and server-capped answer time; ownership check on `question_id`; `/complete` returns instantly and grading runs in a Celery task (`grade_interview_session`, with an in-process fallback if the broker is down), with `grading_status` + `POST /regrade` and report-page polling; free credit is checked before and spent after session creation; `model_runs` table logging every interview LLM call; untrusted-text fencing in all interview prompts; `/interview/questions` needs login and hides session-private questions; 55 unit tests.
Not done here: hard per-answer/section time limits (moved to the Phase 3 orchestrator), and a live end-to-end run against Postgres/Celery (no database was available when this was built; the migration `z5a6b7c8d9e0` has not been applied anywhere yet).

1. Validate `session_type`, `total_questions` and `response_text` (Pydantic). Verify `question_id` belongs to the session. Make `/respond` idempotent and race-safe on `sequence_num`. Make `is_followup` server-derived.
2. Move grading out of the request: `/complete` marks `completing`, enqueues a Celery task, and the client polls status. The session becomes `completed` only after the report exists. Add an `abandoned` sweep.
3. Move the quota consumption after successful creation (or refund on failure). Add a per-week premium cap.
4. Add `model_runs` (purpose, model, prompt hash, tokens in/out, latency, cost) and log every interview LLM call. Store `rubric_version`, `model` and `prompt_version` on the report.
5. Wrap the adaptive-interviewer prompt and report transcript with the untrusted-content guard. Require auth on `/interview/questions` or remove it.
6. Add server-side time enforcement (per-answer maximum, section budget) and compute pacing from server timestamps.
7. Tests for decision logic, the completeness cap, scoring clamps, router validation and the Celery flow.

Exit criteria: no 500s from bad input, `/complete` returns in under a second, every call appears in `model_runs`, tests are green in CI.

### Phase 3: Orchestrator, rubric, safety and consent (about 2 weeks) — DONE 2026-10-02

Built: code-driven flow (`interview/policy.py`: probe caps, time limits, difficulty ramp; the model only suggests); weighted score and recommendation computed in code (`interview/scoring.py`) with the model's own estimate kept for audit; report rules (≤3 strengths/gaps, growth wording, confidence removed, coaching-only delivery signals); consent ledger; counsellor firewall (one-way `gentle|standard` tone flag); safety net (first-person crisis halt, distress break offer) with `interview_safety_events` and an admin list; delete-interview endpoint. Not built: auto-purge of practice transcripts (retention policy undecided); soft integrity events are in Phase 6.
1. **Deterministic orchestrator.** A state machine in code (ASK, LISTEN, ASSESS, PROBE, ADVANCE, CLOSE) with follow-up caps, minimum and maximum seconds, and section budgets, as in blueprint C4. The LLM only phrases questions and scores answers. Actually use the blueprint's `difficulty_ramp`.
2. **Weighted rubric in code.** Per-competency scores from the model, the weighted overall computed by code, with evidence required per score. Version the rubric. Report-level quotes.
3. **Real two-pass grading.** If two passes differ by a set margin, adjudicate (a third pass or flag "needs human review") instead of only adding a note. The existing admin calibration page becomes the review console.
4. **Report rules.** Cap gaps at 3, strengths first, banned wording (a validator). Remove or relabel the `confidence_score`. Report "delivery" from objective signals only (filler rate, pace). Never score accent or pronunciation.
5. **Consent ledger.** `consents` table (media, AI processing, product improvement), recorded on the instructions page, with withdrawal. Update the consent text to what really happens.
6. **Counsellor firewall.** Stop reading `PsychologicalAssessment` in the interview. Pass only a `tone` flag (gentle or standard) from the counsellor side.
7. **Safety net.** Reuse `core/safety.py` on every candidate turn. On a crisis hit, stop scoring, show a pre-written message with helplines, and alert the human team, mirroring the counsellor protocol. Distress without crisis offers a break and is excluded from scoring.
8. **Retention and deletion.** A delete-session endpoint, a purge task (default windows from the blueprint, to be confirmed by counsel), and no use of interview data for training.
9. **Integrity events.** A table for soft flags (tab switches, face presence) sent from the client as timestamps only, shown to the candidate and never used to lower the score. Do this only if the consent wording from step 5 covers it.

### Phase 4: Voice and language (about 3-4 weeks; the expensive phase) — DONE 2026-10-02 (4a, 4b); 4c not built

Built: English / Hindi / Hinglish throughout; server speech-to-text (Groq Whisper, Gemini fallback) and text-to-speech (Gemini) with browser fallback and automatic silence detection; opt-in answer audio with 30-day purge and a truthful "Rec" badge. Model names are configurable and unverified against live accounts. Not built: video recording, LiveKit.
- **4a. Turn-based server voice, limited to Groq and Gemini.** Candidate audio is recorded in the browser with `MediaRecorder`, sent per turn to a new STT endpoint, transcript returned. Candidate options, to be confirmed against current vendor pricing and limits before building: speech-to-text with Groq Whisper (we already hold a Groq key) or Gemini audio input; text-to-speech with Gemini TTS, or the browser voice as a free fallback. Add a language option (English / Hindi / Hinglish) and Hindi question text. Run a short bake-off on real Hindi/Hinglish audio first, and pick from the data. Dedicated Indian-language vendors (Sarvam, Deepgram) are out of scope unless the bake-off shows Groq/Gemini are not good enough.
- **4b. Recording.** Store the audio or video track with the transcript and a timestamp index. Only then show the Rec badge. Requires the consent from Phase 3.
- **4c. (Optional, later) Real-time streaming with LiveKit.** Only if turn-based latency feels wrong in pilots. This is a large addition: a media server, an agent worker and a new deployment. The blueprint estimates this could be done on a small fleet, but that is not verified here.

### Phase 5: Drill mode, session types and practice features (about 2 weeks) — DONE 2026-10-02, with gaps

Built: drills (one question, instant feedback, retry the same question, daily cap, no credit/XP), stress mode with unlock rules, the career-transition question and its own rubric, an improvement trend on the history page. Not built: reviewed/versioned question bank (needs SME content), KRS write-back (needs a product decision on the formula).
- Drill: one question, voice note or text, one evaluation, immediate retry. This is the cheapest way to offer "unlimited" practice.
- Session types (quick, standard, full, stress) as blueprint modes, with the unlock rules for stress.
- Interview blueprints per role: a reviewed question bank with status, version and difficulty. Seed the first roles with SME review. Stop dumping generated questions into the shared bank.
- Career-transition question set and rubric (the blueprint's unique competency).
- KRS write-back from competency scores. Improvement tracker across sessions.

### Phase 6: Verified Interview for employers (about 6-8 weeks; after first placements) — DONE 2026-10-02 as a first version

Built: employer interview templates with a compliance filter, invitations tied to real applications, one attempt per invitation, consent-gated share grants (expiring, revocable), two independent scoring passes with human-review flagging, fit bands, evidence-linked scorecard with no coaching content, human decisions with reason codes, soft tab/window integrity observations (shown to both sides), candidate appeals and admin resolution, admin-granted retry, 180-day auto-delete. Not built: face detection, video, admin UI screens (API only), push alerts. See `ai-interview-engine-testing.md`.
Employer blueprint editor with a compliance filter on custom questions, invitations, one attempt, the share-grant model (with expiry and revocation) enforced in the API layer, scorecard with evidence and bands, soft integrity notes, decisions with reason codes, appeals, and a human-audit sample. Candidates see the same scorecard. This reuses the Phase 3 orchestrator, two-pass grading and consent ledger.

## 4. Suggested sequence and sizing

| Phase | What | Rough effort | Depends on |
|---|---|---|---|
| 0 | Decisions | 1 day | none |
| 1 | UI redesign | ~1 week | none |
| 2 | Backend fixes, async grading, cost logging | ~1-1.5 weeks | none (parallel with 1) |
| 3 | Orchestrator, rubric, safety, consent | ~2 weeks | 2 |
| 4 | Server voice, Hindi, recording | ~3-4 weeks | 3 (consent) |
| 5 | Drills, modes, question bank | ~2 weeks | 3 |
| 6 | Employer Verified Interview | ~6-8 weeks | 3, 4, 5 and real pilot data |

Effort figures are rough estimates for one engineer and have not been validated.

## 5. Things I could not verify
- Vendor pricing, latency numbers and concurrency maths in the blueprint.
- That Sarvam or Deepgram handle your domain terms well. That is what the bake-off is for.
- Legal requirements for recording and retention. These need counsel.
- Whether Hotjar or other session replay runs on interview routes.
