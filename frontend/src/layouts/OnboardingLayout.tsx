import { Link } from 'react-router-dom'
import { LogOut, CheckCircle2 } from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'

const STEPS = [
  { label: 'Personal',    emoji: '👤' },
  { label: 'Education',   emoji: '🎓' },
  { label: 'UPSC Journey',emoji: '📋' },
  { label: 'Experience',  emoji: '💼' },
  { label: 'Skills',      emoji: '⚡' },
  { label: 'Preferences', emoji: '🎯' },
  { label: 'Mindset',     emoji: '🧠' },
]

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep: number   // 1-based
  title: string
  subtitle?: string
}

export default function OnboardingLayout({ children, currentStep, title, subtitle }: OnboardingLayoutProps) {
  const pct = Math.round(((currentStep - 1) / STEPS.length) * 100)
  const logout = useLogout()

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <header style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(59,130,246,0.08)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 2px 20px rgba(30,58,95,0.05)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(59,130,246,0.3)',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>D</span>
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 17, color: '#1E3A5F' }}>DISHA AI</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6' }}>
              Step {currentStep} of {STEPS.length}
            </span>
            <div style={{
              width: 36, height: 5, borderRadius: 10, background: 'rgba(59,130,246,0.12)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, #3B82F6, #93C5FD)',
                borderRadius: 10, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.2s', padding: '4px 8px', borderRadius: 6,
            }}
            onMouseOver={e => e.currentTarget.style.color = '#DC2626'}
            onMouseOut={e => e.currentTarget.style.color = '#9CA3AF'}
          >
            <LogOut size={13} />
            Log out
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(59,130,246,0.08)' }}>
        <div style={{
          height: 3,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #3B82F6, #93C5FD)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Step pills — horizontal scroll */}
      <div style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(59,130,246,0.06)',
        padding: '10px 24px', overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 6, minWidth: 'max-content', maxWidth: 780, margin: '0 auto' }}>
          {STEPS.map((s, i) => {
            const stepNum = i + 1
            const done   = stepNum < currentStep
            const active = stepNum === currentStep
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  transition: 'all 0.25s',
                  background: done ? 'rgba(59,130,246,0.08)' : active ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' : 'rgba(0,0,0,0.04)',
                  color: done ? '#3B82F6' : active ? 'white' : '#9CA3AF',
                  border: active ? 'none' : done ? '1px solid rgba(59,130,246,0.15)' : '1px solid transparent',
                  boxShadow: active ? '0 3px 10px rgba(59,130,246,0.3)' : 'none',
                }}>
                  {done
                    ? <CheckCircle2 size={13} />
                    : <span style={{ fontSize: 13 }}>{s.emoji}</span>}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: 16, height: 1.5,
                    background: done ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.08)',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 540 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 13,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}>
                {String(currentStep).padStart(2, '0')}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#3B82F6',
                background: 'rgba(59,130,246,0.07)', padding: '3px 10px',
                borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {STEPS[currentStep - 1]?.label}
              </div>
            </div>
            <h1 style={{
              fontFamily: 'Hind, sans-serif', fontSize: 24, fontWeight: 900,
              color: '#1E3A5F', marginBottom: 6, letterSpacing: '-0.3px',
            }}>{title}</h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65 }}>{subtitle}</p>
            )}
          </div>

          {/* Form card */}
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.95)',
            boxShadow: '0 12px 40px rgba(30,58,95,0.08), 0 2px 8px rgba(30,58,95,0.04)',
            padding: '32px 28px',
          }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
