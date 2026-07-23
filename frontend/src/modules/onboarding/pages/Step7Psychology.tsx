import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, TrendingUp, Wallet, Target, Flame, Users, Compass } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'
import type {
  BurnoutLevel, ConfidenceLevel, FinancialPressure,
  RiskTolerance, MotivationType, IdentityAttachment, SupportSystem,
} from '@/types'

// ── Question option helpers ───────────────────────────────────────────────────

type Option<T> = { value: T; label: string; sub?: string }

const BURNOUT_OPTIONS: Option<BurnoutLevel>[] = [
  { value: 'fresh',          label: 'Fresh and energised',         sub: 'I still have a lot of drive' },
  { value: 'somewhat_tired', label: 'Somewhat tired',              sub: 'But still motivated to keep going' },
  { value: 'exhausted',      label: 'Quite exhausted',             sub: 'I need a real change and rest' },
  { value: 'burnt_out',      label: 'Completely burnt out',        sub: 'The journey has taken a real toll' },
]

const CONFIDENCE_OPTIONS: Option<ConfidenceLevel>[] = [
  { value: 'very_confident',       label: 'Very confident',       sub: 'I know exactly what I want' },
  { value: 'reasonably_confident', label: 'Reasonably confident', sub: 'Some uncertainty, but mostly positive' },
  { value: 'somewhat_unsure',      label: 'Somewhat unsure',      sub: 'Exploring what comes next' },
  { value: 'very_anxious',         label: 'Very anxious',         sub: 'The future feels unclear right now' },
]

const PRESSURE_OPTIONS: Option<FinancialPressure>[] = [
  { value: 'no_rush',              label: 'No urgency',            sub: 'I have time and support' },
  { value: 'some_pressure',        label: 'Some pressure',         sub: 'Would like to start within 6 months' },
  { value: 'significant_pressure', label: 'Significant pressure',  sub: 'Need to start earning soon' },
  { value: 'urgent',               label: 'Urgent',                sub: 'Immediate financial need' },
]

const RISK_OPTIONS: Option<RiskTolerance>[] = [
  { value: 'low',    label: 'Prefer stability',        sub: 'Safety and predictability first' },
  { value: 'medium', label: 'Calculated risks',        sub: 'Willing to try, but thoughtfully' },
  { value: 'high',   label: 'Bold moves',              sub: 'Open to big opportunities even with risk' },
]

const MOTIVATION_OPTIONS: Option<MotivationType>[] = [
  { value: 'intrinsic', label: 'Meaningful work',      sub: 'Personal satisfaction drives me' },
  { value: 'extrinsic', label: 'Recognition & reward', sub: 'Salary, status, and impact matter most' },
  { value: 'mixed',     label: 'Both equally',         sub: 'I need both purpose and reward' },
]

const IDENTITY_OPTIONS: Option<IdentityAttachment>[] = [
  { value: 'low',    label: 'I\'ve moved on mentally', sub: 'Ready for a new chapter' },
  { value: 'medium', label: 'Somewhat attached',       sub: 'Still processing, but evolving' },
  { value: 'high',   label: 'Deeply attached',         sub: 'UPSC is still core to who I am' },
]

const SUPPORT_OPTIONS: Option<SupportSystem>[] = [
  { value: 'strong',    label: 'Strong support',  sub: 'Family & friends are fully behind me' },
  { value: 'moderate',  label: 'Mixed support',   sub: 'Some understand, some don\'t' },
  { value: 'weak',      label: 'Mostly alone',    sub: 'Navigating this transition on my own' },
]

// ── Section component ─────────────────────────────────────────────────────────

