import EmployerSidebar from '@/modules/employer/components/EmployerSidebar'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ChangePasswordCard from '../components/ChangePasswordCard'
import { useAuthStore } from '@/stores/authStore'
import { EMPLOYER_ROLES } from '@/types'
import AspLayout from '@/shared/layouts/AspLayout'
import PageHeader from '@/shared/layouts/PageHeader'
import { colors } from '@/design-system/tokens'

export default function SecuritySettingsPage() {
  const user = useAuthStore(s => s.user)
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

  // EmployerLayout is a Router <Outlet> wrapper and cannot wrap arbitrary children.
  // For employer users landing outside the /employer/* route tree, we compose
  // the same structural shell (sidebar + content column) using design tokens.
  if (isEmployer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', background: colors.surface.bg }}>
        <EmployerSidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {pageContent}
        </div>
      </div>
    )
  }

  return (
    <AspLayout activePath="/app/security">
      {pageContent}
    </AspLayout>
  )
}
