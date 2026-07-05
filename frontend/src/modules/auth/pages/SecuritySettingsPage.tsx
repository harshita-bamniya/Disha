import AppSidebar from '@/components/layout/AppSidebar'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ChangePasswordCard from '../components/ChangePasswordCard'

export default function SecuritySettingsPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <AppSidebar activePath="/app/security" />
      <div style={{ flex: 1, minWidth: 0, padding: '32px 36px', background: '#FAFBFD', maxWidth: 680 }}>
        <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Hind, sans-serif' }}>
          Security
        </h1>
        <p className="text-sm text-gray-500 mb-6">Manage how you sign in to your account.</p>
        <TwoFactorSettings />
        <ChangePasswordCard />
      </div>
    </div>
  )
}
