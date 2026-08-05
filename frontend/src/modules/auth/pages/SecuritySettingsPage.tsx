import EmployerSidebar from '@/modules/employer/components/EmployerSidebar'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ChangePasswordCard from '../components/ChangePasswordCard'
import { useAuthStore } from '@/stores/authStore'
import { EMPLOYER_ROLES } from '@/types'
import AspLayout from '@/shared/layouts/AspLayout'
import PageHeader from '@/shared/layouts/PageHeader'
import { tokens } from '@/design-system'

export default function SecuritySettingsPage() {
  const user = useAuthStore(s => s.user)
  const isEmployer = user ? EMPLOYER_ROLES.includes(user.role) : false

  const content = (
    <>
      <PageHeader title="Security" subtitle="Manage how you sign in to your account" />
      <div style={{ padding: '32px 36px', maxWidth: 680 }}>
        <TwoFactorSettings />
        <ChangePasswordCard />
      </div>
    </>
  )

  if (isEmployer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', background: tokens.color.surface.bg }}>
        <EmployerSidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <AspLayout activePath="/app/security">
      {content}
    </AspLayout>
  )
}
