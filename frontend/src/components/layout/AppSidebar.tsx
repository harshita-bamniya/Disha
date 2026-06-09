import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, BookOpen, UserCircle, Compass, LogOut, BarChart2, FileText, MessageSquare, GraduationCap, Brain, Briefcase } from 'lucide-react'
import { useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useLogout } from '@/modules/auth/hooks/useAuth'

// ── KRS Ring ──────────────────────────────────────────────────────────────────
function KrsRing({ value, size = 90, stroke = 7 }: {
  value: number; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  const color = '#3B82F6'
  const bg = 'rgba(59,130,246,0.12)'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 900, fontSize: size * 0.28, color: '#1E3A5F', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: size * 0.1, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>KRS</span>
      </div>
    </div>
  )
}

type NavPath =
  | '/app/dashboard'
  | '/app/careers/explore'
  | '/app/profile'
  | '/app/careers'
  | '/app/skills/report'
  | '/app/learn'
  | '/app/resume'
  | '/app/interview'
  | '/app/counsellor'
  | '/app/jobs'
  | '/app/jobs/applications'

const NAV_ITEMS: { icon: React.ReactNode; label: string; path: NavPath; section?: string }[] = [
  { icon: <LayoutDashboard size={16} />, label: 'Dashboard',    path: '/app/dashboard'       },
  { icon: <BarChart2 size={16} />,       label: 'Skill Report', path: '/app/skills/report'   },
  { icon: <Compass size={16} />,         label: 'Career Paths', path: '/app/careers'          },
  { icon: <UserCircle size={16} />,      label: 'Profile',      path: '/app/profile'          },
  // MVP2 items
  { icon: <GraduationCap size={16} />,   label: 'Learning',     path: '/app/learn',           section: 'mvp2' },
  { icon: <FileText size={16} />,        label: 'Resume',       path: '/app/resume',          section: 'mvp2' },
  { icon: <MessageSquare size={16} />,   label: 'Mock Interview', path: '/app/interview',     section: 'mvp2' },
  { icon: <Brain size={16} />,           label: 'AI Counsellor', path: '/app/counsellor',     section: 'mvp2' },
  // Phase 3 items
  { icon: <Briefcase size={16} />,       label: 'Jobs',         path: '/app/jobs',            section: 'phase3' },
]

export default function AppSidebar({ activePath }: { activePath: NavPath }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data } = useKrsDashboard()

  const name  = data?.full_name?.split(' ')[0] ?? 'Aspirant'
  const krs   = data?.krs
  const skills = data?.skills ?? []

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(59,130,246,0.08)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflow: 'auto',
      boxShadow: '4px 0 24px rgba(30,58,95,0.04)',
    }}>

      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(59,130,246,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 17 }}>D</span>
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F' }}>DISHA AI</span>
        </div>
      </div>

      {/* User greeting */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(59,130,246,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(147,197,253,0.18))',
            border: '2px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: '#3B82F6',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{name}</p>
            <p style={{ fontSize: 11, color: '#94A3B8' }}>{skills.length} skills · UPSC aspirant</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>Navigation</p>
        {NAV_ITEMS.filter(i => !i.section).map(item => {
          const isActive = activePath === item.path ||
            (activePath === '/app/careers' && item.path === '/app/careers')
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginBottom: 2,
              background: isActive ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' : 'transparent',
              color: isActive ? 'white' : '#6B7280',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.22)' : 'none',
            }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(59,130,246,0.06)' }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}

        {/* MVP2 tools section */}
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', margin: '14px 0 6px' }}>Tools</p>
        {NAV_ITEMS.filter(i => i.section === 'mvp2').map(item => {
          const isActive = activePath === item.path || (activePath as string).startsWith(item.path + '/')
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginBottom: 2,
              background: isActive ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : 'transparent',
              color: isActive ? 'white' : '#6B7280',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              boxShadow: isActive ? '0 4px 12px rgba(45,106,79,0.22)' : 'none',
            }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(45,106,79,0.06)' }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}

        {/* KRS Score card */}
        {krs && (
          <div style={{
            marginTop: 20, padding: 16,
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.14)',
            borderRadius: 16,
          }}>
            <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Your KRS Score</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <KrsRing value={krs.composite} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Knowledge', value: krs.k_score },
                { label: 'Readiness', value: krs.r_score },
                { label: 'Skills',    value: krs.s_score },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(59,130,246,0.07)', borderRadius: 10, padding: '8px 4px',
                  border: '1px solid rgba(59,130,246,0.1)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(59,130,246,0.07)' }}>
        <button onClick={() => logout.mutate()} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 12px', borderRadius: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: '#9CA3AF', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />Log out
        </button>
      </div>
    </aside>
  )
}
