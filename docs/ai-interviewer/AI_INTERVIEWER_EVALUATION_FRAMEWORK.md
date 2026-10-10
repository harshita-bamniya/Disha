# AI Interviewer (Employer): evaluation framework

Status: proposal, 2026-10-10. Tags: `[Code]` Audit-observed, `[Research]`, `[Decision]`, `[Assumption]`.
Scope: how a candidate's answers become a scorecard and a recommendation, how that is validated, and when it may ship.

**Honest limits, stated up front.** `[Research §7]` The best-supported evidence is for *human-rated* structured interviews (corrected mean validity about .42, credibility interval roughly .18-.66). We found **no independent peer-reviewed evidence that LLM-scored interviews reach that validity**. This framework makes the AI's judgement as structured, inspectable and checkable as possible, but its predictive value for job performance is unproven until we validate it locally. We must not claim it removes bias or objectively identifies who deserves a job.

## 1. Why the current scorer cannot be used as-is

`[Code]` It scores clarity, conciseness, impact and STAR with a UPSC-coach prompt that never sees the employer's competencies, the JD or any rubric (Audit B4); questions differ per candidate (B5); an incomplete interview can display "Strong fit" (B1); fallback questions silently drop answers from the score (B6). Its good parts, reused here: code-computed aggregation, evidence quotes verified as substrings, two passes with a disagreement flag.

## 2. Evaluation criteria derived from the job

Inputs: JD snapshot, employer-selected competencies, employer must-haves. Three classes, never mixed:

| Class | Examples | How handled |
|---|---|---|
| **Objective requirements** | "3+ years in policy research", "LLB", "can relocate to Bhopal" | Collected as plain information questions; shown to the recruiter as *candidate-stated, unverified*; **never scored by AI**; verified by a human against documents. |
| **Competencies (judged from answers)** | Policy analysis, written/oral communication *only if the role needs it*, stakeholder management, ethical judgement, domain knowledge, problem solving | Scored against the rubric below. |
| **Preferences** | "Hindi fluency is a plus" | Displayed as a note; not scored; recruiter decides. |

Rules `[Decision]`: no inference from name, gender, age, accent, region, caste, religion, institution prestige, health or family; the question and follow-up generators are constrained by the existing discrimination filter (`compliance.py`, Audit §3 row 3) extended to model-generated text; communication is scored only when the employer marks it relevant, and then on the clarity of the *content*, not on accent or fluency.

## 3. Rubrics

One rubric per competency, drafted by AI from the JD, reviewed and editable by the employer, frozen in the template version. Behaviourally Anchored Rating Scale, 1-5:

```
competency: stakeholder_management
definition: Builds agreement among parties with different interests to deliver an outcome.
anchors:
  5: Specific example; names the parties and their conflicting interests; describes own actions;
     shows a trade-off made; states a concrete outcome and what they learned.
  4: Specific example with own actions and an outcome; trade-offs or learning only partly stated.
  3: Relevant example but vague on own role or outcome, or a sound general approach without an example.
  2: Generic statements; no example; or the example shows no coordination with others.
  1: Off-topic, contradicts the competency, or only restates the question.
evidence_needed: at least one concrete example OR a coherent approach with reasons
positive_signals: [...]   negative_signals: [...]
not_scoreable_if: answer < N words after trimming, language not understood, technical fault
```
`[Decision]` Score 0/NULL = **not assessable** (see §5). A missing or skipped answer is never 1. This addresses "do not confuse an unanswered question with an incorrect answer".

## 4. Scoring pipeline (the explainable path)

