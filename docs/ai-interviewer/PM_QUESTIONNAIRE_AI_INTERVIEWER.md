# AI Interviewer: questions for the Product Manager

Prepared 2026-10-10. Goal: get exact answers so engineering can build a **production-grade AI interviewer that we sell to employers**, without guessing. Companion documents: `AI_INTERVIEWER_CURRENT_STATE_AUDIT.md`, `AI_INTERVIEWER_PRODUCT_REQUIREMENTS.md`, `AI_INTERVIEWER_TECHNICAL_ARCHITECTURE.md`, `AI_INTERVIEWER_EVALUATION_FRAMEWORK.md`, `AI_INTERVIEWER_COMMERCIAL_MODEL.md`, `FREE_AI_PROVIDER_OPTIONS_RESEARCH.md`. Plans and prices are in a separate document: `PM_QUESTIONNAIRE_SUBSCRIPTION_MODEL.md`.

**How to use.** Each question has context, a recommended default and an `Answer:` line. "Agree" is a valid answer. **BLOCKER** = engineering cannot proceed on that area without it. Items marked **LEGAL** need a lawyer, not just a product decision.

## 0. What is already built (so you do not have to decide it again)
Verified today (code and tests): employer templates with weighted competencies, up to 3 own questions with a discrimination filter, invitations tied to applications, candidate consent, one attempt per invitation, share grants the candidate can revoke, two-pass scoring with scores computed in code, verbatim evidence quotes, employer decision (shortlist/hold/decline), appeals, 180-day deletion. Fixed this week: an incomplete interview can no longer show "Strong fit", and the candidate can no longer choose the question being scored.
Not built or not good enough yet (the audit lists these): job-specific questions and rubric (the scorer ignores the job today), same questions for every candidate, email invitations and reminders, plan limits and billing, comparison view, score override with history, admin screens, a second AI provider, real end-to-end use (no real interview has been run yet).

---

## 1. Section 1: AI model and provider decision (BLOCKER, your partner and you are deciding this now)

### 1.1 What the choice affects
Candidate answers are personal data used in hiring. The provider decides: **cost per interview, scoring quality, whether candidate data may be used to train the provider's models, where data is processed, how often we hit rate limits, and whether we can legally use the free tier with real candidates.** See `FREE_AI_PROVIDER_OPTIONS_RESEARCH.md` for the sourced numbers; the summary is in section 6 below.

### 1.2 Questions

**1.2.1 Will we process real candidate data on a free tier at any stage?**
The research found that free tiers generally come with low daily caps, and some free tiers allow the provider to use your data to improve products or have humans read it. That is not acceptable for real candidates.
Recommended: free tiers only for development with synthetic data. Real candidates only on a paid tier with a signed data-processing agreement (DPA) and a no-training clause.
Answer:

**1.2.2 Which provider(s) do we use for production, and which is the fallback?** We need two so one outage or rate limit does not stop interviews.
Recommended: one primary paid provider and one different-provider fallback, chosen after a quality test on 60-100 sample answers (see 4.3).
Answer:

**1.2.3 Is data location a requirement?** (Must candidate data stay in India? Is processing in the US/EU acceptable with consent?) DPDP cross-border rules and enterprise customers may require it. **LEGAL**
Answer:

**1.2.4 Quality bar and language.** Which languages must interviews work in at launch: English only, English + Hindi, + Hinglish, + other Indian languages? Speech-to-text accuracy for Indian accents, Hindi and Hinglish is unverified today.
Recommended: English + Hindi at launch, typed answers always allowed, Hinglish after accuracy is measured.
Answer:

**1.2.5 Monthly AI budget.** What is the maximum we are willing to spend on AI per month in the pilot and in the first year? We will build a hard spending cap from this number.
Answer:

**1.2.6 Self-hosting.** Do we want the option of running an open model on our own servers (more privacy and predictable cost, but GPU cost and engineering time)? Recommended: not now; revisit if volume exceeds roughly 10,000 interviews per month or a customer requires it.
Answer:

