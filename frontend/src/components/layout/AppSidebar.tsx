import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, LogOut, BarChart2, FileText, Briefcase, Map, Zap,
  ChevronLeft, ChevronRight, MessageSquare, Brain, Heart, ShieldCheck,
  HelpCircle, Menu, X,
} from 'lucide-react'
import { useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { xpApi } from '@/api/xp'
import NotificationBell from '@/components/NotificationBell'

type NavPath =
  | '/app/dashboard'
  | '/app/profile'
  | '/app/skills/report'
  | '/app/resume'
  | '/app/interview'
  | '/app/mock-interview'
  | '/app/interview/setup'
  | '/app/counsellor'
  | '/app/jobs'
  | '/app/jobs/applications'
  | '/app/roadmap'
  | '/app/roadmap/history'
  | '/app/companion'
  | '/app/security'
  | '/app/support'

const MAIN_NAV: { icon: React.ReactNode; label: string; path: NavPath }[] = [
  { icon: <LayoutDashboard size={16} />, label: 'Dashboard',       path: '/app/dashboard'        },
  { icon: <BarChart2 size={16} />,       label: 'Skill Report',    path: '/app/skills/report'    },
  { icon: <Briefcase size={16} />,       label: 'Jobs',            path: '/app/jobs'              },
  { icon: <Map size={16} />,             label: 'My Roadmap',      path: '/app/roadmap/history'   },
  { icon: <FileText size={16} />,        label: 'My Applications', path: '/app/jobs/applications' },
  { icon: <Heart size={16} />,           label: 'Your Companion',  path: '/app/companion'         },
]

const TOOLS_NAV: { icon: React.ReactNode; label: string; path: NavPath }[] = [
  { icon: <FileText size={16} />,      label: 'Resume',        path: '/app/resume'          },
  { icon: <MessageSquare size={16} />, label: 'AI Interview',  path: '/app/interview/setup' },
  { icon: <Brain size={16} />,         label: 'AI Counsellor', path: '/app/counsellor'      },
]

const NAVY      = '#1E3A5F'
const NAVY_DARK = '#152D4A'
const W10 = 'rgba(255,255,255,0.10)'
const W15 = 'rgba(255,255,255,0.15)'
const W40 = 'rgba(255,255,255,0.40)'
const W60 = 'rgba(255,255,255,0.60)'
const W80 = 'rgba(255,255,255,0.80)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

function NavBtn({ icon, label, isActive, collapsed, onClick }: {
  icon: React.ReactNode; label: string; isActive: boolean; collapsed: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '10px 12px',
        borderRadius: 10, marginBottom: 2,
        background: isActive ? 'linear-gradient(135deg, #007FFF, #2563EB)' : 'transparent',
        color: isActive ? 'white' : W80,
        border: 'none', cursor: 'pointer', textAlign: 'left' as const,
        fontSize: 13, fontWeight: isActive ? 700 : 500, transition: 'all 0.2s',
        boxShadow: isActive ? '0 4px 12px rgba(37,99,235,0.35)' : 'none',
      }}
      onMouseOver={e => { if (!isActive) e.currentTarget.style.background = W10 }}
      onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      {!collapsed && <span style={{ marginLeft: 2 }}>{label}</span>}
    </button>
  )
}

