# AI Interviewer (Employer): product requirements

Status: proposal for review, 2026-10-10. No application code has been changed.
Companion docs: `AI_INTERVIEWER_CURRENT_STATE_AUDIT.md` (cited as **Audit B#** / **Audit §**), `AI_INTERVIEWER_INDUSTRY_RESEARCH.md` (cited as **Research §**).

**Traceability tags** used on every requirement: `[Code]` observed problem in our repo (Audit ref), `[Research]` external evidence (Research ref), `[Decision]` product/engineering recommendation that the owner must approve, `[Assumption]` needs validation.

---

## 1. Product statement

Employers post a job, applicants apply, and the employer can run an AI-conducted **structured first-round screen** for that job without a recruiter interviewing each person. The system produces an **evidence-linked scorecard per competency** and a **recommendation for human review**; the recruiter makes every decision. `[Decision]`

Principles `[Decision]`, each backed by research or audit:
1. **Same questions, same rubric for every candidate of a job.** Structured interviews are the best-supported method (Research §1.2); today questions differ per candidate (Audit B5).
2. **Score content only.** No face, voice-emotion, accent or personality inference (Research §7; EU AI Act Art. 5(1)(f)).
3. **Never auto-reject.** Output is a recommendation; every decision is human and logged (Research §4, GDPR Art. 22 / EU AI Act high-risk).
4. **Insufficient evidence is a result, not a low score.** (Audit B1, B6, B10.)
5. **Paid feature with hard cost controls.** (Audit B3.)

Primary persona: a recruiter/hiring manager at a small or mid-size Indian employer hiring for policy, public-affairs, research, CSR, ed-tech, governance and similar roles (Research §6), with no ML or HR-tech expertise.

---

## 2. Employer workflow

### A. Interview creation ("Set up screening for this job")

Entry point: from the job (My Jobs -> job -> **AI screening** tab) and from AI Interviews -> New. Both create a template bound to a job. `[Code]` today templates are standalone and the posting is never used (Audit §3 row 4, B22).

| ID | Requirement | Tag |
|---|---|---|
| A1 | Template must reference one of the employer's own jobs (validated server-side, same department scope as applications). A "general screen" without a job is allowed only as an explicit, labelled option. | Code B22 |
| A2 | On selecting a job, prefill title, responsibilities, required skills, seniority and experience from the posting. Employer can edit; the snapshot is stored on the template version, so later edits to the posting do not silently change an open screen. | Decision |
| A3 | **Competency builder**: AI proposes 4-6 competencies from the JD (reuse `ai/dynamic_interview_engine.py` suggestion, Audit §3 row 2); employer edits names, weights, and flags each as **must-have** or **nice-to-have**. Separate **objective requirements** (e.g. "has 3+ years policy research", "available in Delhi") from **competencies** (judged from answers). Objective requirements are asked as knock-out *information* questions and shown as "unverified" until a recruiter confirms; they never feed the AI score. | Decision; Research §5 |
| A4 | **Question set generated once, then reviewed.** AI drafts 1-2 questions per competency (behavioural, situational, and where relevant job-knowledge). The employer sees each question with: competency, what a strong/weak answer looks like (rubric anchors), expected duration. Employer can edit, delete, reorder, add up to N own questions (existing discrimination filter applies, Audit §3 row 3). **The interview cannot be published until the employer approves the set.** | Code B5; Research §5 |
| A5 | Optional **question template library** (employer's saved sets, plus curated starter sets per common role family). Later release. | Decision |
| A6 | **Rubric per competency**, behaviourally anchored 1-5, AI-drafted, employer-editable (see Evaluation Framework §3). Default is shown collapsed; editing is optional ("advanced"). | Decision |
| A7 | Settings with defaults: mode (text, or voice-in with transcript review; default text+voice allowed), duration 15 min (10-20), question count derived from duration, language (English, Hindi, Hinglish), deadline 7 days, retake policy "none; one technical-failure retry", follow-ups on/off (default on, max one per question, Audit §3 row 16), candidate instructions (prefilled, editable). | Code B19; Decision |
| A8 | **Preview/test run**: employer can take the interview themselves (not billed, not stored as a candidate result). | Decision |
| A9 | **Versioning**: publish creates an immutable template version (questions, rubric, competencies, JD snapshot, prompt/model versions in force). Editing after invitations exist creates a new version; existing candidates stay on theirs. | Code (template has no version, Audit §4) |
| A10 | The "civil-services transition story" question and competency become **optional per template**, default off. | Code B9 |
| A11 | Interview mode in MVP: **text and audio-answer (STT to a transcript the candidate confirms)**. Live voice conversation and video are out of MVP. | Decision; see Architecture §6 |

### B. Candidate selection and invitations

| ID | Requirement | Tag |
|---|---|---|
| B1 | Invite from the job's applicant list: single, multi-select, and "all unscreened". Applicant list gets an **AI screening status column** (not invited / invited / started / completed / expired / declined / needs attention) and a sortable score column. | Code B21 |
| B2 | **Auto-invite rule (optional, per job, off by default)**: on application submission, invite if the application meets employer-defined objective criteria (e.g. required info answered, location). Candidate consent still happens on the invitation page; nothing is scored before consent. Cap per day and cap per plan quota. | Decision; Research §8 |
| B3 | **Invitation by email and in-app** (existing Brevo SMTP + notification, Audit B11) with a secure expiring link bound to the candidate account. Reminders at 48h and 24h before expiry (configurable, max 2). Resend and cancel by employer. Completion notifications to the inviting user and optionally the job's hiring team. | Code B11 |
| B4 | Invitation lifecycle states stored, not computed: `invited, opened, consented, started, submitted, scoring, scored, scoring_delayed, expired, abandoned, declined, cancelled, withdrawn_by_candidate`. A nightly sweeper moves `invited` past deadline to `expired`, and `started` with no activity for 24h to `abandoned` (candidate may resume until the deadline). | Code B11, §3 row 8 |
| B5 | **Duplicate protection**: one invitation per (template version family, application). Re-invite requires cancel or an explicit retake grant. Concurrent invite/start must not 500 or create orphan sessions. | Code B12 |
| B6 | **Retakes**: policy per template: none (default), one technical-failure retake (automatic when the system, not the candidate, caused the failure), or employer-granted retake (reason logged). Old attempt stays in history; the scorecard shows the attempt in force. | Code §3 row 11 |
| B7 | **Accommodation/alternative**: candidate can request an extension, alternative format (text vs audio) or a human interview from the invitation page; request goes to the employer with a status and is logged. Extra time is granted without penalty. | Research §7 |
| B8 | Pipeline integration: a decision on the scorecard can move the application stage (shortlisted / on hold / declined) with the same audit rules as the existing application pipeline; the employer chooses whether it also notifies the candidate. Nothing moves automatically. | Code §3 row 28 |

### C. Candidate experience

The candidate pages exist (Invitation, Instructions, Device check, Room, Report; Audit §2). Required changes:

| ID | Requirement | Tag |
|---|---|---|
| C1 | **Notice screen** states plainly: the employer and job; that an AI asks the questions and scores the answers against a rubric; that **a human at the employer decides**; what is collected (answers, transcript, optional audio; no face/voice-emotion analysis); who sees it (that employer's hiring team); retention period; the grievance/DPO contact; how to request an accommodation or a human alternative. Consent is **per purpose**, withdrawable, logged with text version (extend the existing ledger, Audit §3 row 12). | Code (good base); Research §8 DPDP |
| C2 | Remove claims the product cannot back. Today the page says questions "aren't shown in advance" while the full list is sent to the browser at start, and "the employer sees the same scorecard" while they do not (Audit B2, B25). Serve **one question at a time**, server-side. | Code B2, B25 |
| C3 | Show total time, number of questions, and a progress indicator; enforce the template duration with a visible timer and server-side cut-off; one practice question that is never scored. | Code B19 |
| C4 | Answers: text (min length shown as guidance, not a silent score penalty) or audio with transcript the candidate can correct before submitting, and the original ASR text kept alongside the edited text. | Code B16 |
| C5 | **Follow-ups** only from a constrained, job-relevant set: the model may choose from approved probe types (clarify a vague claim, ask for a concrete example, ask for the candidate's own role) tied to the same competency; max one per question; the issued follow-up is persisted server-side with an id. No questions about protected characteristics, family, health, religion, caste, etc. (existing filter extended to generated follow-ups). | Code B2, §3 row 16; Research §7 |
| C6 | **Interruption handling**: autosave each submitted answer; resume exactly at the same question (follow-up not re-rolled); heartbeat to distinguish a dropped connection from abandonment; if a **system fault** (STT/LLM outage) interrupts, the candidate is not penalised and gets a free resume or retake. | Code §6(9), B7 |
| C7 | After submission: a receipt, expected timeline ("the employer will contact you if you move forward"), the candidate's own copy of their answers and the questions asked, and the ability to withdraw consent/request deletion and to appeal (appeals must reach the employer and change the record, Audit B13). Candidate-facing score feedback is a later option (Research §6, Sapia). | Code B13 |
| C8 | Languages: English and Hindi in MVP; Hinglish where STT quality is verified (accuracy is currently unverified, Audit §12). Typed answers are always available. | Research §7 ASR bias |

---

## 3. Recruiter results and shortlisting

| ID | Requirement | Tag |
|---|---|---|
| R1 | **Job-level screening dashboard**: funnel (invited -> consented -> started -> submitted -> scored), completion rate, median time to complete, expired/abandoned, pending human review. | Decision |
| R2 | **Compare view**: candidates for one job in a table with one column per competency, overall recommendation category, completeness, must-have status, flags; sortable and filterable; click-through to evidence. Every candidate is on the same questions and rubric, shown at the top. | Code §3 row 28 |
| R3 | **Scorecard** (detail in Evaluation Framework §6): per-competency score with the evidence quotes **and a link to the exact answer segment**, strengths, evidence gaps, answers needing human review, unverified requirements, completion status and technical issues, and a plain-language reason for the recommendation. | Code §3 row 25 |
| R4 | **Recommendation categories** (configurable labels, fixed semantics): *Recommended for recruiter review*; *Needs clarification or additional assessment*; *Not currently recommended against the stated criteria*; *Insufficient evidence to assess*. No "hire / no hire" wording; no single universal pass mark. | Decision; Research §4 |
| R5 | **Human override**: recruiter can adjust any competency score or the recommendation with a reason; originals are preserved; every change is attributed, timestamped and shown in history. Decision history is kept per user (no silent overwrite). | Code B14, §3 row 29 |
| R6 | **Completeness is explicit**: "answered 7 of 7", "3 of 7 (incomplete)". Incomplete interviews cannot receive a recommendation stronger than "Insufficient evidence". | Code B1, B10 |
| R7 | **Quality flags** surfaced: any answer scored by fallback, two scoring passes disagreeing, low transcript confidence, very short answers, possible copy-paste/similarity across candidates, integrity observations (tab changes), and "scoring delayed". Flags are advisory and never reduce a score by themselves. | Code B18, B26 |
| R8 | Department scoping for all reads (templates, invitations, results, audio) matches the job's department. | Code B8 |
| R9 | Export a candidate scorecard (PDF) and a job-level CSV with the model/rubric version. | Research §5 |
| R10 | Candidate appeals appear on the scorecard as an open flag until a recruiter or admin resolves them. | Code B13 |

---

## 4. Plan, usage and billing visibility

| ID | Requirement | Tag |
|---|---|---|
| P1 | Interviews are metered per **completed and scored** interview (see Commercial Model). The employer sees included quota, used, remaining, reset date, and an estimate before inviting ("25 invitations will reserve up to 25 interviews"). | Code B3 |
| P2 | Quota is checked at invite time (soft) and consumed at scoring completion (hard). Failed or system-caused unscorable interviews are not charged. | Decision |
| P3 | Hard caps and rate limits per company per day, and an admin kill switch, so a bug or abuse cannot run up LLM spend. | Code B17 |
| P4 | Admin screens: per-company usage and cost, failed gradings with retry, appeal queue, invitation lookup. | Code §3 row 34 |

---

## 5. Non-functional requirements

- **Reliability**: grading is retried automatically (bounded), survives worker restarts, and the employer sees a "scoring delayed" state rather than silence (Audit B7). Target: 95% of submitted interviews scored within 10 minutes, 99% within 60 `[Assumption]`.
- **Security/tenancy**: every endpoint authorises by company and department with tests that use two companies (Audit §9).
- **Privacy**: per-purpose consent, retention timers by data class, deletion on request, minimum PII to LLMs (pseudonymous candidate id; no name/phone/email in prompts), paid-tier provider with DPA (Research §9).
- **Accessibility**: keyboard and screen-reader support on candidate pages, captions/transcripts, adjustable time, WCAG 2.1 AA as the target `[Decision]`.
- **Auditability**: every score is reproducible to a stored prompt version, model id, rubric version and input; every human change is logged.
- **Cost**: per-interview cost recorded in a usage ledger (Architecture §4).

## 6. Must-have for launch versus later

**Launch (paid, general availability):** A1-A4, A6-A10, B1, B3-B6, B8, C1-C6, R2-R8, P1-P4, plus the Phase A fixes in the roadmap (B1, B2, B3 of the audit).
**Soon after:** A5 template library, B2 auto-invite, B7 accommodation workflow, R9 export, C7 candidate feedback, C8 Hinglish.
**Later:** live voice conversation, ATS connectors, code/case simulations, identity verification, multilingual beyond Hindi, adverse-impact dashboard automation.

## 7. Open decisions for the owner

1. Is the first paying segment small employers on the existing `standard`/`premium` plans, or enterprise? (affects quota design)
2. MVP modality: text + audio-answer only (recommended), or invest in live voice now?
3. Do we keep the candidate-facing practice product's context (resume/KRS) out of employer interviews entirely? (Recommended yes; Audit B5.)
4. Which jurisdictions do we sell to in year one? India only changes the legal workload a great deal (Research §8).
5. Who is the DPO/grievance contact shown on the notice?
