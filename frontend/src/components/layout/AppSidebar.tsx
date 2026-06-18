import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Compass, LogOut, BarChart2, FileText, Briefcase, Map, Zap, ChevronLeft, ChevronRight, GraduationCap, MessageSquare, Brain } from 'lucide-react'
import { useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { xpApi } from '@/api/xp'

type NavPath =
  | '/app/dashboard'
  | '/app/careers/explore'
  | '/app/profile'
  | '/app/careers'
  | '/app/skills/report'
  | '/app/learn'
  | '/app/resume'
  | '/app/interview'
  | '/app/mock-interview'
  | '/app/interview/setup'
  | '/app/counsellor'
  | '/app/jobs'
  | '/app/jobs/applications'
  | '/app/roadmap'

// Main app navigation — shown everywhere except inside the Roadmap's tool pages.
const MAIN_NAV_ITEMS: { icon: React.ReactNode; label: string; path: NavPath }[] = [
  { icon: <LayoutDashboard size={16} />, label: 'Dashboard',       path: '/app/dashboard'          },
  { icon: <BarChart2 size={16} />,       label: 'Skill Report',    path: '/app/skills/report'      },
  { icon: <Compass size={16} />,         label: 'Career Paths',    path: '/app/careers'             },
  { icon: <Briefcase size={16} />,       label: 'Jobs',            path: '/app/jobs'                },
  { icon: <Map size={16} />,             label: 'My Roadmap',      path: '/app/roadmap'             },
  { icon: <FileText size={16} />,        label: 'My Applications', path: '/app/jobs/applications'   },
]


export default function AppSidebar({ activePath }: { activePath?: NavPath }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data } = useKrsDashboard()
  const { data: xp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: xpApi.getSummary,
    staleTime: 60 * 1000,
  })
  const [collapsed, setCollapsed] = useState(false)

  const name  = data?.full_name?.split(' ')[0] ?? 'Aspirant'
  const skills = data?.skills ?? []
  const w = collapsed ? 64 : 260
  const navItems = MAIN_NAV_ITEMS

  return (
    <aside style={{
      width: w, flexShrink: 0,
      background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(59,130,246,0.08)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      boxShadow: '4px 0 24px rgba(30,58,95,0.04)',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* Logo + collapse toggle */}
      <div style={{ padding: collapsed ? '20px 0' : '20px 20px', borderBottom: '1px solid rgba(59,130,246,0.07)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 17 }}>D</span>
          </div>
          {!collapsed && <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F', whiteSpace: 'nowrap' }}>DISHA AI</span>}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748B', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.color = '#3B82F6' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.color = '#64748B' }}
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {/* User greeting */}
      {!collapsed && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(59,130,246,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))',
              border: '2px solid rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, color: '#3B82F6',
            }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', whiteSpace: 'nowrap' }}>{name}</p>
              <p style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{skills.length} skills · UPSC aspirant</p>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(59,130,246,0.07)', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))',
            border: '2px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: '#3B82F6',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ padding: collapsed ? '12px 8px' : '12px 12px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && (
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>
            Navigation
          </p>
        )}
        {navItems.map(item => {
          const isActive = activePath === item.path ||
            (activePath === '/app/careers' && item.path === '/app/careers')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 12, marginBottom: 2,
                background: isActive ? '#3B82F6' : 'transparent',
                color: isActive ? 'white' : '#6B7280',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.22)' : 'none',
              }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(59,130,246,0.06)' }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
              {!collapsed && item.label}
            </button>
          )
        })}

        {/* Tools section */}
        {!collapsed && (
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '12px 8px 6px', marginTop: 4, borderTop: '1px solid rgba(59,130,246,0.07)' }}>
            Tools
          </p>
        )}
        {collapsed && <div style={{ height: 1, background: 'rgba(59,130,246,0.07)', margin: '8px 0' }} />}
        {[
          { icon: <GraduationCap size={16} />, label: 'Learning',      path: '/app/learn' },
          { icon: <FileText size={16} />,      label: 'Resume',        path: '/app/resume' },
          { icon: <MessageSquare size={16} />, label: 'AI Interview',  path: '/app/interview/setup' },
          { icon: <Brain size={16} />,         label: 'AI Counsellor', path: '/app/counsellor' },
        ].map(item => {
          const isActive = activePath === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 12, marginBottom: 2,
                background: isActive ? '#3B82F6' : 'transparent',
                color: isActive ? 'white' : '#6B7280',
                border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.22)' : 'none',
              }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(59,130,246,0.06)' }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
              {!collapsed && item.label}
            </button>
          )
        })}

        {/* Expand button in collapsed mode */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', marginTop: 8,
              borderRadius: 12, background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.12)',
              cursor: 'pointer', color: '#3B82F6', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)' }}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </nav>

      {/* XP Bar */}
      {xp && !collapsed && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(59,130,246,0.07)' }}>
          <div style={{
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: 12, padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={12} color="#F59E0B" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>Level {xp.level}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F' }}>{xp.xp_total.toLocaleString()} XP</span>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: 100, height: 4 }}>
              <div style={{
                height: '100%', borderRadius: 100,
                width: `${Math.min(100, ((xp.xp_total % 500) / 500) * 100)}%`,
                background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{xp.xp_to_next} XP to Level {xp.level + 1}</p>
          </div>
        </div>
      )}
      {xp && collapsed && (
        <div style={{ padding: '12px 0', borderTop: '1px solid rgba(59,130,246,0.07)', display: 'flex', justifyContent: 'center' }}>
          <div title={`Level ${xp.level} · ${xp.xp_total.toLocaleString()} XP`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Zap size={14} color="#F59E0B" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>{xp.level}</span>
          </div>
        </div>
      )}

      {/* Logout */}
      <div style={{ padding: collapsed ? '12px 0' : '12px 20px', borderTop: '1px solid rgba(59,130,246,0.07)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <button onClick={() => logout.mutate()} title={collapsed ? 'Log out' : undefined} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: collapsed ? 'auto' : '100%',
          padding: collapsed ? '10px' : '10px 12px', borderRadius: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: '#9CA3AF', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />
          {!collapsed && 'Log out'}
        </button>
      </div>
    </aside>
  )
}
