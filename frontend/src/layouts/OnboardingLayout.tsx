import { Link } from 'react-router-dom'
import {
  LogOut, CheckCircle2, User, GraduationCap, ClipboardList,
  Briefcase, Zap, Target, Brain,
} from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'Personal',     icon: User },
  { label: 'Education',    icon: GraduationCap },
  { label: 'UPSC Journey', icon: ClipboardList },
  { label: 'Experience',   icon: Briefcase },
  { label: 'Skills',       icon: Zap },
  { label: 'Preferences',  icon: Target },
  { label: 'Mindset',      icon: Brain },
]

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep: number   // 1-based
  title: string
  subtitle?: string
}

// Colors here are kept as literal #3B82F6/#1D4ED8 (not the bg-primary design
// token, which is navy #1E3A6B) — this matches Button.tsx's "primary" variant
// and every employer/onboarding page already built against this same blue.
// Unifying that with the navy admin-side token is a separate, larger design
// decision (which blue is "correct") — see docs/ENTERPRISE_AUDIT_ROADMAP.md.

export default function OnboardingLayout({ children, currentStep, title, subtitle }: OnboardingLayoutProps) {
  const pct = Math.round(((currentStep - 1) / STEPS.length) * 100)
  const logout = useLogout()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)' }}>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-6 border-b border-[#3B82F6]/[0.08] shadow-[0_2px_20px_rgba(30,58,95,0.05)]" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(16px)' }}>
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shadow-[0_3px_10px_rgba(59,130,246,0.3)]" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
            <span className="text-white font-extrabold text-sm">D</span>
          </div>
          <span className="font-display font-extrabold text-[17px] text-[#1E3A5F]">BeginablAI</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#3B82F6]/[0.06] border border-[#3B82F6]/[0.12] rounded-full px-3 py-1">
            <span className="text-xs font-semibold text-[#3B82F6]">
              Step {currentStep} of {STEPS.length}
            </span>
            <div className="w-9 h-[5px] rounded-full bg-[#3B82F6]/[0.12] overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3B82F6, #93C5FD)' }} />
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#DC2626] bg-transparent border-none cursor-pointer transition-colors px-2 py-1 rounded-md"
          >
            <LogOut size={13} />
            Log out
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-[3px] bg-[#3B82F6]/[0.08]">
        <div className="h-[3px] transition-[width] duration-[600ms] ease-out" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3B82F6, #93C5FD)' }} />
      </div>

      {/* Step pills — horizontal scroll */}
      <div className="border-b border-[#3B82F6]/[0.06] px-6 py-2.5 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }}>
        <div className="flex gap-1.5 w-max max-w-[780px] mx-auto">
          {STEPS.map((s, i) => {
            const stepNum = i + 1
            const done   = stepNum < currentStep
            const active = stepNum === currentStep
            const Icon = s.icon
            return (
              <div key={s.label} className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200',
                    active ? 'text-white shadow-[0_3px_10px_rgba(59,130,246,0.3)]' : done ? 'text-[#3B82F6] border border-[#3B82F6]/[0.15]' : 'text-gray-400 border border-transparent',
                    done && !active && 'bg-[#3B82F6]/[0.08]',
                    !done && !active && 'bg-black/[0.04]',
                  )}
                  style={active ? { background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' } : undefined}
                >
                  {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-4 h-[1.5px]', done ? 'bg-[#3B82F6]/30' : 'bg-black/[0.08]')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-[540px]">
          <div className="mb-7">
            <div className="flex items-center justify-between gap-2.5 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-display font-extrabold text-[13px] shadow-[0_4px_12px_rgba(59,130,246,0.3)]" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
                  {String(currentStep).padStart(2, '0')}
                </div>
                <div className="text-[11px] font-bold text-[#3B82F6] bg-[#3B82F6]/[0.07] px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  {STEPS[currentStep - 1]?.label}
                </div>
              </div>
            </div>
            <h1 className="font-display text-2xl font-black text-[#1E3A5F] mb-1.5 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 leading-relaxed">{subtitle}</p>
            )}
          </div>

          {/* Form card */}
          <div className="rounded-3xl border border-white/95 shadow-[0_12px_40px_rgba(30,58,95,0.08),0_2px_8px_rgba(30,58,95,0.04)] px-7 py-8" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