**1.2.7 Who owns the provider accounts, API keys and billing?** (Company account, not a personal one. Keys go into the server environment file, never into chat or code.)
Answer:

**1.2.8 Is the existing Groq/Gemini free-tier setup to be kept for the practice product (aspirants)?** The employer feature will not share keys with it.
Answer:

---

## 2. Section 2: Product scope (BLOCKER for build order)

**2.1 First release modality.** Options: (a) text answers only, (b) text + audio answers converted to text (recommended), (c) live voice conversation, (d) video.
Why: (b) is already mostly built and cheap (cents per interview). (c) costs about Rs 90-260 per interview in provider fees alone and is much harder to make fair and reliable. (d) has no evidence that it predicts job performance and creates legal risk in several jurisdictions; we recommend not building it.
Answer:

**2.2 Do we ever score anything other than the content of answers?** Facial expression, eye contact, tone of voice, accent, emotion, "personality": recommended **never** (no validated link to job performance; banned or restricted in some laws).
Answer:

**2.3 Same questions for everyone.** The employer approves one question set per job and every candidate gets exactly that (recommended). Today every candidate gets different AI-written questions. OK to change?
Answer:

**2.4 How much control do employers get?** (a) one-click with AI defaults, (b) edit questions and rubric (recommended: both, defaults hidden behind "advanced"), (c) full custom question banks.
Answer:

**2.5 Never auto-reject?** The AI only recommends; a human decides and the decision is logged (recommended). Confirm we will not offer automatic rejection.
Answer:

**2.6 Recommendation labels.** Proposed four: "Recommended for recruiter review", "Needs clarification or additional assessment", "Not currently recommended against the stated criteria", "Insufficient evidence to assess". We avoid "hire / no hire". Approve the wording?
Answer:

**2.7 Interview length and number of questions.** Default 15 minutes, 5-8 questions, range 10-20. Follow-ups: at most one per question. OK?
Answer:

**2.8 Candidate retakes.** Proposed: none by default; one automatic retake only if our system failed; employer can grant more. OK?
Answer:

**2.9 Invitation deadline.** Default 7 days (1-30). Reminders at 2 days and 1 day before expiry. OK?
Answer:

**2.10 Who may invite?** Only candidates who applied to the employer's job (today), or also people from the talent pool or an uploaded list? (Recommended: applicants only at launch.)
Answer:

**2.11 Auto-invite after applying.** Optional per job, off by default, premium plans only. OK?
Answer:

**2.12 Does a decision change the application stage automatically?** (Recommended: the employer chooses per decision; nothing moves automatically.)
Answer:

**2.13 Should the candidate see their own result or feedback?** Options: nothing; a receipt only (recommended at launch); feedback report later. Candidate feedback reduces drop-off but needs care.
Answer:

**2.14 Civil-services-specific roles.** Do we want curated question packs and rubrics for roles our users target (policy analyst, governance consultant, CSR, public affairs, research)? Who writes and reviews them (subject-matter experts)?
Answer:

**2.15 Roles outside our focus.** Do we allow employers to run any role (including technical, sales, hourly) or limit to the sectors we can validate? Quality is unproven outside what we test.
Recommended: allow any role, but only label a role family "validated" after testing; others are marked "assistive summary".
Answer:

**2.16 The fixed "career-transition story" question** currently asked to every candidate. Keep as an optional question employers can add (recommended) or remove entirely?
Answer:

---

## 3. Section 3: Fairness, privacy and legal (**LEGAL**, needs a lawyer)

**3.1 Who is our lawyer for this feature?** Needed before launch for: candidate notice and consent text, retention periods, DPDP obligations, any bias-audit duty, employer contract terms. (DPDP substantive duties are reported to start about May 2027; the research marks every legal row "needs counsel".)
Answer:

**3.2 Who is the data protection / grievance contact shown to candidates?** Name, email, response time.
Answer:

**3.3 Retention.** Proposed: results and transcripts 180 days after the decision or job close (today), audio 30 days, consent and audit records 3 years, billing records 8 years. Confirm or change.
Answer:

