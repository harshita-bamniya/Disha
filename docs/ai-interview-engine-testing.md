# AI interview engine: setup and end-to-end test checklist

Everything below was built and unit-tested without a database, a camera, or live AI keys (Docker was not running).
So: **311+ unit tests pass, but nothing here has been run against real Postgres, Celery, Groq or Gemini.**
This is the checklist for that first real run.

## 1. Set up

1. Apply the migrations (five new ones, in this order; `alembic upgrade head` does all of them):
   `z5a6b7c8d9e0` (async grading, `model_runs`) → `a6b7c8d9e0f1` (consents, safety events) →
   `b7c8d9e0f1a2` (language, media consent) → `c8d9e0f1a2b3` (drill/stress types) → `d9e0f1a2b3c4` (Verified Interview).
2. Environment (`.env`). Voice works with these; without them the room falls back to the browser's speech:
   - `GROQ_API_KEY`: question/answer scoring and speech-to-text (Whisper).
   - `GEMINI_API_KEY`: the interviewer's voice (Gemini TTS) and speech-to-text fallback.
   - Optional overrides: `INTERVIEW_STT_GROQ_MODEL`, `INTERVIEW_TTS_GEMINI_MODEL`, `INTERVIEW_TTS_VOICE`,
     `INTERVIEW_MAX_AUDIO_MB`, `INTERVIEW_AUDIO_RETENTION_DAYS` (30), `VERIFIED_INTERVIEW_RETENTION_DAYS` (180).
   - **The model names are my best knowledge, not verified against your accounts.** If voice fails, check these first.
3. Run the Celery worker **and** beat. Grading runs in the worker (`grade_interview_session`); if Redis is down, the
   API grades in-process instead. Beat runs the two retention jobs.
4. Run the unit tests without the Postgres-backed fixtures: `pytest --noconftest tests/test_interview_phase*.py`.

## 2. Practice interview (the main flow)

| Check | Expected |
|---|---|
| Setup → instructions → system check → room | Four plain screens, dark, no emoji; consent checkbox required |
| Free user, 4th interview | Blocked with the upgrade message; the 3rd still works; a failed check never spends a credit |
| First question | The career-transition question (in the chosen language), not "tell me about yourself" |
| Questions get harder over the session | Easy → hard, never random |
| One follow-up at most per question; "Question x of N" doesn't jump on follow-ups | |
| Say "I want to kill myself" in an answer | Interview stops, helplines shown, session abandoned, **no score**; a row appears in `interview_safety_events` and at `GET /api/admin/interview-safety-events` |
| Say "I can't do this anymore" | Gentle "take a break" banner; that answer is not scored |
| Finish | `/complete` returns instantly; report page says "Preparing your report" then shows it |
| Report | Score is the same every time you re-open it; no "Confidence" tile; "Delivery" section; ≤3 strengths/gaps; no "weak/failed" wording |
| Kill the worker mid-grading | After 15 min the page offers "Try again" (`/regrade`) |
| `model_runs` | One row per LLM/STT/TTS call; sum tokens per interview to size your paid plan |

## 3. Voice and language

- Setup → Hindi or Hinglish: questions, feedback and report come back in that language.
- With keys set: tap the mic, speak, stop talking for ~2.5 s → it stops itself and fills in the text.
  Check Hindi, Hinglish and an English answer with Indian domain terms. **Judge accuracy yourself; this is where I'd expect surprises.**
- Interviewer voice: first greeting should be served by the server voice; the same sentence a second time is instant (cached).
- Remove the keys: the room should still work using the browser's speech (Chrome/Edge).
- Tick "keep a recording": "Rec" badge appears; files land in `uploads/interview_audio/<session>/`; deleting the interview deletes them.

## 4. Drills and stress

- `/app/interview/drill`: one question → answer → feedback → "Try this question again" gives the **same** question.
  A drill must not use one of the 3 free interviews and must not award XP. 10 drills/day free, 30 premium.
- Stress is locked until 3 completed regular interviews; it should say it isn't available (no reason given) the day after a
  safety event or when the counsellor-side flag is "gentle".

## 5. Verified Interview (employer → candidate → employer)

1. Employer: **AI Interviews → Interviews → New interview**. Try "Suggest from role", then add the question
   "Are you married?" → must be refused with the reason. Save a clean one.
2. Employer: **Invite candidates** → pick the interview → invite someone who applied to one of your jobs.
   A non-applicant must not be invitable. Inviting twice must fail.
3. Candidate: gets an inbox notification → invitation page shows who sees what, for how long, one attempt.
   Starting needs both the AI-processing and employer-sharing boxes ticked.
4. Candidate takes it. Switch tabs a couple of times (noted, never scored). Finish.
5. Employer: result appears **only after grading**, with a fit band (never "weak"), per-answer evidence quotes, integrity
   observations, and **no coaching content**. Record a decision.
6. Candidate: report shows the same scorecard; **Withdraw employer access** → employer now gets 403 on the result.
7. Candidate: file an appeal → admin `GET /api/admin/interview-appeals` → resolve it → candidate sees the outcome.
8. Admin: `POST /api/admin/interview-invitations/{id}/allow-retry` re-opens the invitation once and withdraws the old result.
9. A verified answer scored by two passes that differ by more than 2 points should show "Scoring passes differed" and
   the band "Needs human review".

## 6. Things that are NOT built (decide or schedule)

- **KRS write-back.** KRS is computed only from profile fields today; feeding interview scores in changes a core product metric, so it needs your formula.
- **Reviewed question bank / SME authoring.** The infrastructure for versioned, expert-reviewed questions was not built (needs content and reviewers). Questions are still generated per session.
- **Real-time streaming (LiveKit).** Voice is turn-based with automatic silence detection. Add LiveKit only if the pause feels wrong in pilots.
- **Video recording** and **face-presence detection** (MediaPipe). Only tab/window events and opt-in *audio* exist.
- **Admin screens** for appeals and safety events (API only), and **push alerts** to a human on a crisis signal (it is logged and queryable, not pushed).
- **Auto-delete of practice transcripts** (they stay until the user deletes them). Verified interviews (180 days), answer audio (30 days) and speech cache are auto-purged.
- **Calibration against human raters** (golden set, bias probes) is a process, not code. The admin calibration page exists; run it before relying on verified bands.
- Retention periods and consent wording need legal review.

## 7. Known unrelated failure

`tests/test_krs_scoring.py::TestKScore::test_interview_cleared_highest` fails in code that was already modified in your working tree before this work (`app/modules/krs/scoring.py` receives a mock where it expects an int). Not touched by this work.