1. **Pre-checks in code:** completeness; per-answer length and language; fallback flags; ASR confidence; injection-pattern scan; cross-candidate similarity.
2. **Extraction pass (LLM, JSON schema):** per answer, list *claims/examples* with a verbatim `quote`; map each claim to rubric signals; no scores yet. Code verifies each quote is an exact substring and stores character offsets.
3. **Scoring pass A and B (LLM, JSON schema):** each independently assigns a 1-5 anchor to the competency using only the extracted, validated evidence and the rubric; same temperature, different prompt framing or model. `[Code]` today pass 1 and 2 use temperatures 0.1 and 0.4 and a failed pass 2 is silent (Audit B18); the new design uses equal settings and records a failed pass as a flag.
4. **Reconciliation (code):** if |A-B| <= 1 take the rounded mean; if > 1 set `needs_human_review` and use the lower score as provisional, labelled provisional.
5. **Aggregation (code, deterministic):** competency score = weighted mean over that competency's questions; overall readiness = weight-normalised mean over *assessable* competencies only; must-have rule (§5). No LLM touches a number after step 3.
6. **Narrative (LLM, constrained):** a summary written only from validated scores and quotes; a verifier rejects sentences that cite non-existent evidence; summary is written in the recruiter's language (English default; `[Code]` today it follows the interview language, Audit B28).
7. **Persist** the evaluation with rubric version, prompt-set version, model ids, flags and cost.

Why multi-stage: separating extraction from judgement and recomputing numbers in code makes each step inspectable and testable; an unconstrained single-call verdict is what the brief warns against. Whether a second pass improves reliability enough to justify its cost is an empirical question: measure it in the pilot (§8) rather than assume `[Assumption]`.

## 5. Evidence status and insufficient information

Per competency:

| Status | Rule |
|---|---|
| **Strong** | >= 2 independent evidence items or 1 specific, concrete example, pass A and B within 1. |
| **Weak** | Evidence present but generic/vague, or only one thin item. |
| **Missing** | No answer or no content bearing on the competency. Score = not assessable. |
| **Contradictory** | Evidence items conflict (e.g. claims ownership, later says observer). Flag for human review; score provisional. |
| **Insufficient** | Answer exists but below the minimum evidence threshold, or the technical state (ASR failure, interruption, system fault) makes it unreliable. Not scored; the question can be re-offered if the fault was ours. |

Must-have rule `[Decision]`: if a must-have competency is Missing/Insufficient, the recommendation cannot be better than "Needs clarification"; if it is scored <= 2 with strong evidence, the recommendation becomes "Not currently recommended against the stated criteria", still flagged for human confirmation. Confidence is expressed as the evidence status plus pass agreement, **not** as an LLM-stated percentage (LLM self-confidence is not proof, per the brief).

## 6. Recruiter report

Contents, all from stored data:
- Recommendation category and the reason in plain language (e.g. "Recommended for review: strong evidence on 3 of 4 competencies including both must-haves; weak evidence on stakeholder management").
- Competency table: score 1-5 or "not assessable", evidence status, pass agreement, rubric anchor reached, 1-3 quotes each with a link to the highlighted segment in the transcript.
- Strengths demonstrated; **evidence gaps**; answers needing human review; **unverified objective requirements**.
- Completeness (answered X of Y), technical issues (ASR errors, interruptions, fallback usage), integrity observations (advisory), accommodation notes.
- Provenance: template version, rubric version, prompt-set version, model ids, evaluation run number, generated-at.
- History: overrides and decisions with who/when/why.

## 7. Recommendation categories and thresholds

Fixed semantics, configurable labels `[Decision]`:

| Category | Default rule (code) |
|---|---|
| Recommended for recruiter review | All must-haves Strong or Weak-with-score >= the job's bar, overall >= band_high, completeness 100%, no unresolved contradictory flags |
| Needs clarification / additional assessment | Any must-have Weak or Missing, or overall between band_low and band_high, or any competency needs human review |
| Not currently recommended against stated criteria | A must-have scored low with strong evidence, or overall < band_low, with completeness 100% |
| Insufficient evidence to assess | Completeness < threshold, key competencies Missing/Insufficient, or systemic technical failure |

**No universal pass mark.** `band_high`/`band_low` are per-job parameters, initialised from defaults and **calibrated per role family** with a small set of human-rated interviews (§8): the recruiters rate 30-50 candidates blind, we choose thresholds that meet the target false-exclusion rate, and re-check each quarter. Until calibrated, the UI labels thresholds "provisional". `[Code]` the current 80/65/50 bands are uncalibrated (Audit B29).

## 8. Human review, overrides, audit

