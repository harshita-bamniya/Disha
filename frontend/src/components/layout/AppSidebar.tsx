import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import NotificationBell from '@/components/NotificationBell'
import { colors } from '@/design-system/tokens'
import Sidebar from '@/shared/layouts/Sidebar'
import { buildAspirantNav } from '@/shared/config/navigation'

export default function AppSidebar({ activePath }: { activePath?: string }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data } = useKrsDashboard()
  const [collapsed, setCollapsed] = useState(false)

  const name = data?.full_name?.split(' ')[0] ?? 'Aspirant'
  const skills = data?.skills ?? []

  const identity = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: colors.brand.navy,
          border: `1px solid ${colors.border.medium}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15, color: 'white',
        }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid white' }} />
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ fontSize: 11, color: 'rgba(26,39,68,0.60)', whiteSpace: 'nowrap' }}>{skills.length} skills · UPSC aspirant</p>
      </div>
      <NotificationBell audience="aspirant" />
    </div>
  )

  return (
    <Sidebar
      sections={buildAspirantNav()}
      pathname={activePath ?? ''}
      identity={identity}
      onNavigate={navigate}
      onLogout={() => logout.mutate()}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed(c => !c)}
    />
  )
}
