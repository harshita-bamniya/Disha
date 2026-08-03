import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, LogOut, FileText, Briefcase, Map,
  MessageSquare, Brain, Heart, ShieldCheck,
  HelpCircle, Menu, X, FolderOpen,
} from 'lucide-react'
import { useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import NotificationBell from '@/components/NotificationBell'

type NavPath =
  | '/app/dashboard'
  | '/app/profile'
  | '/app/resume'
  | '/app/resume-library'
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
  { icon: <Briefcase size={16} />,       label: 'Jobs',            path: '/app/jobs'              },
  { icon: <Map size={16} />,             label: 'My Roadmap',      path: '/app/roadmap/history'   },
  { icon: <FileText size={16} />,        label: 'My Applications', path: '/app/jobs/applications' },
  { icon: <Heart size={16} />,           label: 'Your Companion',  path: '/app/companion'         },
]

const TOOLS_NAV: { icon: React.ReactNode; label: string; path: NavPath }[] = [
  { icon: <FileText size={16} />,    label: 'Resume Builder', path: '/app/resume'          },
  { icon: <FolderOpen size={16} />,  label: 'Resume Library', path: '/app/resume-library'  },
  { icon: <MessageSquare size={16} />, label: 'AI Interview', path: '/app/interview/setup' },
  { icon: <Brain size={16} />,       label: 'AI Counsellor',  path: '/app/counsellor'      },
]

// Landing-page aligned palette — #1A2744 is the exact brand/CTA color from DishaLanding.tsx
const NAVY      = '#1A2744'
const NAVY_DARK = '#111C35'
const W08 = 'rgba(255,255,255,0.08)'
const W10 = 'rgba(255,255,255,0.10)'
const W15 = 'rgba(255,255,255,0.15)'
const W40 = 'rgba(255,255,255,0.40)'
const W60 = 'rgba(255,255,255,0.60)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

function NavBtn({ icon, label, isActive, onClick }: {
  icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 10, justifyContent: 'flex-start',
        padding: '9px 12px',
        borderRadius: isActive ? '0 9px 9px 0' : 10,
        marginBottom: 2,
        background: isActive ? W10 : 'transparent',
        color: isActive ? 'white' : W60,
        border: 'none',
        borderLeftWidth: isActive ? 2 : 0,
        borderLeftStyle: 'solid' as const,
        borderLeftColor: isActive ? 'rgba(255,255,255,0.65)' : 'transparent',
        cursor: 'pointer', textAlign: 'left' as const,
        fontSize: 13, fontWeight: isActive ? 700 : 500, transition: 'all 0.18s',
      }}
      onMouseOver={e => { if (!isActive) e.currentTarget.style.background = W08 }}
      onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      <span style={{ marginLeft: 2 }}>{label}</span>
    </button>
  )
}

export default function AppSidebar({ activePath }: { activePath?: NavPath }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data } = useKrsDashboard()
  const isMobile = useIsMobile()
  const [hidden, setHidden] = useState(false)      // desktop: sidebar fully hidden
  const [mobileOpen, setMobileOpen] = useState(false)

  const go = useCallback((path: string) => {
    navigate(path)
    setMobileOpen(false)
  }, [navigate])

  useEffect(() => { setMobileOpen(false) }, [activePath])

  const name   = data?.full_name?.split(' ')[0] ?? 'Aspirant'
  const skills = data?.skills ?? []

  const sidebar = (
    <aside style={{
      width: 260,
      background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      boxShadow: '4px 0 24px rgba(10,18,40,0.22)',
      flexShrink: 0,
    }}>

      {/* Logo row */}
      <div style={{ padding: '20px 20px', borderBottom: `1px solid ${W08}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>BeginableAI</span>
        {/* Close button: X on mobile, sidebar-hide on desktop */}
        <button
          onClick={() => isMobile ? setMobileOpen(false) : setHidden(true)}
          title={isMobile ? 'Close menu' : 'Hide sidebar'}
          style={{ width: 28, height: 28, borderRadius: 8, background: W10, border: `1px solid ${W15}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: W60, flexShrink: 0, transition: 'background 0.18s, color 0.18s' }}
          onMouseOver={e => { e.currentTarget.style.background = W15; e.currentTarget.style.color = 'white' }}
          onMouseOut={e => { e.currentTarget.style.background = W10; e.currentTarget.style.color = W60 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* User card */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${W08}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 15, color: 'white',
            }}>
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

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1, overflowY: 'auto' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: W40, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>Navigation</p>
        {MAIN_NAV.map(item => (
          <NavBtn key={item.path} icon={item.icon} label={item.label}
            isActive={activePath === item.path || (item.path === '/app/roadmap/history' && !!activePath?.startsWith('/app/roadmap'))}
            onClick={() => go(item.path)} />
        ))}

        <p style={{ fontSize: 10, fontWeight: 700, color: W40, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '12px 8px 6px', marginTop: 4, borderTop: `1px solid ${W08}` }}>Tools</p>
        {TOOLS_NAV.map(item => (
          <NavBtn key={item.path} icon={item.icon} label={item.label}
            isActive={activePath === item.path} onClick={() => go(item.path)} />
        ))}

        {/* Support + Security sit directly below Tools */}
        <div style={{ height: 1, background: W08, margin: '8px 0' }} />
        {[
          { label: 'Support',  path: '/app/support',  icon: <HelpCircle size={14} />  },
          { label: 'Security', path: '/app/security', icon: <ShieldCheck size={14} /> },
        ].map(item => (
          <button key={item.path} onClick={() => go(item.path)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, marginBottom: 2,
              background: (activePath as string) === item.path ? W10 : 'transparent',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: W60,
              transition: 'all 0.18s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = W08; e.currentTarget.style.color = 'white' }}
            onMouseOut={e => { e.currentTarget.style.background = (activePath as string) === item.path ? W10 : 'transparent'; e.currentTarget.style.color = W60 }}>
            {item.icon}{item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '8px 20px 16px', borderTop: `1px solid ${W08}`, marginTop: 8 }}>
        <button onClick={() => logout.mutate()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)', transition: 'all 0.2s' }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}>
          <LogOut size={14} />Log out
        </button>
      </div>
    </aside>
  )

  /* ── Mobile: drawer overlay ── */
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 1100,
            width: 42, height: 42, borderRadius: 12,
            background: NAVY, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(10,18,40,0.30)',
            opacity: mobileOpen ? 0 : 1,
            pointerEvents: mobileOpen ? 'none' : 'auto',
            transition: 'opacity 0.2s',
          }}
        >
          <Menu size={18} color="white" />
        </button>

        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
        )}

        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1100, height: '100vh', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
          {sidebar}
        </div>
      </>
    )
  }

  /* ── Desktop: full sidebar or floating restore button ── */
  return (
    <>
      {/* Floating restore button — appears when sidebar is hidden */}
      {hidden && (
        <button
          onClick={() => setHidden(false)}
          aria-label="Show sidebar"
          title="Show sidebar"
          style={{
            position: 'fixed', top: 16, left: 16, zIndex: 200,
            width: 42, height: 42, borderRadius: 12,
            background: NAVY, border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(10,18,40,0.35)',
            transition: 'box-shadow 0.2s, background 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#243359'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(10,18,40,0.45)' }}
          onMouseOut={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,18,40,0.35)' }}
        >
          <Menu size={18} color="white" />
        </button>
      )}

      {/* Sidebar wrapper — slides in/out by animating width */}
      <div style={{
        width: hidden ? 0 : 260,
        flexShrink: 0,
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        height: '100vh',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {sidebar}
      </div>
    </>
  )
}
