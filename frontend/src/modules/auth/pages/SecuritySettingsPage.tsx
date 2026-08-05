import AppSidebar from '@/components/layout/AppSidebar'
import EmployerSidebar from '@/modules/employer/components/EmployerSidebar'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ChangePasswordCard from '../components/ChangePasswordCard'
import { useAuthStore } from '@/stores/authStore'
import { EMPLOYER_ROLES } from '@/types'

export default function SecuritySettingsPage() {
  const user = useAuthStore(s => s.user)
  const isEmployer = user ? EMPLOYER_ROLES.includes(user.role) : false

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F5F7' }}>
      {isEmployer ? <EmployerSidebar /> : <AppSidebar activePath="/app/security" />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'white', borderBottom: '1px solid rgba(26,39,68,0.08)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Security</h1>
            <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>Manage how you sign in to your account</p>
          </div>
        </header>
        <div style={{ padding: '32px 36px', maxWidth: 680 }}>
          <TwoFactorSettings />
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  )
}
