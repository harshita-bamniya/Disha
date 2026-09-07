import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { useEmployerDashboard, useDashboardKpis, useEmployerPermissions } from '../hooks/useJobs'
import { colors } from '@/design-system/tokens'
import Sidebar from '@/shared/layouts/Sidebar'
import { buildEmployerNav } from '@/shared/config/navigation'

export default function EmployerSidebar({ collapsed, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void } = {}) {
  const { data: dashboard } = useEmployerDashboard()
  const { data: kpis } = useDashboardKpis()
  const { data: perms } = useEmployerPermissions()
  const logout = useLogout()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  const companyName = dashboard?.company_name ?? '…'
  const isApproved = dashboard?.is_approved ?? false
  const initial = companyName.charAt(0).toUpperCase()
  const activeJobs = kpis?.active_jobs ?? 0

  const roleName = perms?.role_name ?? ''
  const deptId = perms?.department_id ?? null
  const deptName = perms?.department_name ?? null
  const isWide = perms?.is_company_wide ?? true
  const isOwner = roleName === 'employer_owner' || (!roleName && isWide)
  const isHiringManager = roleName === 'hiring_manager'
  const isInterviewer = roleName === 'interviewer'
  const isDeptScoped = !isWide && !!deptId && !isHiringManager && !isInterviewer

  const contextLabel = isDeptScoped && deptName
    ? deptName
    : isHiringManager ? 'Hiring Manager'
    : isInterviewer ? 'Interviewer'
    : null

  const identity = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: colors.brand.navy,
        border: `1px solid ${colors.border.medium}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, color: 'white', flexShrink: 0,
      }}>
        {initial}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: colors.text.ink,
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{companyName}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          {contextLabel ? (
            <span style={{ fontSize: 11, color: 'rgba(26,39,68,0.60)' }}>{contextLabel}</span>
          ) : isApproved ? (
            <><CheckCircle2 size={10} color={colors.state.success} /><span style={{ fontSize: 11, color: 'rgba(26,39,68,0.60)', fontWeight: 500 }}>Verified</span></>
          ) : (
            <><AlertCircle size={10} color={colors.state.warning} /><span style={{ fontSize: 11, color: 'rgba(26,39,68,0.60)', fontWeight: 500 }}>Pending</span></>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Sidebar
      sections={buildEmployerNav({ isOwner, isDeptScoped, isHiringManager, isInterviewer, deptId, activeJobs })}
      pathname={pathname}
      search={search}
      identity={identity}
      onNavigate={navigate}
      onLogout={() => logout.mutate()}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  )
}
