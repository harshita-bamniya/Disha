import { useState } from 'react'
import { Flame, TrendingUp, Clock, CalendarDays, Gauge, PlayCircle, Compass as ChallengeIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import { useOnboardingProfile } from '@/modules/onboarding/hooks/useOnboarding'
import { useSaveLearningSetup } from '@/modules/onboarding/hooks/useOnboarding'
import type { BurnoutLevel, ConfidenceLevel, SkillProficiency, LearningFormat, LearningChallenge } from '@/types'

type Option<T> = { value: T; label: string; sub?: string }

const BURNOUT_OPTIONS: Option<BurnoutLevel>[] = [
  { value: 'fresh',          label: 'Fresh and energised',  sub: 'I still have a lot of drive' },
  { value: 'somewhat_tired', label: 'Somewhat tired',       sub: 'But still motivated to keep going' },
  { value: 'exhausted',      label: 'Quite exhausted',      sub: 'I need a real change and rest' },
  { value: 'burnt_out',      label: 'Completely burnt out', sub: 'The journey has taken a real toll' },
]

const CONFIDENCE_OPTIONS: Option<ConfidenceLevel>[] = [
  { value: 'very_confident',       label: 'Very confident',       sub: 'I know exactly what I want' },
  { value: 'reasonably_confident', label: 'Reasonably confident', sub: 'Some uncertainty, but mostly positive' },
  { value: 'somewhat_unsure',      label: 'Somewhat unsure',      sub: 'Exploring what comes next' },
  { value: 'very_anxious',         label: 'Very anxious',         sub: 'The future feels unclear right now' },
]

const HOURS_OPTIONS = [
  { value: 5,  label: '~5 hrs/week' },
  { value: 10, label: '~10 hrs/week' },
  { value: 15, label: '~15 hrs/week' },
  { value: 20, label: '~20 hrs/week' },
  { value: 30, label: '30+ hrs/week' },
]

const FORMAT_OPTIONS: Option<LearningFormat>[] = [
  { value: 'video',    label: 'Videos',          sub: 'More YouTube tutorials in every module' },
  { value: 'reading',  label: 'Reading/articles', sub: 'More written guides, less video' },
  { value: 'hands_on', label: 'Hands-on practice', sub: 'Every module centers on a real build, not just watching' },
  { value: 'mixed',    label: 'A mix of everything', sub: 'Even split of videos and articles' },
]

const CHALLENGE_OPTIONS: Option<LearningChallenge>[] = [
  { value: 'motivation',            label: 'Staying consistent',        sub: 'Plan breaks work into small, visible wins' },
  { value: 'understanding_concepts', label: 'Understanding concepts',    sub: 'Plan leans toward beginner-friendly explainers' },
  { value: 'getting_started',       label: 'Knowing where to start',    sub: 'Plan orders resources from most to least basic' },
  { value: 'applying_practically',  label: 'Applying it practically',   sub: 'Plan gives you a real, concrete mini-project' },
]

const PROFICIENCY_ORDER: SkillProficiency[] = ['beginner', 'intermediate', 'advanced']
const PROFICIENCY_LABEL: Record<SkillProficiency, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}

