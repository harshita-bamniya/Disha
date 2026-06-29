import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, ChevronRight, Sparkles } from 'lucide-react'
import { onboardingApi } from '@/api/onboarding'

interface RecommendedStep {
  label: string
  step: number
  done: boolean
}

function computeSteps(profile: Awaited<ReturnType<typeof onboardingApi.getProfile>> | undefined): RecommendedStep[] {
  if (!profile) return []
  return [
    { label: 'Add education details', step: 2, done: !!profile.highest_qualification },
    { label: 'Add your UPSC journey', step: 3, done: !!profile.upsc_exam },
    { label: 'Add work experience', step: 4, done: profile.has_work_experience !== null },
    { label: 'Add skills', step: 5, done: (profile.skills ?? []).length > 0 },
    { label: 'Set career preferences', step: 6, done: (profile.preferred_sectors ?? []).length > 0 },
    { label: 'Complete psychology assessment', step: 7, done: !!profile.motivation_type },
  ]
}

/** Shown on the dashboard once the mandatory quick-start step is done — every
 * remaining step here is optional and can be skipped indefinitely. Unlocking
 * the KRS score and tailored job matches is what nudges completion, not a gate. */
export default function ProfileCompletionCard() {
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['onboarding', 'profile'], queryFn: onboardingApi.getProfile })
  const steps = computeSteps(profile)

  if (steps.length === 0) return null

  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  if (pct === 100) return null

  return (
    <div style={{
      background: 'white', border: '1px solid #EEF2F9', borderRadius: 16,
      padding: '18px 20px', boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={15} color="#6366F1" />
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: 0 }}>Profile Completion</p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#6366F1' }}>{pct}%</span>
      </div>

      <div style={{ height: 6, background: '#EEF2F9', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #6366F1, #818CF8)', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Recommended next steps
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s) => (
          <button
            key={s.step}
            type="button"
            onClick={() => navigate(`/app/onboarding/step/${s.step}`)}
            disabled={s.done}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', textAlign: 'left',
              padding: '7px 0', cursor: s.done ? 'default' : 'pointer',
            }}
          >
            {s.done ? <CheckCircle2 size={15} color="#22C55E" /> : <Circle size={15} color="#CBD5E1" />}
            <span style={{ flex: 1, fontSize: 12.5, color: s.done ? '#94A3B8' : '#334155', textDecoration: s.done ? 'line-through' : 'none' }}>
              {s.label}
            </span>
            {!s.done && <ChevronRight size={13} color="#CBD5E1" />}
          </button>
        ))}
      </div>
    </div>
  )
}