function Section<T extends string>({
  icon: Icon,
  title,
  options,
  value,
  onChange,
  error,
  cols = 2,
}: {
  icon: React.ElementType
  title: string
  options: Option<T>[]
  value: T | ''
  onChange: (v: T) => void
  error?: string
  cols?: 2 | 3 | 4
}) {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[cols]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-secondary" />
        <label className="text-sm font-semibold text-gray-800">{title}</label>
      </div>
      <div className={cn('grid gap-2', gridClass)}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all duration-150 flex flex-col gap-0.5',
              value === opt.value
                ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                : 'bg-white border-gray-200 hover:border-primary/40',
            )}
          >
            <span className={cn('text-sm font-semibold', value === opt.value ? 'text-primary' : 'text-gray-800')}>
              {opt.label}
            </span>
            {opt.sub && (
              <span className="text-xs text-gray-400 leading-tight">{opt.sub}</span>
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

// ── BeginablAI Insight card shown after successful submission ──────────────────────

function InsightCard({ insight, onContinue }: { insight: string; onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-sm font-semibold text-primary">BeginablAI says</span>
        </div>
        <p className="text-gray-700 text-sm leading-relaxed italic">"{insight}"</p>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500 mb-4">Your profile is complete. Your KRS score and career matches are being calculated.</p>
        <Button onClick={onContinue} fullWidth size="lg">
          Go to my dashboard →
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step7Psychology() {
  const [burnoutLevel, setBurnoutLevel]         = useState<BurnoutLevel | ''>('')
  const [confidenceLevel, setConfidenceLevel]   = useState<ConfidenceLevel | ''>('')
  const [financialPressure, setFinancialPressure] = useState<FinancialPressure | ''>('')
  const [riskTolerance, setRiskTolerance]       = useState<RiskTolerance | ''>('')
  const [motivationType, setMotivationType]     = useState<MotivationType | ''>('')
  const [identityAttachment, setIdentityAttachment] = useState<IdentityAttachment | ''>('')
  const [supportSystem, setSupportSystem]       = useState<SupportSystem | ''>('')
  const [errors, setErrors]                     = useState<Record<string, string>>({})
  const [insight, setInsight]                   = useState<string | null>(null)

  const { psychology } = useOnboardingSteps()
  const navigate = useNavigate()

  const validate = () => {
    const e: Record<string, string> = {}
    if (!burnoutLevel)       e.burnout    = 'Please answer this question'
    if (!confidenceLevel)    e.confidence = 'Please answer this question'
    if (!financialPressure)  e.pressure   = 'Please answer this question'
    if (!riskTolerance)      e.risk       = 'Please answer this question'
    if (!motivationType)     e.motivation = 'Please answer this question'
    if (!identityAttachment) e.identity   = 'Please answer this question'
    if (!supportSystem)      e.support    = 'Please answer this question'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    psychology.mutate(
      {
        burnout_level: burnoutLevel as BurnoutLevel,
        confidence_level: confidenceLevel as ConfidenceLevel,
        financial_pressure: financialPressure as FinancialPressure,
        risk_tolerance: riskTolerance as RiskTolerance,
        motivation_type: motivationType as MotivationType,
        identity_attachment: identityAttachment as IdentityAttachment,
        support_system: supportSystem as SupportSystem,
      },
      {
        onSuccess: (data) => {
          if (data.disha_insight) {
            setInsight(data.disha_insight)
          } else {
            navigate('/app/dashboard')
          }
        },
      },
    )
  }

  const serverError = psychology.error ? getApiError(psychology.error) : null

  // Show BeginablAI insight card after successful submission
  if (insight) {
    return (
      <OnboardingLayout
        currentStep={7}
        title="BeginablAI has heard you"
        subtitle="Here's what we see in your story so far."
      >
        <InsightCard insight={insight} onContinue={() => navigate('/app/dashboard')} />
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout
      currentStep={7}
      title="Your mindset & readiness"
      subtitle="Honest answers here shape everything BeginablAI recommends. There are no wrong answers."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        <Section
          icon={Flame}
          title="How drained do you feel from your UPSC journey?"
          options={BURNOUT_OPTIONS}
          value={burnoutLevel}
          onChange={setBurnoutLevel}
          error={errors.burnout}
          cols={2}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={TrendingUp}
          title="How confident are you about transitioning to private sector?"
          options={CONFIDENCE_OPTIONS}
          value={confidenceLevel}
          onChange={setConfidenceLevel}
          error={errors.confidence}
          cols={2}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Wallet}
          title="How much financial pressure are you under to start earning?"
          options={PRESSURE_OPTIONS}
          value={financialPressure}
          onChange={setFinancialPressure}
          error={errors.pressure}
          cols={2}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Target}
          title="How do you feel about taking risks for career growth?"
          options={RISK_OPTIONS}
          value={riskTolerance}
          onChange={setRiskTolerance}
          error={errors.risk}
          cols={3}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Heart}
          title="What motivates you more?"
          options={MOTIVATION_OPTIONS}
          value={motivationType}
          onChange={setMotivationType}
          error={errors.motivation}
          cols={3}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Compass}
          title="How attached are you to your identity as a 'UPSC aspirant'?"
          options={IDENTITY_OPTIONS}
          value={identityAttachment}
          onChange={setIdentityAttachment}
          error={errors.identity}
          cols={3}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Users}
          title="How strong is your support system for this transition?"
          options={SUPPORT_OPTIONS}
          value={supportSystem}
          onChange={setSupportSystem}
          error={errors.support}
          cols={3}
        />

        {serverError && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard')}
            className="text-sm font-medium text-gray-500 hover:text-primary transition-colors px-2 py-2 whitespace-nowrap"
          >
            Skip for now
          </button>
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={psychology.isPending}
          >
            {psychology.isPending ? 'BeginablAI is listening…' : 'Complete Registration →'}
          </Button>
        </div>

        <p className="text-xs text-center text-gray-400">
          Your answers are private and used only to personalise your BeginablAI experience.
        </p>
      </form>
    </OnboardingLayout>
  )
}