function Section<T extends string>({
  icon: Icon, title, options, value, onChange, error, cols = 2,
}: {
  icon: React.ElementType
  title: string
  options: Option<T>[]
  value: T | ''
  onChange: (v: T) => void
  error?: string
  cols?: 2 | 4
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-secondary" />
        <label className="text-sm font-semibold text-gray-800">{title}</label>
      </div>
      <div className={cn('grid gap-2', cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
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
            {opt.sub && <span className="text-xs text-gray-400 leading-tight">{opt.sub}</span>}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

interface Props {
  onDone: () => void
}

/** One-time setup asked before a user's first roadmap/job-plan generation.
 * burnout/confidence directly shape job-plan pacing and tone
 * (jobs/plan_generator.py); weekly_hours/target_date/skill_proficiency close
 * gaps the roadmap-input audit found — pacing was a hardcoded 2hrs/day
 * constant and skill coverage was binary. */
export default function LearningSetupForm({ onDone }: Props) {
  const { data: profile } = useOnboardingProfile()
  const [burnoutLevel, setBurnoutLevel] = useState<BurnoutLevel | ''>('')
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel | ''>('')
  const [weeklyHours, setWeeklyHours] = useState<number | ''>('')
  const [targetDate, setTargetDate] = useState('')
  const [proficiency, setProficiency] = useState<Record<string, SkillProficiency>>({})
  const [learningFormat, setLearningFormat] = useState<LearningFormat | ''>('')
  const [learningChallenge, setLearningChallenge] = useState<LearningChallenge | ''>('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [prefilled, setPrefilled] = useState(false)

  const setup = useSaveLearningSetup()
  const skills = profile?.skills ?? []

  // Pre-fill from the last saved answers on a retake — burnout/confidence
  // aren't in ProfileResponse (only their derived scores are), so those two
  // stay blank and must be re-answered; hours/date/proficiency carry over.
  if (profile?.has_learning_setup && !prefilled) {
    setPrefilled(true)
    if (profile.weekly_study_hours) setWeeklyHours(profile.weekly_study_hours)
    if (profile.target_completion_date) setTargetDate(profile.target_completion_date)
    if (profile.skill_proficiency) setProficiency(profile.skill_proficiency as Record<string, SkillProficiency>)
    if (profile.preferred_learning_format) setLearningFormat(profile.preferred_learning_format as LearningFormat)
    if (profile.learning_challenge) setLearningChallenge(profile.learning_challenge as LearningChallenge)
  }

  const cycleProficiency = (skill: string) => {
    setProficiency((prev) => {
      const current = prev[skill] ?? 'intermediate'
      const next = PROFICIENCY_ORDER[(PROFICIENCY_ORDER.indexOf(current) + 1) % PROFICIENCY_ORDER.length]
      return { ...prev, [skill]: next }
    })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!burnoutLevel) e.burnout = 'Please answer this question'
    if (!confidenceLevel) e.confidence = 'Please answer this question'
    if (!weeklyHours) e.hours = 'Please select how much time you can give each week'
    if (!learningFormat) e.format = 'Please pick a format'
    if (!learningChallenge) e.challenge = 'Please pick what\'s hardest for you'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setup.mutate(
      {
        burnout_level: burnoutLevel as BurnoutLevel,
        confidence_level: confidenceLevel as ConfidenceLevel,
        weekly_study_hours: weeklyHours as number,
        target_completion_date: targetDate || undefined,
        skill_proficiency: Object.fromEntries(
          skills.map((s) => [s, proficiency[s] ?? 'intermediate']),
        ),
        preferred_learning_format: learningFormat as LearningFormat,
        learning_challenge: learningChallenge as LearningChallenge,
      },
      { onSuccess: onDone },
    )
  }

  const serverError = setup.error ? getApiError(setup.error) : null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Before we build your plan</h2>
      <p className="text-sm text-gray-500 mb-6">
        A few quick questions, asked once — each one actually changes what your plan looks like, not just decoration. We'll reuse these for every learning plan you generate from here on.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Section
          icon={Flame}
          title="How drained do you feel from your UPSC journey?"
          options={BURNOUT_OPTIONS}
          value={burnoutLevel}
          onChange={setBurnoutLevel}
          error={errors.burnout}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={TrendingUp}
          title="How confident are you about transitioning to private sector?"
          options={CONFIDENCE_OPTIONS}
          value={confidenceLevel}
          onChange={setConfidenceLevel}
          error={errors.confidence}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Clock}
          title="How much time can you realistically give each week?"
          options={HOURS_OPTIONS}
          value={weeklyHours}
          onChange={setWeeklyHours}
          error={errors.hours}
          cols={4}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={PlayCircle}
          title="How would you rather learn each skill?"
          options={FORMAT_OPTIONS}
          value={learningFormat}
          onChange={setLearningFormat}
          error={errors.format}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={ChallengeIcon}
          title="What's usually the hardest part for you?"
          options={CHALLENGE_OPTIONS}
          value={learningChallenge}
          onChange={setLearningChallenge}
          error={errors.challenge}
        />

        <div className="h-px bg-gray-100" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-secondary" />
            <label className="text-sm font-semibold text-gray-800">Target completion date</label>
            <span className="text-xs text-gray-400">(optional)</span>
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 w-full sm:w-64"
          />
        </div>

        {skills.length > 0 && (
          <>
            <div className="h-px bg-gray-100" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-secondary" />
                <label className="text-sm font-semibold text-gray-800">How well do you know each skill?</label>
              </div>
              <p className="text-xs text-gray-400 -mt-1">Tap a skill to cycle its level. Defaults to Intermediate.</p>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => {
                  const level = proficiency[skill] ?? 'intermediate'
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => cycleProficiency(skill)}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150 flex items-center gap-1.5',
                        level === 'beginner' && 'bg-amber-50 border-amber-200 text-amber-700',
                        level === 'intermediate' && 'bg-primary/5 border-primary/30 text-primary',
                        level === 'advanced' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
                      )}
                    >
                      {skill}
                      <span className="opacity-60">· {PROFICIENCY_LABEL[level]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {serverError && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={setup.isPending} className="mt-2">
          {setup.isPending ? 'Saving…' : 'Save & continue →'}
        </Button>
      </form>
    </div>
  )
}
