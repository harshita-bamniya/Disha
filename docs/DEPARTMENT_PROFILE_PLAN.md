# Department profile — plan (2026-10-08)

## What other platforms do (research)
- **Greenhouse** — Site Admins manage users centrally; Job Admins can add users to *their assigned jobs* only.
  Permissions can be scoped by office/department. A Job Admin never sees jobs they aren't assigned to.
- **Lever** — Admins/Team Members add users; "Limited Team Member" (hiring managers) only see candidates/jobs they own.
  Sensitive fields can be gated by department/team/location.
- **Workday** — a department head acts inside their own supervisory organisation; authority can be delegated.
- **SAP SuccessFactors** — an admin creates roles/permission groups; recruiting roles are then assigned per requisition.

**Conclusion → delegated administration (hybrid):** the company owner/admin creates the department and appoints its
**head**; the head then adds and removes members *inside their own department only*. Billing, KYC, branding,
offices, all-company team and other departments stay with the owner. Seat limits stay company-wide.

## Profile split
| Company (owner / company-wide) | Department head (`hr_manager` + department) | Department member (recruiter / hiring manager / interviewer) |
|---|---|---|
| Company profile, offices, billing, KYC, referrals | — | — |
| Create/edit/delete departments, appoint heads | Edit nothing at company level | — |
| Whole team, any role, any department | Invite / remove members **of own department**, roles below head | Read-only list of own department team |
| Cross-department jobs overview, all talent pool | Own department jobs (create/edit/publish), applicants, interviews, offers | Per role (see role_permissions) |

## Work items
1. [x] Route guards: company pages + other departments redirect dept users home (done earlier).
2. [x] Backend scoping: team list, department list/detail/overview/jobs (done earlier).
3. [x] Dept-head invites: head can invite to own department only, never as `hr_manager`; head can remove only
       own-department non-head members; head cannot reassign departments.
4. [x] Owner creates a department **with a head email** (system password + login link emailed).
5. [x] Scope team activity feed and talent pool to the department for scoped users.
6. [x] Frontend: invite dialog adapts (head label for owner, no head option for heads); heads see invite/remove
       controls on their department Team tab; members see none.
7. [x] Tests (API) with owner / head / member / other department; update docs. (11-case matrix run manually 2026-10-08)

## Later (not in this round)
Force password change on first login; resend/revoke invite; per-job hiring teams; job-approval workflow;
offer-amount visibility rules; owner audit log; org-wide 2FA/SSO.
