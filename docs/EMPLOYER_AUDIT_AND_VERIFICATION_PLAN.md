# Employer profile audit + employer verification plan (2026-10-08)

Evidence: end-to-end run on a brand-new employer (register → email OTP → verification → admin approval →
department with head → head posts job → candidate applies → screening → shortlist → interview → offer → hired),
a code map of the existing KYC module, and web research (`docs/research/employer_verification_and_benchmarks.md`).

## 1. End-to-end flow — what worked
| Step | Result |
|---|---|
| Register employer (company name + email + password) | OK, OTP emailed, company + owner profile created |
| Post job while unverified | Correctly blocked (403, "company isn't verified yet") |
| Create department / appoint head by email | OK, credentials emailed, head lands on department page |
| Head posts job, candidate applies, pipeline moves, interview scheduled, offer sent, hired | OK, candidate notification emails fire at each step |
| Department scoping (applicants, pipeline, analytics, talent pool, team) | OK after the fixes made earlier today |
| Upload of non-PDF/PNG/JPEG file as KYC document | Correctly rejected |

## 2. Flow bugs and defects found
| # | Finding | Severity |
|---|---|---|
| F1 | Signup says "verify your email to log in" but login works before the OTP is entered (login never checks `email_verified`). Copy and behaviour disagree; unverified-email owners can already act. | Medium |
| F2 | Approval is stored on one employer profile (the requester), not the company. A teammate who requested verification leaves the owner unapproved; later joiners are not covered. | High |
| F3 | Invited seats are created `is_approved=True` unconditionally, so an unverified company's invitee passes the job-posting gate. | High |
| F4 | `Company.verification_status` is never written (always `unverified`) though returned by the API. | Medium |
| F5 | No state-machine guard on review: approve a rejected row, reject an approved row (leaves `is_approved=True`), etc. | High |
| F6 | Admin KYC drawer cannot list/open documents, does not show GST/PAN/website, `contact_email/phone` never populated. A reviewer can approve without seeing anything. | High |
| F7 | Nothing validated: no GSTIN/PAN/CIN/Udyam format checks, no GST/PAN fields at all, no duplicate detection (two companies can share a GSTIN). | High |
| F8 | Documents stack on re-upload; no per-document accept/reject; approval doesn't require required documents; "request without uploading" lets an empty request into the queue. | Medium |
| F9 | Emails/wizard copy promised a candidate-facing "verified badge". Decision: no badge — every published job is already from a verified employer, so it would add nothing; the copy was removed instead. | Low |
| F10 | Rejection email says "resubmit" but there is no resubmit/needs-info path; no reason codes; no in-app notice; nothing on revoke. | Medium |
| F11 | Admin detail returns internal `file_url` storage path; stale `pending/resubmitted` strings in admin UI; KYC badge for `requested` is grey. | Low |
| F12 | Owner can post jobs via API although sidebar copy says company-wide roles don't post (schema comment says allowed). Decide and align. | Low |
| F13 | Free-plan owners with a department head: seat limit counts heads; message says "upgrade" but there is no inline upgrade path from the invite dialog. | Low |

## 3. Employer verification — design (from research)
**Tiers.** T0 Registered (email OTP): can build profile, create departments, draft jobs. T1 Verified: can publish,
badge "Verified employer". T2 Verified+ (later): registry-confirmed legal name + signatory proof, higher limits.
This build delivers T0→T1 end to end and leaves T2 as a field-compatible extension.

**Statuses.** `draft` (employer filling it in, invisible to admins) → `requested` (submitted, in queue) →
`under_review` → `needs_info` (admin asked for something; employer edits and resubmits the same case) →
`approved` | `rejected` (reason code). `approved` is reversed only by revoke. Company mirrors it in
`Company.verification_status` (`unverified | pending | verified | rejected`).

