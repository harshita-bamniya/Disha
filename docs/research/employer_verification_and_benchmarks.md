# Employer Verification and Hiring-Product Benchmarks (BeginablAI)

Researched 2026-10-08. Web search only; no code changes. Evidence labels: **[S]** = sourced from a URL in section (f); **[K]** = general domain knowledge / our recommendation, not verified in this research pass. Where nothing was found, it says "unknown".

## (a) Executive summary

- **Platforms verify at the account/posting gate, mostly in a hybrid way.** Indeed requires a one-time verification before jobs go live (call, work email, or business documents; team review, "most requests approved quickly") [S1][S2]. Naukri runs KYC with different document sets per entity type (individual/proprietorship vs company/partnership), online, manually reviewed, stated turnaround about 2 working days, plus mandatory GST details for Indian clients [S3]. Instahyre: email + phone OTP, then manual team review (same day for paid, 2-3 business days for free) [S4]. LinkedIn: company-page verification by LinkedIn's team (now open to paid Premium Company Page subscribers) and, since Sept 2025, mandatory workplace verification (e.g. company email) for anyone adding recruiter titles [S5][S6].
- **Not found:** employer-side verification details for Foundit, Glassdoor, Wellfound (only candidate verification found), Workable, Greenhouse (ATS vendors verify little, since customers are paying and post to their own careers pages). Treat as unknown.
- **Recommended model for BeginablAI: 3 tiers, manual review assisted by free registry lookups.** Tier 0 Email-verified (can browse, build profile, draft jobs; cannot publish). Tier 1 Verified (publish jobs). Tier 2 Verified+ (extra badge: registry-confirmed legal entity plus authorised-signatory proof; higher posting limits). Audit trail, rejection reasons, resubmission and annual re-verification built in.
- **India-specific core evidence:** a business registry ID (GSTIN or CIN/LLPIN, or Darpan ID + 12A for NGOs, or society/trust registration), company PAN, official-domain email, and proof the applicant is authorised. GSTIN, CIN and Darpan can be checked on free public portals (manual, CAPTCHA-protected); automation needs a paid KYB vendor (Surepass, Signzy, Decentro, Gridlines, etc.), pricing not published, so unknown.
- **Scam controls matter more for a UPSC audience** (anxious, fee-prone candidates): ban candidate-paid fees at the policy level, flag free-mail domains and name mismatches, and show a clear verified badge plus a "report this job" link.
- **Privacy:** DPDP Rules 2025 were notified 14 Nov 2025; most fiduciary duties (erasure, security safeguards, etc.) apply 18 months later (about May 2027) [S12]. Design now: purpose-limited collection, access control, logging, retention schedule, delete uploaded KYC documents after a defined period.

## (b) Required information and documents for employer verification in India

"Validate" column: free = public portal, manual lookup; API = paid KYB vendor exists (price unknown unless stated). Vendors named in sources: Surepass, Signzy, Decentro, Meon, QorpIQ, Gridlines, Vayana Atlas, AuthBridge, ZOOP, HyperVerge, SignDesk [S7][S8][S9]. No official public API for MCA or Udyam was found; vendor APIs are third-party wrappers, so ask each vendor where data comes from.

