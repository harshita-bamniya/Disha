import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import EmployerSidebar from './EmployerSidebar'
import { CommandBar } from './CommandBar'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { colors, spacing, shadows } from '@/design-system/tokens'
import NotificationBell from '@/components/NotificationBell'
import { useEmployerDashboard, useEmployerPermissions } from '../hooks/useJobs'

const ROLE_LABELS: Record<string, string> = {
  employer:        'Owner',
  employer_owner:  'Owner',
  hr_manager:      'HR Manager',
  hiring_manager:  'Hiring Manager',
  recruiter:       'Recruiter',
  interviewer:     'Interviewer',
}

export default function EmployerLayout() {
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { data: dashboard } = useEmployerDashboard()
  const { data: perms }     = useEmployerPermissions()

  const companyName  = dashboard?.company_name ?? '…'
  const isApproved   = dashboard?.is_approved ?? false
  const roleName     = perms?.role_name ?? ''
  const roleLabel    = ROLE_LABELS[roleName] ?? 'Member'

  return (
    <div style={{ minHeight: '100vh', background: colors.surface.bg, display: 'flex' }}>

      <EmployerSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />

      {/* Main content column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── Top header bar ─────────────────────────────────────────── */}
        <header style={{
          height: spacing.header,
          background: colors.surface.card,
          borderBottom: `1px solid ${colors.border.default}`,
          boxShadow: shadows.card,
          display: 'flex', alignItems: 'center',
          padding: `0 ${spacing.layout}px`,
          gap: 12, flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 100,
          paddingLeft: isMobile ? 68 : spacing.layout,
        }}>
          {/* Company identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 700, color: colors.text.ink,
                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '-0.1px',
              }}>
                {companyName}
              </p>
            </div>
            {/* Verification + role badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {isApproved ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: colors.state.success, background: colors.state.successBg, borderRadius: 6, padding: '2px 7px' }}>
                  <ShieldCheck size={10} /> Verified
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: colors.state.warning, background: colors.state.warningBg, borderRadius: 6, padding: '2px 7px' }}>
                  <AlertCircle size={10} /> Pending
                </span>
              )}
              {roleLabel && (
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.text.muted, background: colors.surface.elevated, borderRadius: 6, padding: '2px 7px' }}>
                  {roleLabel}
                </span>
              )}
            </div>
          </div>

          {/* Right side: command bar + notifications */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <CommandBar onPostJob={() => navigate('/app/employer/jobs')} />
            <NotificationBell />
          </div>
        </header>

        {/* Page outlet */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />

          {/* Common footer */}
          <footer style={{
            marginTop: 'auto',
            borderTop: `1px solid ${colors.border.default}`,
            background: colors.surface.card,
            padding: '12px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: colors.text.muted }}>
              © {new Date().getFullYear()} Disha · All rights reserved
            </span>
            <span style={{ fontSize: 11, color: colors.text.muted }}>
              Powered by BeginableAI
            </span>
          </footer>
        </div>
      </div>
    </div>
  )
}