**What the employer provides** (checklist depends on entity type):
| Entity type | Registry ID (one of) | Always | Documents required |
|---|---|---|---|
| Company / LLP / startup | CIN or LLPIN, or GSTIN | company PAN, official-domain email, signatory name + designation | PAN card + (incorporation certificate or GST certificate) |
| Proprietorship / partnership / coaching institute | GSTIN, or Udyam, or Shops & Establishment no. | same | PAN card + one of GST / Udyam / Shops & Est. / partnership deed |
| NGO / trust / society / think tank | NGO Darpan ID or society/trust registration no. | same | Registration certificate + PAN card (12A/80G optional) |
| Government-adjacent body | official `.gov.in/.nic.in/.ac.in/.edu.in` email | signatory | Authorisation letter on letterhead |
| Placement agency / consultancy / freelance recruiter | GSTIN or Udyam | PAN, **no-candidate-fee declaration** | PAN card + one registry document (+ client authorisation letter optional) |
Declarations (all required): information is accurate; applicant is authorised to represent the entity; no fee will ever be charged to candidates.

**Automatic checks on save/submit** (cheap, no paid APIs): GSTIN format + checksum + state code; PAN format and 4th-letter vs
entity type; GSTIN embeds PAN (must match); CIN/LLPIN/Udyam/Darpan format; free-mail domain flag; email domain vs website;
duplicate GSTIN / CIN / PAN / domain across other companies; email OTP done. Results are shown to the admin as pass/warn/fail.
Registry lookups (GST portal, MCA, Darpan) stay a manual reviewer step in this version; vendor KYB APIs are a later option.

**Reviewer workflow.** Queue → detail with all submitted data, auto-check results, every document viewable and
individually accepted/rejected, timeline. Actions: mark under review, request more info (message required), approve
(blocked if required documents missing/rejected or a hard auto-check fails without a written override note), reject
(reason code + text). Every transition is validated, audited, emailed to the employer and appended to the timeline.

**On approve:** all company employer profiles `is_approved=True`; company `verified`; future team seats inherit
company status. No candidate badge: only verified employers can publish at all.

**Privacy.** Documents only via authenticated admin download; internal paths never returned; masked IDs shown to
candidates (none); retention window for KYC files is a follow-up (DPDP).

## 4. Build phases for this round
1. Migration: new statuses, structured columns, new document types, company `verified_at`.
2. Rules module: entity requirements + validators + auto-checks.
3. Employer API: details, documents (replace/delete), submit, extended GET.
4. Admin API: richer detail, per-document review, state machine, request-info, company-level approval, revoke fix.
5. Seats inherit company status.
6. Employer UI: guided 4-step verification page with checklist, auto-check feedback, needs-info/rejected handling.
7. Admin UI: KYC queue drawer with data, documents, checks, actions.
8. Fix F1 copy; end-to-end re-test.

## 5. Suggestions beyond verification (prioritised)
**P0** — forced password change on first login for invited members; unify the "owner posts job?" rule (F12); resend/revoke invites; email OTP on the business email.
**P1** — careers page per company (public `/companies/<slug>`); job approval workflow (department requests → owner approves; `jobs:approve` exists but no flow); per-job hiring team; scorecards/interview kits; offer-amount visibility rules; candidate "report this job"; annual re-verification + expiry; owner audit log; saved filters/bulk actions in pipeline; employer notifications centre.
**P2** — registry API lookups (GST/MCA) via a KYB vendor; Verified+ tier; job multiposting/syndication; resume-database search with credits; calendar integrations beyond Google; ATS webhooks/API keys; org-wide 2FA/SSO policy; DPDP retention job for KYC documents.
**P3** — onboarding after offer; DEI analytics; referral payouts.

## 6. Status (end of 2026-10-08)
Phases 1-8 of section 4 are built and verified: migration `s1v2e3r4i5f6`, rules module
`backend/app/core/employer_verification_rules.py`, employer API (`/employer/verification/{start,details,documents,submit,rules}`),
admin API (state machine, per-document review, request-info, company-level approval/revoke), seats inherit company status,
guided employer page, admin KYC drawer.
Fixed from section 2: F1 (copy), F2, F3, F4, F5, F6, F7, F8, F9, F10, F11. Still open: F12, F13, and all of section 5.
Tests: `backend/tests/test_verification_flow.py` (6 tests). Run with
`DATABASE_URL=postgresql://disha:change_me_in_production@localhost:5432/disha_db REDIS_URL=redis://localhost:6379/0 PYTHONPATH=. python -m pytest ...`
(3 tests in `test_auth_email_first.py` fail locally only because Brevo is configured and the dev OTP is hidden).