| Item | Who needs it | How to validate | Mandatory vs optional |
|---|---|---|---|
| Legal entity name, entity type, address, website, contact person, phone (OTP) | All | Cross-check against registry records below; OTP on phone | Mandatory |
| Official-domain work email (OTP/link) | All with a website; coaching institutes, firms, startups, think tanks | Confirm domain matches website/registry name; reject free-mail (gmail/yahoo/outlook) for Tier 1 unless exception route; WHOIS age is a useful signal [K] | Mandatory for Tier 1 (exception: sole proprietors/NGOs without domain use documents + video call) |
| GSTIN | Companies, LLPs, firms, proprietors above GST threshold, coaching institutes | GST portal "Search Taxpayer by GSTIN" (no login, CAPTCHA): legal name, trade name, status, registration date, taxpayer type [S10]. API: Surepass GSTIN verify, Signzy PAN-to-GST [S7][S8] | One of GSTIN / CIN / LLPIN / society-trust ID is mandatory; GSTIN strongly preferred for for-profit. Naukri makes GST mandatory for Indian clients (billing reason) [S3] |
| CIN (company) / LLPIN | Pvt Ltd, Public Ltd, OPC, LLP | MCA company master data (mca.gov.in, manual); API via Decentro, QorpIQ, Meon, Gridlines etc. taking CIN/LLPIN/FCRN, returns status (Active / Strike-off), registered address, directors [S9]. Reject Strike-off/dormant | Mandatory for companies/LLPs (in lieu of or in addition to GSTIN) |
| Company PAN (and PAN-to-name match) | Companies, LLPs, firms, trusts, proprietors | PAN verification APIs (Surepass etc.) [S7]; PAN fourth character indicates entity type (C company, F firm/LLP, T trust, A AOP, P person) [K]. PAN-to-GSTIN lookup exists at vendors but one old forum post questions its sourcing [S7] | Mandatory for Tier 2; optional for Tier 1 if GSTIN/CIN present (GSTIN embeds PAN) |
| Udyam / MSME registration | Small firms, proprietors, startups without GST | 12-digit Udyam number; vendor APIs return name, address, category [S11]; manual via Udyam portal [K] | Optional alternative proof of business existence |
| Shops and Establishment licence | Small offices, coaching centres, placement agencies | Manual document check: name, address, validity, issuing authority; state-specific, no unified registry [K] | Optional; useful fallback for non-GST entities |
| Partnership deed / firm registration | Partnership firms | Manual: partner names, firm name, address; pair with firm PAN [K]. Naukri has a separate company/partnership KYC path [S3] | Mandatory for partnerships lacking GSTIN |
| Trust deed / Society registration certificate | Trusts, societies, think tanks, coaching trusts | Manual document review; state registrar records vary [K] | Mandatory for these entities unless Darpan ID + 12A |
| NGO Darpan ID | NGOs / voluntary orgs | Search the ID on ngodarpan.gov.in (NITI Aayog) and match name, sector, status; save profile snapshot [S13]. Darpan not legally required for every NGO | Mandatory for NGOs (alternative: society/trust cert + 12A) |
| 12A / 80G certificate | NGOs, charitable trusts | Match certificate details against Income Tax records; exact online lookup steps not confirmed in research. Note one source says provisions moved under the Income Tax Act 2025 from 1 Apr 2026, confirm current process [S13] | Optional-to-strong evidence for NGOs; not proof of identity alone |
| GeM seller registration | Vendors to government | Manual check of GeM profile [K] | Optional supplementary signal only |
| Government / govt-adjacent bodies (PSUs, autonomous bodies, universities) | Govt-adjacent | Official gov.in / nic.in / ac.in email domain + authorisation letter on letterhead; call back via publicly listed number [K] | Domain email mandatory; GSTIN/CIN not applicable |
| EPFO / ESIC establishment code | Established employers | Manual (code on challan/certificate) [K] | Optional supplementary signal |
| Authorised signatory letter or board resolution | Anyone whose applicant is not an owner/director | Manual: names applicant, entity, date, signed and stamped; match signatory to MCA director list if CIN present [K] | Mandatory when applicant email is not clearly the owner/director or when claiming Tier 2 |
| Applicant ID (PAN/Aadhaar-masked) | Sole proprietors, freelance recruiters, consultancies | Name match to PAN API; do not store full Aadhaar [K]. Naukri asks Aadhaar-linked verification for individuals and offers manual fallback via kyc@ [S3] | Mandatory for individuals/proprietors with no registry entity |
| Placement agency / consultancy extras | Placement agencies, staffing firms | Entity docs above plus declaration "no fee from candidates" and the client list; for overseas placement the MEA recruiting-agent licence must be checked [S14] | Mandatory declaration; overseas licence only if overseas jobs |
| Bank/address proof (utility bill, lease, bank agreement) | Fallback for entities with weak registry presence | Manual; Indeed accepts utility bills, business licences, insurance, lease/franchise and bank agreements, but not public documents [S2] | Optional fallback |

