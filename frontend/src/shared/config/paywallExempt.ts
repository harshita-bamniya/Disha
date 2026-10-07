/**
 * Employer routes reachable before the company has an active paid plan — an
 * employer must always be able to set up their company, view/pay for a plan,
 * or reach support before the rest of the dashboard unlocks.
 *
 * Single source of truth: both EmployerLayout (which routes to show vs. the
 * paywall gate) and the global API client (which decides whether a 402 from
 * a background call should redirect the user away) must agree on this list —
 * previously they didn't, so "exempt" pages weren't actually exempt: a
 * background /employer/dashboard call (used just for the header) would still
 * 402 and force-redirect the user to Billing even while they were on Team,
 * Company Profile, or Verification.
 */
export const PAYWALL_EXEMPT_PREFIXES = [
  '/app/employer/subscription',
  '/app/employer/company',
  '/app/employer/profile',
  '/app/employer/verification',
  '/app/employer/support',
]

export function isPaywallExemptPath(pathname: string): boolean {
  return PAYWALL_EXEMPT_PREFIXES.some(p => pathname.startsWith(p))
}