- Any competency or the overall recommendation can be overridden with a reason; original AI values are retained; both are shown. Overrides are append-only (`interview_score_overrides`).
- Disputed (candidate appeal), low-agreement and contradictory items enter a **review queue** for a recruiter (and an admin sample for calibration).
- Quality loop: overrides are labelled data. Track override rate by competency; a rising rate triggers prompt/rubric review.

## 9. Validation plan

**Stage 0: offline golden set (before any employer sees scores).** 60-100 synthetic and consented anonymised answers across 5-6 role families, with a written gold rationale by two qualified human raters. `[Assumption]` privacy-safe data: synthetic answers written by raters and volunteers; no real candidate data without consent and counsel's approval.

**Stage 1: shadow pilot** with 2-3 friendly employers: AI scores hidden from recruiters until they have formed their own view on a sample; compare.

**Stage 2: assisted use** with monitoring; then general availability when release criteria (§11) are met.

### Metrics

| Metric | Definition |
|---|---|
| Human-AI agreement | Weighted Cohen's kappa / Krippendorff's alpha on 1-5 competency scores; exact and within-one agreement; and category agreement |
| Human-human consistency | Inter-rater alpha between two humans on the same answers (the ceiling the AI should be compared against, not 100%) |
| Evidence-to-score consistency | Share of scores whose cited evidence a human judges sufficient for that anchor |
| Unsupported claims | Share of summary sentences not traceable to a validated quote (target 0 after verifier) and of quotes failing the substring check |
| Stability | SD of score across 5 re-runs of the same answer set; and across *equivalent* answers (paraphrase, reorder, length-padding, formatting) |
| False exclusions / false recommendations | Against human-final decisions on the sample, reported with confidence intervals and **never as overall accuracy alone**; historical hiring outcomes are not used as ground truth because they can encode bias `[Research §7]` |
| Group differences | Score and recommendation rates by group where lawful and voluntarily provided (e.g. gender, language, region, disability accommodation use); impact ratios plus effect sizes; ASR word-error-rate by language/accent. The four-fifths rule is a screening heuristic, not a legal safe harbour, and its current regulatory status is unconfirmed (Research §8). Needs counsel and consent for demographic collection. |
| Robustness | Pass rate on injection corpus, off-topic answers, non-English, very short/long answers, pasted LLM-generated answers |
| Operations | Scoring latency, failure rate, fallback share, completion rate, candidate-reported experience |
| Cost | Cost and latency per interview, per stage |

### Fairness and accessibility testing

- Counterfactual tests: swap names, genders, institutions and locations in otherwise identical transcripts; scores must not move beyond the stability noise band.
- Paraphrase/dialect variants (Indian English, Hinglish) and typed vs ASR-transcribed versions of the same answer.
- Accessibility audit of candidate flow (screen reader, keyboard, extended time) and a documented accommodation process.

### Release criteria (initial targets, `[Assumption]`: set by the owner after Stage 0 results)

| Gate | Target |
|---|---|
| Quote validity | 100% quotes substring-valid; 0 unsupported sentences in a 100-report audit |
| Agreement | Human-AI within-one agreement >= human-human within-one agreement minus 0.05 for each role family; weighted kappa reported, not gated on a single universal number |
| Stability | Re-run SD <= 0.3 anchor points on >= 95% of competencies |
| False exclusion | Among candidates the humans shortlisted, <= 10% placed in "Not currently recommended" (tune per role); all such cases human-reviewed in pilot |
| Group differences | No unexplained adverse-impact ratio < 0.8 on any monitored group without a documented investigation; ASR WER gap documented |
| Robustness | >= 98% of injection cases cause no score change beyond noise |
| Reliability | >= 95% scored within 10 minutes; 0 incomplete interviews shown as recommended |
| Governance | Counsel sign-off on notice/consent/retention; DPA with LLM provider |

A role family that does not meet the gates ships as "assistive summary only" (no category, no ranking) or does not ship.

## 10. Change control

Any change to a prompt, rubric template, model, or aggregation rule is a new `prompt_set_version`, re-runs the golden set, and ships only if it does not regress the gates. Past evaluations stay attached to the versions that produced them.