Typical asks by entity (our recommendation, built on the above):
- **Pvt Ltd / LLP / startup:** CIN or LLPIN + GSTIN (if any) + company PAN + domain email.
- **Coaching institute (proprietor/partnership):** GSTIN or Udyam or Shops and Establishment licence + PAN + signatory ID + brand website; video call if no domain email.
- **NGO / think tank / trust:** Darpan ID or registration certificate + 12A (+80G if claimed) + PAN + signatory letter.
- **Govt-adjacent:** official-domain email + letter on letterhead + callback.
- **Freelance recruiter / consultancy:** treat as agency: personal PAN + business proof + client authorisation per job (letter from the hiring company) + no-fee declaration. Consider restricting to "agency" label and limited posting until Tier 2.

## (c) Recommended verification tiers and workflow

### Statuses
`unverified` (email not confirmed) -> `email_verified` -> `pending_review` -> `needs_info` <-> `pending_review` -> `verified` | `rejected`; `verified` -> `suspended` (reversible) or `expired` (re-verification due). Keep status separate from plan/billing status.

| Tier | Requirements | Can do | Badge |
|---|---|---|---|
| T0 Registered | Work-email OTP, phone OTP, basic company profile | Browse, build profile, draft jobs, invite team | None |
| T1 Verified | Entity registry ID (GSTIN/CIN/LLPIN/Darpan/trust cert) + domain email or alt proof + reviewer approval | Publish jobs, receive applications | "Verified employer" |
| T2 Verified+ | T1 + company PAN match + authorised-signatory proof + (optional) video call | Higher limits, featured placement, careers page | "Verified+" with registry-confirmed legal name |

