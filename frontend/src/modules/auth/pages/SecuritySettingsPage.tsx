import { useLocation } from 'react-router-dom'
import EmployerSidebar from '@/modules/employer/components/EmployerSidebar'
import AppSidebar from '@/components/layout/AppSidebar'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ChangePasswordCard from '../components/ChangePasswordCard'
import { useAuthStore } from '@/stores/authStore'
import { EMPLOYER_ROLES } from '@/types'
import PageHeader from '@/shared/layouts/PageHeader'
import { colors } from '@/design-system/tokens'

// This page is reachable by both aspirant and employer roles, but sits outside
// both AspLayout's and EmployerLayout's route trees (no onboarding gate, no
// employer-approval gate) — so unlike other pages, it builds its own sidebar
// shell per role rather than relying on a route-level layout.
export default function SecuritySettingsPage() {
  const user = useAuthStore(s => s.user)
  const { pathname } = useLocation()
  const isEmployer = user ? EMPLOYER_ROLES.includes(user.role) : false

  const pageContent = (
    <>
      <PageHeader
        title="Security Settings"
        subtitle="Manage how you sign in to your account"
      />
      <div style={{ padding: '32px 36px', maxWidth: 680 }}>
        <TwoFactorSettings />
        <ChangePasswordCard />
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: colors.surface.bg }}>
      {isEmployer ? <EmployerSidebar /> : <AppSidebar activePath={pathname} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {pageContent}
      </div>
    </div>
  )
}