**3.4 Do we want to collect demographic data (gender, region, language, disability accommodation use) to test for bias?** It is voluntary, separate from the interview, and shown only in aggregate. Needs consent and legal review. Without it we cannot measure group differences.
Answer:

**3.5 Candidates under 18 and age.** Recommended: 18+ only.
Answer:

**3.6 Accommodations.** A candidate can request more time, typed instead of spoken answers, or a human interview. Who handles these requests: the employer (recommended) with our process documented?
Answer:

**3.7 What claims do we make in marketing and contracts?** Recommended: no claims of "unbiased", "objective" or specific accuracy percentages; say "structured, evidence-linked screening support; a human makes the decision".
Answer:

**3.8 International customers or candidates.** If any EU, US (Illinois, New York City, California, Colorado) or other candidates are involved, extra laws apply (EU AI Act high-risk obligations, NYC bias audit, Illinois video-interview law). Are we in or out for year one? (Recommended: India only.)
Answer:

**3.9 Data processing agreement with employers.** Who is the "controller" (usually the employer) and who is the "processor" (us)? Needs a template contract.
Answer:

---

## 4. Section 4: Quality and validation (we need people from you)

**4.1 Pilot employers.** Can you name 2-3 friendly employers willing to run real screens and give feedback? Roles and approximate volumes?
Answer:

**4.2 Human raters.** We need 2 qualified people (HR / hiring managers) to rate 60-100 sample answers so we can check if the AI agrees with humans. Who and when? Are they paid?
Answer:

**4.3 Test data.** Sample answers must be synthetic or from consenting volunteers, not real candidate data. Can your team write or collect them?
Answer:

**4.4 Release bar.** Proposed gates before general release: every quote valid, AI agreement with humans no worse than humans with each other (minus a small margin), stable scores on re-runs, no unexplained group differences, 95% of interviews scored within 10 minutes. Approve or change?
Answer:

**4.5 What do employers consider "good"?** Ask the pilot employers: what would make them trust an AI screen (evidence quotes, comparison table, time saved, price)?
Answer:

---

## 5. Section 5: Operations and support

**5.1 Email sending.** Today Brevo's free plan (300 emails per day). Invitations and reminders may exceed that. Do we upgrade, or use another provider?
Answer:

**5.2 Storage for audio.** Today audio is stored on the server disk. Production needs object storage (S3-compatible). Which cloud and account?
Answer:

**5.3 Monitoring and alerts.** Do we have an error-tracking service (Sentry or similar) and who is on call for failures?
Answer:

**5.4 Support.** Who answers employer and candidate questions (for example "my interview failed")? Business hours? Target response time?
Answer:

**5.5 Admin tools.** Which admin screens do you need first: failed interviews and retry, appeals, usage and cost per company, kill switch?
Answer:

**5.6 Launch process.** Closed pilot first (recommended), then paid launch. Target dates?
Answer:

---

## 6. If we use free things: what the limits are

(Full detail, sources and arithmetic: `FREE_AI_PROVIDER_OPTIONS_RESEARCH.md`. The section below is a summary written after that research; numbers there are as read from provider pages on 2026-10-10 and can change without notice.)

**Bottom line: free tiers are for development with fake data only. Real candidates need a paid key, which is cheap.**

**Is there a free option we missed?** We searched about 20 providers. No free tier is both big enough and safe for real candidate data.
- GitHub Models was retired on 2026-07-30, so it is no longer an option.
- Cerebras is only a one-time $5 credit that expires after 30 days and is "not intended for production".
- Hugging Face gives free users no credits.
- Gemini's free tier no longer publishes its limits.
- Sarvam (India) gives a one-time Rs 100 credit, which covers about 11 interviews.
- Deepgram ($200) and AssemblyAI ($50) give one-time credits for speech-to-text only.