### What the employer sees
- Status banner with plain next step; checklist of submitted items with per-item state (accepted, needs fix, rejected + reason).
- Expected SLA text ("usually within 2 working days", based on Naukri's stated 2 working days [S3]; Instahyre same-day for paid / 2-3 days free [S4]).
- Email + in-app notification on every status change; one-click resubmission preserving earlier uploads.
- If suspended: reason category and appeal path.

### Workflow
1. Self-serve signup, entity type choice drives the document checklist.
2. Auto-checks on submit (cheap): GSTIN format/checksum, PAN format, domain vs email, free-mail flag, duplicate GSTIN/CIN/domain/phone across accounts, WHOIS domain age [K]. Optional vendor API lookups later once volume justifies them.
3. Reviewer queue (oldest first, priority for paid plans), checklist in (d), decision with mandatory reason code.
4. Outcome: approve, request info (specific fields), or reject (reason code + free text, shown to employer).
5. Resubmission allowed (cap e.g. 3 attempts then support contact) [K].
6. Post-verification monitoring: first N jobs reviewed before going live (sample then taper); candidate "report job" links auto-open a review case.
7. Expiry/re-verification: re-check yearly, plus triggers on change of legal name, GSTIN, domain or admin email, or on GST status turning cancelled/suspended. Indeed treats verification as a one-time step per company with admin-added users inheriting it [S1]; the annual refresh is our added safeguard [K].
8. Team members: users added by a verified admin inherit company status but need their own work-email check; LinkedIn requires recruiters to verify their workplace [S5].

### Audit trail
Immutable log per case: who (reviewer id), when, from-status, to-status, reason code, notes, document ids viewed, and registry lookups performed (snapshot or reference). Never edit; append only. DPDP rules require logs retained at least one year [S12].

### Privacy and retention (India DPDP Act 2023 and Rules 2025)
- Notified 14 Nov 2025; Rules 1, 2, 17-21 in force at once, Rules 3, 5-16, 22, 23 apply after 18 months (about May 2027); sources vary slightly on Rule 4 [S12]. Confirm against the Gazette text; sources are commentaries.
- Collect only what verification needs (purpose limitation); give a notice at upload stating purpose, retention and contact; store documents encrypted, access restricted to reviewers, access logged (Rule 6 security safeguards: encryption, access control, logging, backups) [S12].
- Retention proposal [K]: keep the verification outcome and registry IDs for the life of the account (+ the legal minimum for logs); delete uploaded document images/personal ID copies after a fixed window post-decision (e.g. 90 days for rejected, 12 months after approval unless needed), subject to any legal retention requirement. Rule 8 requires erasure when the purpose is served unless law requires retention [S12]. Do not store full Aadhaar numbers.
- Breach notification obligations include a 72-hour element [S12]; keep an incident runbook.
- Signatories and directors are personal data subjects too: minimise, and honour access/correction/erasure requests.

### Badge display to candidates
Badge on job cards, job detail, company page and employer messages, with tooltip "Legal entity confirmed against government registry on <date>". Do not show documents or numbers beyond a masked registry ID. Show nothing misleading for T0 (unverified employers cannot publish anyway). Display "Verified+" only when T2 is current. LinkedIn explicitly frames its verification as confirming a page is the brand's official presence, not an endorsement of reputation [S6]; use similar wording.

## (d) Reviewer checklist and red flags

### Checklist (per case)
1. Entity type matches documents submitted; legal name consistent across form, registry, PAN, certificate, website.
2. GSTIN: status Active, legal/trade name match, state and address plausible. CIN/LLPIN: Active, not struck-off, directors list includes or plausibly relates to the applicant.
3. PAN: format valid, name matches, 4th character fits entity type.
4. Email domain matches website and entity; domain age, MX, HTTPS site with real content, about/contact page, phone reachable.
5. Applicant authorisation: owner/director, or signatory letter/board resolution with signature and date.
6. NGO/trust: Darpan ID found, name/sector/status match; 12A/80G certificate genuine and in-date.
7. Documents: legible, unaltered (check metadata, fonts, inconsistent stamps), not expired, not a public document from another entity.
8. Duplicate check: GSTIN, CIN, domain, phone, bank/UPI, admin email, IP reuse across accounts and across previously rejected/suspended accounts.
9. Business plausibility: does the entity plausibly hire for UPSC/civil-services-related roles (research, policy, teaching, content, consulting, etc.)? Check LinkedIn/web presence and careers.
10. Sample the first job posts: no fee, realistic salary, clear role, official contact.
11. Record decision with reason code; for needs_info, list exact missing items.

### Rejection reason codes (suggested)
`ENTITY_NOT_FOUND`, `REGISTRY_INACTIVE`, `NAME_MISMATCH`, `DOCUMENT_ILLEGIBLE_OR_ALTERED`, `DOMAIN_MISMATCH_OR_FREE_EMAIL`, `NO_AUTHORISATION`, `DUPLICATE_ACCOUNT`, `PROHIBITED_BUSINESS_MODEL (candidate fees)`, `UNABLE_TO_CONTACT`, `OTHER`. Make rejected-with-reason and resubmission possible except for fraud codes (permanent block).

### Red flags (fake employers and job scams)
- Any request for money from candidates (registration, training, "security deposit", test fees). Indeed bans employer fees and treats them as scam indicators [S1][S15]. Ban in terms of use; require declaration from agencies.
- Free email domains (gmail, yahoo) used for a purportedly established company; job-seeker guidance from Indeed and LinkedIn says to expect a company domain [S1][S6].
- Mismatched names across email domain, website, registry and certificate; GSTIN/CIN belonging to a different, unrelated entity (identity borrowing); recently registered domain.
- Contact only via WhatsApp/Telegram/social media, no verifiable office address or phone (MEA advisory on fake overseas jobs cites exactly these) [S14].
- Offers that are too good, vague roles, interview skipped, instant "selection"; roles such as mystery shopper or personal assistant flagged by Indeed [S1].
- Overseas jobs without a valid MEA recruiting-agent licence; fees far above the legal cap (MEA states registered agents may charge at most INR 30,000; scam overcharging cited at INR 2-5 lakh) [S14]. Verify licence on the MEA emigration portal (direct URL not confirmed in research).
- Shared document images across accounts; a new account immediately posting many jobs; bulk posting from different company names by one admin.
- Candidate reports: auto-escalate after N reports or any fee-related report.

## (e) Benchmark feature matrix

Sources for feature claims are comparison/review sites and vendor pages (weak evidence; check vendor pages before committing); see (f). Y = present per sources, ~ = partial/tier-dependent, ? = not confirmed in this research. Entries marked [K] are from general knowledge.

| Area | Greenhouse | Lever | Workable | Naukri RMS / Recruiter | LinkedIn Talent | Indeed for Employers | BeginablAI priority |
|---|---|---|---|---|---|---|---|
| Employer onboarding / verification | ? | ? | ? | Y (KYC, GST) [S3] | Y (company + recruiter verification) [S5] | Y (verification before posting) [S1] | P0 (this document) |
| Company profile / branding | Y (careers page, branding) [K] | Y [K] | Y | ~ | Y (company page) | Y (company page) | P0 |
| Careers page | Y [K] | Y [K] | Y [K] | ? | ~ | ~ | P1 |
| Team / roles / permissions | Y (granular roles) [K] | Y [K] | Y [K] | Y (sub-users) [K] | Y (seats) | Y (admin adds users) [S1] | P0 |
| Job posting (multiposting, templates, approvals) | Y [K] | Y [K] | Y | Y (job posting, requisition mgmt) [S16] | Y | Y | P0 |
| Screening questions / assessments | Y | Y [K] | Y | Y (assessment mgmt) [S16] | ~ | Y (screening questions, assessments) [S17] | P0-P1 |
| Resume database / sourcing | ~ (via integrations; no native CRM) [S18] | Y (built-in CRM, nurture) [S18] | Y [K] | Y (resume database, parsing) [S16] | Y (Recruiter search, 40+ filters) [S19] | Y (resume search) [S17] | P2 |
| Pipeline / ATS (stages, scorecards, collaboration) | Y (structured hiring, scorecards, interview kits) [S18] | Y [S18] | Y | Y (candidate mgmt) [S16] | ~ (ATS integrations) | Y (applicant tracking) [S17] | P0 |
| Interview scheduling | Y [K] | Y (self-scheduling) [S18] | Y [K] | Y (interview scheduling) [S16] | Y (share availability) [S19] | Y [S17] | P1 |
| Offers (letters, e-sign, approvals) | Y (offer letters, e-sign) [S18] | Y [K] | Y [K] | ? | ? | ? | P2 |
| Analytics / reporting | Y (deep pipeline, DEI) [S18] | Y (trend analysis) [S18] | ~ | Y (analytics, activity dashboard) [S16] | ~ | ~ (dashboard) | P1 |
| Integrations / API | Y (large marketplace) [S18] | Y | Y (about 190 integrations) [S18] | Y (API) [S16] | Y (ATS integrations) | ~ | P2 |
| Billing / plans | Sales-led (price unknown) | Sales-led | Published flat plans (about USD 299, 599, 719 per month per one source) [S18] | Not public [S16] | Published tiers by hiring volume [S19] | Free tier + paid upgrades [S17] | P1 |
| Compliance / trust and safety | Audit trail [S18] | ? | ? | KYC [S3] | Verification badges [S5] | Fraud moderation, fee ban, applicant reporting [S1] | P0 |
| Onboarding (post-offer) | ~ | ~ | ~ | Y (listed) [S16] | n/a | n/a | P3 |

Suggested BeginablAI scope, given an aspirant-centric marketplace: P0 verification, company profile, team roles, job posting with screening questions, basic pipeline; P1 careers page, scheduling, analytics, billing; P2 sourcing/talent pool, offers, integrations; P3 onboarding.

## (f) Source links

- [S1] Indeed, employer verification and security (overview, fee rules): https://sa.indeed.com/security ; https://staysafeonline.org/resources/job-search-security/
- [S2] Indeed Help, document verification requests (accepted documents, no posting before verification): https://in.indeed.com/help/employers/articles/verification-center-document-verification-requests
- [S3] Naukri Recruiter KYC and GST: https://recruiterzone.naukri.com/enhance-trust-with-jobseeker-community-become-kyc-compliant ; https://recruiterfaq.naukri.com/2016/12/29/what-documents-are-required-for-kyc-verification/ (page timed out when fetched; exact document list NOT confirmed) ; https://recruiterfaq.naukri.com/2016/12/29/how-to-check-kyc-verification-status-of-my-account ; https://recruiterzone.naukri.com/?p=8747 (GST requirement, 2017, may be outdated)
- [S4] Instahyre employer onboarding: https://help.instahyre.com/en/article/get-started-l4t9i9/
- [S5] LinkedIn recruiter and company verification coverage: https://www.hrdive.com/news/linkedin-expands-company-page-verification-adds-recruiter-verification/759338/ ; https://www.techradar.com/pro/linkedin-is-forcing-recruiters-and-executives-alike-to-verify-themselves ; https://www.helpnetsecurity.com/?p=340642
- [S6] LinkedIn Help (verification badge, company email guidance): https://www.linkedin.com/help/learning/answer/a9551007
- [S7] Surepass PAN / GST APIs: https://surepass.io/pan-card-verification-api/ ; https://surepass.io/gst-number-search-by-pan-api/ ; https://surepass.io/blog/top-gst-verification-api-providers/ (pricing: not published, contact sales)
- [S8] Signzy PAN to GST: https://docs.signzy.com/api-marketplace/pan-to-gst (pricing unknown)
- [S9] MCA data APIs: https://decentro.tech/api-hub/mca-verification-api ; https://developers.qorpiq.com/docs/mca-company-master-data ; https://meon.co.in/mca-data-api-cin-din ; https://atlas.vayana.com/iv/mca-data-api ; https://gridlines.io/blogs/?p=4174 ; usage-based price page (figures not retrieved): https://www.infyner.com/api-pricing
- [S10] GST portal taxpayer search walkthrough: https://learn.quicko.com/gst-portal-taxpayer-details ; https://learn.quicko.com/verify-gstin-gst-portal
- [S11] Udyam verification APIs: https://surepass.io/udyam-aadhaar-verification/ ; https://zoop.one/verify-business/udyam-aadhaar-verification-api ; https://signdesk.com/in/id-verification/udyam-aadhaar-verification-api
- [S12] DPDP Rules 2025: https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025 ; https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/ ; https://www.jsalaw.com/?p=55573 ; https://dpdpa.com/dpdparules/rule8.html (secondary commentary; verify against Gazette)
- [S13] NGO Darpan / 12A / 80G (commercial guides, not official): https://www.smilefoundationindia.org/blog/verify-an-ngo-before-donating/ ; https://corpbiz.io/learning/ngo-darpan-registration/ ; official portal: https://ngodarpan.gov.in
- [S14] MEA advisory on fake overseas jobs and overcharging: https://greaterkashmir.com/national-2/govt-advisory-cautions-against-fraudulent-overseas-job-offers ; https://www.goa.gov.in/wp-content/uploads/2024/08/ADVISORY-ON-OVERCHARGING.pdf
- [S15] Indeed fake applicants and reporting: https://au.indeed.com/hire/resources/howtohub/identifying-and-reporting-fake-applicants-on-indeed
- [S16] Naukri RMS listings: https://www.capterra.in/software/169303/naukri-rms ; https://www.getapp.com/all-software/a/naukri-rms/
- [S17] Indeed for Employers listings: https://www.capterra.com/p/161381/Indeed/ ; https://www.getapp.com/hr-employee-management-software/a/indeed/features/
- [S18] ATS comparisons: https://theundercoverrecruiter.com/greenhouse-vs-lever-vs-workable-vs-bullhorn/ ; https://www.outsail.co/post/greenhouse-vs-lever-vs-ashby ; https://hiretruffle.com/blog/greenhouse-vs-lever
- [S19] LinkedIn Talent Solutions: https://business.linkedin.com/talent-solutions/product-comparison ; https://tcommunity.linkedin.com/product-updates/resume-search-august-2024-961

### Gaps and caveats
- Foundit, Glassdoor, Wellfound (employer side), Workable and Greenhouse employer-verification practices: not found.
- Naukri's exact KYC document list: page timed out; known only that sets differ by entity type and that GST is required for Indian clients.
- API pricing for Surepass, Signzy, Decentro and others: unknown (sales-led / trial). Do not budget from this document.
- 12A/80G online lookup and how the Income Tax Act 2025 changes them: unconfirmed.
- Items tagged [K] are recommendations or general knowledge and should be validated (especially state-wise Shops and Establishment rules and registry portal features) before being hard-coded.
