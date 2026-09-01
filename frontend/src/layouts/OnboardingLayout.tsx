import { Link, useNavigate } from 'react-router-dom'
import { LogOut, CheckCircle2, User, GraduationCap, ClipboardList, Briefcase, Zap, Target, ChevronLeft } from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'

const N = {
  navy:  '#1A2744',
  white: '#FFFFFF',
  ink:   '#1E3A5F',
}

const STEPS = [
  {
    label: 'Personal',
    icon: User,
    desc: 'Your name, city, and basic background.',
  },
  {
    label: 'Education',
    icon: GraduationCap,
    desc: 'Degrees, stream, and university.',
  },
  {
    label: 'UPSC Journey',
    icon: ClipboardList,
    desc: 'Attempts, exams cleared, and current stage.',
  },
  {
    label: 'Experience',
    icon: Briefcase,
    desc: 'Work history and professional roles.',
  },
  {
    label: 'Skills',
    icon: Zap,
    desc: 'Key skills and areas of expertise.',
  },
  {
    label: 'Preferences',
    icon: Target,
    desc: 'Job type, location, and salary expectations.',
  },
]

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep: number   // 1-based
  title: string
  subtitle?: string
}

export default function OnboardingLayout({ children, currentStep, title, subtitle }: OnboardingLayoutProps) {
  const logout = useLogout()
  const navigate = useNavigate()
  const pct = Math.round(((currentStep - 1) / STEPS.length) * 100)
  const current = STEPS[currentStep - 1]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F5F7' }}>

      {/* ── Left panel — dark navy, step info ── */}
      <div style={{
        width: '42%', background: N.navy,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0, overflow: 'hidden',
      }} className="hidden lg:flex">

        {/* Texture circles */}
        <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: '-140px', right: '-140px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', bottom: '5%', left: '-80px', pointerEvents: 'none' }} />

        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>BeginableAI</span>
        </Link>

        {/* Step list */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Current step highlight */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.10)', border: '0.5px solid rgba(255,255,255,0.18)',
              borderRadius: 100, padding: '5px 14px', marginBottom: 16,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.3px' }}>
                Step {currentStep} of {STEPS.length}
              </span>
            </div>
            <h2 style={{
              fontSize: 28, fontWeight: 800, color: '#fff',
              lineHeight: 1.25, letterSpacing: '-0.4px', marginBottom: 10,
            }}>
              {current?.label}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 300 }}>
              {current?.desc}
            </p>
          </div>

          {/* Step list */}
          {STEPS.map((s, i) => {
            const num = i + 1
            const done = num < currentStep
            const active = num === currentStep
            const Icon = s.icon
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', position: 'relative' }}>
                {/* Left rail */}
                {active && (
                  <div style={{ position: 'absolute', left: -52, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, borderRadius: '0 3px 3px 0', background: '#fff' }} />
                )}
                {/* Icon / check */}
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'rgba(255,255,255,0.12)' : active ? '#fff' : 'rgba(255,255,255,0.05)',
                }}>
                  {done
                    ? <CheckCircle2 size={13} color="rgba(255,255,255,0.7)" />
                    : <Icon size={13} color={active ? N.navy : 'rgba(255,255,255,0.25)'} />
                  }
                </div>
                <span style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: done ? 'rgba(255,255,255,0.4)' : active ? '#fff' : 'rgba(255,255,255,0.2)',
                }}>
                  {s.label}
                </span>
                {done && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Done</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar + quote */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Profile completion</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 20 }}>
            "Your preparation was never wasted. It made you rare."
          </p>
          <button
            onClick={() => logout.mutate()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'rgba(255,255,255,0.25)', background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: 0, transition: 'color 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            <LogOut size={12} />
            Log out
          </button>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto', height: '100vh',
      }}>
        {/* Form area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px 64px' }}>
          <div style={{ width: '100%', maxWidth: 480 }}>

            {/* Step badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: N.navy, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>
                {String(currentStep).padStart(2, '0')}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {current?.label}
              </span>
            </div>

            <h1 style={{
              fontSize: 24, fontWeight: 800, color: N.ink,
              letterSpacing: '-0.3px', marginBottom: 6, lineHeight: 1.25,
            }}>{title}</h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, marginBottom: 32 }}>{subtitle}</p>
            )}
            {!subtitle && <div style={{ marginBottom: 32 }} />}

            {/* Card */}
            <div style={{
              background: N.white, borderRadius: 20,
              border: '0.5px solid rgba(0,0,0,0.08)',
              boxShadow: '0 4px 24px rgba(26,39,68,0.07)',
              padding: '32px',
            }}>
              {children}
            </div>

            {/* Back button — below card */}
            {currentStep > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <button
                  onClick={() => navigate(`/app/onboarding/step/${currentStep - 1}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 13, fontWeight: 500, color: '#9CA3AF',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', padding: '6px 12px', borderRadius: 8,
                    transition: 'color 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = N.ink}
                  onMouseOut={e => e.currentTarget.style.color = '#9CA3AF'}
                >
                  <ChevronLeft size={14} />
                  Go back to previous step
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
