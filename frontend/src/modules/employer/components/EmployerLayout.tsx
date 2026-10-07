import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import EmployerSidebar from './EmployerSidebar'
import { Lock } from 'lucide-react'
import { colors, shadows, radius } from '@/design-system/tokens'
import { useSubscription } from '../hooks/useJobs'
import { PAYWALL_EXEMPT_PREFIXES } from '@/shared/config/paywallExempt'

function PaywallGate() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        maxWidth: 420, textAlign: 'center', background: colors.surface.card, borderRadius: radius.xl,
        border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, padding: 32,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: colors.surface.elevated,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Lock size={20} color={colors.text.muted} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: '0 0 8px' }}>
          Renew your subscription
        </p>
        <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 0 20px', lineHeight: 1.5 }}>
          Your plan is inactive, so the dashboard is locked. Pick a plan — including the free tier — to get back in.
        </p>
        <Link
          to="/app/employer/subscription"
          style={{
            display: 'inline-block', height: 38, lineHeight: '38px', padding: '0 20px', borderRadius: 8,
            background: colors.brand.navy, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}
        >
          View plans
        </Link>
      </div>
    </div>
  )
}

export default function EmployerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { data: sub, isLoading: subLoading } = useSubscription()

  const isExemptRoute = PAYWALL_EXEMPT_PREFIXES.some(p => location.pathname.startsWith(p))
  // Free-tier companies get real access — capped by their plan's own limits
  // (active job postings, recruiter seats, etc.), not by an all-or-nothing
  // paywall. This only blocks a lapsed/canceled subscription that hasn't
  // been renewed (a brand-new company gets a free plan auto-provisioned).
  const hasActiveSubscription = !!sub && sub.status === 'active'
  const showPaywall = !isExemptRoute && !subLoading && !hasActiveSubscription

  return (
    // `height` + `overflow: hidden` (not `minHeight`) is deliberate: it caps
    // this row at exactly the viewport height so the page/body itself never
    // scrolls. Without that cap, the Outlet div below still scrolls its own
    // content (it's shorter than the full page), but the body ALSO ends up
    // with a sliver of extra scrollable height — two overlapping scrollbars
    // fighting each other at the edge of the window. Capping the root means
    // the Outlet div is the only scroll container, full stop.
    <div style={{ height: '100vh', overflow: 'hidden', background: colors.surface.bg, display: 'flex' }}>

      <EmployerSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />

      {/* Main content column — each page supplies its own PageHeader as the
          single top heading; the app-level identity/search/notifications
          bar that used to sit above it now lives in the sidebar instead, so
          there's only ever one header on screen. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Page outlet — the sole scroll container in this layout */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowAnchor: 'none', display: 'flex', flexDirection: 'column' }}>
          {showPaywall ? <PaywallGate /> : <Outlet />}

          {/* Common footer — no `marginTop: auto` here on purpose. Dashboard-
              style pages load in several async stages (KPIs, charts,
              departments, the Insights section's own separate queries), each
              changing this column's content height. An auto margin
              recalculates on every one of those stages, so the footer would
              visibly jump — briefly pinned to the viewport bottom while
              content is still short, then shoved down as more loads in,
              landing on top of whatever hadn't rendered yet if you were
              already scrolled. Plain flow order means it only ever appears
              once, right after everything else, however long that turns
              out to be. */}
          <footer style={{
            borderTop: `1px solid ${colors.border.default}`,
            background: colors.surface.card,
            padding: '12px 28px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: colors.text.muted }}>
              © {new Date().getFullYear()} BeginablAI · All rights reserved
            </span>
            <span style={{ fontSize: 11, color: colors.text.muted }}>
              Powered by BeginablAI
            </span>
          </footer>
        </div>
      </div>
    </div>
  )
}