export default function AppSidebar({ activePath }: { activePath?: NavPath }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data } = useKrsDashboard()
  const { data: xp } = useQuery({ queryKey: ['xp-summary'], queryFn: xpApi.getSummary, staleTime: 60_000 })

  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const go = useCallback((path: string) => {
    navigate(path)
    setMobileOpen(false)
  }, [navigate])

  useEffect(() => { setMobileOpen(false) }, [activePath])

  const name   = data?.full_name?.split(' ')[0] ?? 'Aspirant'
  const skills = data?.skills ?? []
  const isCollapsed = !isMobile && collapsed
  const sidebarW = isMobile ? 272 : (collapsed ? 64 : 260)

  const sidebar = (
    <aside style={{
      width: sidebarW,
      background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      boxShadow: '4px 0 24px rgba(15,30,60,0.18)',
      flexShrink: 0,
    }}>

      {/* Logo row */}
      <div style={{ padding: isCollapsed ? '20px 0' : '20px 20px', borderBottom: `1px solid ${W10}`, display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          {!isCollapsed && <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', flexShrink: 0 }}>BeginableAI</span>}
        </div>
        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: W10, border: `1px solid ${W15}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: W60, flexShrink: 0 }}>
            <X size={14} />
          </button>
        ) : !isCollapsed ? (
          <button onClick={() => setCollapsed(true)} title="Collapse" style={{ width: 26, height: 26, borderRadius: 7, background: W10, border: `1px solid ${W15}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: W60, flexShrink: 0 }}
            onMouseOver={e => { e.currentTarget.style.background = W15; e.currentTarget.style.color = 'white' }}
            onMouseOut={e => { e.currentTarget.style.background = W10; e.currentTarget.style.color = W60 }}>
            <ChevronLeft size={13} />
          </button>
        ) : null}
      </div>

      {/* User card */}
      {!isCollapsed ? (
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${W10}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #60A5FA, #007FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'white', boxShadow: '0 3px 10px rgba(59,130,246,0.4)' }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: `2px solid ${NAVY}` }} />
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{name}</p>
              <p style={{ fontSize: 11, color: W60, whiteSpace: 'nowrap' }}>{skills.length} skills · UPSC aspirant</p>
            </div>
            <NotificationBell audience="aspirant" />
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px 0', borderBottom: `1px solid ${W10}`, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #60A5FA, #007FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'white', boxShadow: '0 3px 10px rgba(59,130,246,0.4)' }}>
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: isCollapsed ? '12px 8px' : '12px 12px', flex: 1, overflowY: 'auto' }}>
        {!isCollapsed && <p style={{ fontSize: 10, fontWeight: 700, color: W40, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>Navigation</p>}
        {MAIN_NAV.map(item => (
          <NavBtn key={item.path} icon={item.icon} label={item.label} collapsed={isCollapsed}
            isActive={activePath === item.path || (item.path === '/app/roadmap/history' && !!activePath?.startsWith('/app/roadmap'))}
            onClick={() => go(item.path)} />
        ))}

        {!isCollapsed && <p style={{ fontSize: 10, fontWeight: 700, color: W40, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '12px 8px 6px', marginTop: 4, borderTop: `1px solid ${W10}` }}>Tools</p>}
        {isCollapsed && <div style={{ height: 1, background: W10, margin: '8px 0' }} />}
        {TOOLS_NAV.map(item => (
          <NavBtn key={item.path} icon={item.icon} label={item.label} collapsed={isCollapsed}
            isActive={activePath === item.path} onClick={() => go(item.path)} />
        ))}

        {isCollapsed && (
          <button onClick={() => setCollapsed(false)} title="Expand" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', marginTop: 8, borderRadius: 10, background: W10, border: `1px solid ${W15}`, cursor: 'pointer', color: W60, transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.background = W15; e.currentTarget.style.color = 'white' }}
            onMouseOut={e => { e.currentTarget.style.background = W10; e.currentTarget.style.color = W60 }}>
            <ChevronRight size={14} />
          </button>
        )}
      </nav>

      {/* XP */}
      {xp && !isCollapsed && (
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${W10}` }}>
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={12} color="#F59E0B" /><span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>Level {xp.level}</span></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: W80 }}>{xp.xp_total.toLocaleString()} XP</span>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.2)', borderRadius: 100, height: 4 }}>
              <div style={{ height: '100%', borderRadius: 100, width: `${Math.min(100, ((xp.xp_total % 500) / 500) * 100)}%`, background: 'linear-gradient(90deg, #F59E0B, #D97706)', transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: W40, marginTop: 4 }}>{xp.xp_to_next} XP to Level {xp.level + 1}</p>
          </div>
        </div>
      )}
      {xp && isCollapsed && (
        <div style={{ padding: '12px 0', borderTop: `1px solid ${W10}`, display: 'flex', justifyContent: 'center' }}>
          <div title={`Level ${xp.level}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Zap size={14} color="#F59E0B" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>{xp.level}</span>
          </div>
        </div>
      )}

      {/* Support + Security */}
      {[
        { label: 'Support',  path: '/app/support',  icon: <HelpCircle size={14} />  },
        { label: 'Security', path: '/app/security', icon: <ShieldCheck size={14} /> },
      ].map(item => (
        <div key={item.path} style={{ padding: isCollapsed ? '4px 0' : '4px 20px 0', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <button onClick={() => go(item.path)} title={isCollapsed ? item.label : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: isCollapsed ? 'auto' : '100%', padding: isCollapsed ? '10px' : '10px 12px', borderRadius: 10, background: (activePath as string) === item.path ? W10 : 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: W60, transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.background = W10; e.currentTarget.style.color = 'white' }}
            onMouseOut={e => { e.currentTarget.style.background = (activePath as string) === item.path ? W10 : 'transparent'; e.currentTarget.style.color = W60 }}>
            {item.icon}{!isCollapsed && item.label}
          </button>
        </div>
      ))}

      {/* Logout */}
      <div style={{ padding: isCollapsed ? '12px 0' : '8px 20px 16px', borderTop: `1px solid ${W10}`, marginTop: 8, display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <button onClick={() => logout.mutate()} title={isCollapsed ? 'Log out' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: isCollapsed ? 'auto' : '100%', padding: isCollapsed ? '10px' : '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#FCA5A5', transition: 'all 0.2s' }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#FEE2E2' }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.color = '#FCA5A5' }}>
          <LogOut size={14} />
          {!isCollapsed && 'Log out'}
        </button>
      </div>
    </aside>
  )

  /* ── Mobile: drawer overlay ── */
  if (isMobile) {
    return (
      <>
        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 1100,
            width: 42, height: 42, borderRadius: 12,
            background: NAVY, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(15,30,60,0.30)',
            opacity: mobileOpen ? 0 : 1,
            pointerEvents: mobileOpen ? 'none' : 'auto',
            transition: 'opacity 0.2s',
          }}
        >
          <Menu size={18} color="white" />
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
        )}

        {/* Drawer */}
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1100, height: '100vh', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
          {sidebar}
        </div>
      </>
    )
  }

  /* ── Desktop: sticky sidebar ── */
  return (
    <div style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0, width: sidebarW, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
      {sidebar}
    </div>
  )
}