| Free option | Real limit | About how many 15-minute interviews | Main problem |
|---|---|---|---|
| Groq free | 200,000 tokens/day per model, 30 requests/min | about 4 per day per model | This is why we ran out after about 3 interviews |
| Cloudflare Workers AI | 10,000 "neurons"/day | about 6 per day (with speech-to-text) | Data terms not read |
| OpenRouter `:free` models | 50 requests/day (1,000 if you buy $10 of credit), 20/min | 2 per day (40 with the $10 top-up) | Free-model providers may log or train; which free models exist today was not found |
| Cerebras trial | 1M tokens/day, 5 requests/min | about 23 per day, for 30 days only | Trial, not for production |
| Gemini free | Not published officially | Cannot be computed | Google uses the content for training and humans may read it |
| Azure Speech free | 5 audio hours/month | about 20 per month | Too small |
| One-time credits (Sarvam, Deepgram, AssemblyAI) | A fixed amount, once | about 11, 2,500 and 1,300 in total | One-off only |

Free capacity is roughly 2 to 40 interviews a day at best, and nothing sustains even a small pilot.

**Why free is unsafe for real candidates:**
- Google's free Gemini terms say your content is used to improve their products and "human reviewers may read" it, and tell you not to submit personal information.
- Free-model providers on OpenRouter may log or train, and Cerebras's trial and others have terms we could not verify.
- Browser speech recognition sends the candidate's audio to a third party (Google, in Chrome), which is not acceptable as hiring evidence.
- Edge TTS is an unofficial service with terms-of-service risk.
- DeepSeek is hosted in China, which is a concern for Indian hiring data. This is our assessment, not from their page.

**What is acceptable where:**

| Stage | Acceptable | Not acceptable |
|---|---|---|
| Development and testing with fake data | Groq free, Gemini free, Cloudflare, OpenRouter `:free`, Cerebras trial, the one-time credits, local faster-whisper | Real candidate data on any of these |
| Closed pilot with real candidates | Paid keys. Groq with zero-data-retention turned on, or Sarvam (processes in India) only after we read the data agreement | Gemini free, OpenRouter `:free`, browser speech recognition, Edge TTS, DeepSeek, Cerebras trial |
| Paid production | Groq paid, Gemini paid, Sarvam paid, OpenAI or Anthropic paid, each with a data agreement | Any free tier |

**What paid costs (documented list prices, not measured):** one 15-minute interview with about 25 AI calls and audio answers.

| Stack | Cost per interview | At 1,000 interviews/month |
|---|---|---|
| Groq gpt-oss-20b + Whisper turbo | about $0.015 | about $15 |
| Groq gpt-oss-120b + Whisper turbo | about $0.020 | about $20 |
| Gemini paid (2.5 Flash-Lite + transcribe) | about $0.052 | about $52 |
| Sarvam (105B + speech-to-text) | about Rs 9 | about Rs 9,100 |
| OpenAI (gpt-5-nano + transcribe) | about $0.050 | about $50 |

At 100 interviews a month that is $1.50 to $5, and at 10,000 it is $150 to $520 (Groq to Gemini). Spoken questions (text-to-speech) cost extra: free with the browser voice, or about 1 to 3 US cents per interview with a paid voice. Self-hosting an open model is not cheaper than this below about 20,000 interviews a month (one GPU server costs about $416 a month).

**Our recommendation:** run the pilot and production on paid Groq with zero-data-retention turned on, plus a second provider as fallback. If speech-to-text is weak on Hindi or Hinglish audio, use Sarvam for that part. Test this on our own samples first, because Hindi accuracy for every option is unverified.

**Risks of leaning on free tiers:** limits change without notice, free tiers get removed, and a burst of simultaneous interviews can hit rate limits even on paid plans (paid-tier limits were not found).

**Not verified in the research:** Gemini's official free numbers, Groq's exact free-plan limits and its statement on training, Hindi and Hinglish accuracy for all speech options, whether any provider is blocked or slow in India, and the text of India's DPDP rules on sending data abroad. A lawyer should confirm the legal points.


## 7. Suggested order of answers
1. 1.2.1, 1.2.2, 2.1, 2.3 (provider and scope), 2. subscription document B2/C1-C4, 3. 3.1-3.3 (legal), 4. 4.1-4.2 (pilot people), 5. everything else.
