import { useState } from 'react'
import { Clock, CalendarDays, Gauge, PlayCircle, Layers, Wallet, Languages, Timer, CalendarCheck, Target, ListChecks } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import { useOnboardingProfile } from '@/modules/onboarding/hooks/useOnboarding'
import { useSaveLearningSetup } from '@/modules/onboarding/hooks/useOnboarding'
import type { SkillProficiency, LearningFormat } from '@/types'
import type { LearningStage, LearningBudget, PreferredLanguage, SessionLength, StudyDays, DeadlineReason, PracticeStyle } from '@/api/onboarding'

type Option<T> = { value: T; label: string; sub?: string }

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

const STAGE_OPTIONS: Option<LearningStage>[] = [
  { value: 'new_to_field',     label: 'New to this kind of work', sub: 'Videos start at beginner level' },
  { value: 'some_exposure',    label: 'Some exposure',            sub: 'Beginner videos, refreshers where you know it' },
  { value: 'working_in_field', label: 'Already working in it',    sub: 'Videos are pitched at intermediate level' },
]

const SESSION_OPTIONS: Option<SessionLength>[] = [
  { value: 'short',  label: '30 minutes', sub: 'Short, frequent sittings' },
  { value: 'medium', label: '1 hour',     sub: 'One focused hour at a time' },
  { value: 'long',   label: '2 hours or more', sub: 'Long, deep sittings' },
]

const DAYS_OPTIONS: Option<StudyDays>[] = [
  { value: 'weekdays',  label: 'Weekdays',  sub: 'Monday to Friday' },
  { value: 'weekends',  label: 'Weekends',  sub: 'Saturday and Sunday' },
  { value: 'every_day', label: 'Every day', sub: 'A little each day' },
]

const PRACTICE_OPTIONS: Option<PracticeStyle>[] = [
  { value: 'quizzes',  label: 'Quizzes',        sub: 'Short self-check quizzes after each module' },
  { value: 'projects', label: 'Mini-projects',  sub: 'Build something real for each module' },
  { value: 'both',     label: 'Both',           sub: 'Quizzes and projects' },
  { value: 'none',     label: 'Neither',        sub: 'Just the learning material, no practice tasks' },
]

const DEADLINE_OPTIONS: Option<DeadlineReason>[] = [
  { value: 'interview',   label: 'An interview',        sub: 'Shows what you can finish before it' },
  { value: 'application', label: 'An application deadline', sub: 'Shows what you can finish before it' },
  { value: 'no_rush',     label: 'No rush',             sub: 'Just a personal goal' },
]

const BUDGET_OPTIONS: Option<LearningBudget>[] = [
  { value: 'free_only', label: 'Free only',          sub: 'Hides resources behind a paywall' },
  { value: 'flexible',  label: 'I can pay for good courses', sub: 'Nothing is hidden' },
]

const LANGUAGE_OPTIONS: Option<PreferredLanguage>[] = [
  { value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' }, { value: 'bn', label: 'Bengali' }, { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' }, { value: 'kn', label: 'Kannada' }, { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
]

const PROFICIENCY_ORDER: SkillProficiency[] = ['beginner', 'intermediate', 'advanced']
const PROFICIENCY_LABEL: Record<SkillProficiency, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}

function Section<T extends string | number>({
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

/** One-time setup asked before a user's first roadmap. Every answer changes the generated plan:
 * hours/week, session length and study days shape the weekly schedule; learning format and practice style
 * decide what each module contains; stage, budget and language choose the resources; the target date and
 * what it is for decide how the plan is paced against a deadline. */
export default function LearningSetupForm({ onDone }: Props) {
  const { data: profile } = useOnboardingProfile()
  const [weeklyHours, setWeeklyHours] = useState<number | ''>('')
  const [targetDate, setTargetDate] = useState('')
  const [proficiency, setProficiency] = useState<Record<string, SkillProficiency>>({})
  const [learningFormat, setLearningFormat] = useState<LearningFormat | ''>('')
  const [learningStage, setLearningStage] = useState<LearningStage | ''>('')
  const [learningBudget, setLearningBudget] = useState<LearningBudget | ''>('')
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage | ''>('')
  const [sessionLength, setSessionLength] = useState<SessionLength | ''>('')
  const [studyDays, setStudyDays] = useState<StudyDays | ''>('')
  const [practiceStyle, setPracticeStyle] = useState<PracticeStyle | ''>('')
  const [deadlineReason, setDeadlineReason] = useState<DeadlineReason | ''>('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [prefilled, setPrefilled] = useState(false)

  const setup = useSaveLearningSetup()
  const skills = profile?.skills ?? []

  // Pre-fill from the last saved answers on a retake.
  if (profile?.has_learning_setup && !prefilled) {
    setPrefilled(true)
    if (profile.weekly_study_hours) setWeeklyHours(profile.weekly_study_hours)
    if (profile.target_completion_date) setTargetDate(profile.target_completion_date)
    if (profile.skill_proficiency) setProficiency(profile.skill_proficiency as Record<string, SkillProficiency>)
    if (profile.preferred_learning_format) setLearningFormat(profile.preferred_learning_format as LearningFormat)
    if (profile.learning_stage) setLearningStage(profile.learning_stage as LearningStage)
    if (profile.learning_budget) setLearningBudget(profile.learning_budget as LearningBudget)
    if (profile.preferred_language) setPreferredLanguage(profile.preferred_language as PreferredLanguage)
    if (profile.session_length) setSessionLength(profile.session_length as SessionLength)
    if (profile.study_days) setStudyDays(profile.study_days as StudyDays)
    if (profile.practice_style) setPracticeStyle(profile.practice_style as PracticeStyle)
    if (profile.deadline_reason) setDeadlineReason(profile.deadline_reason as DeadlineReason)
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
    if (!weeklyHours) e.hours = 'Please select how much time you can give each week'
    if (!learningFormat) e.format = 'Please pick a format'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setup.mutate(
      {
        weekly_study_hours: weeklyHours as number,
        target_completion_date: targetDate || undefined,
        skill_proficiency: Object.fromEntries(
          skills.map((s) => [s, proficiency[s] ?? 'intermediate']),
        ),
        preferred_learning_format: learningFormat as LearningFormat,
        learning_stage: learningStage || undefined,
        learning_budget: learningBudget || undefined,
        preferred_language: preferredLanguage || undefined,
        session_length: sessionLength || undefined,
        study_days: studyDays || undefined,
        practice_style: practiceStyle || undefined,
        deadline_reason: targetDate && deadlineReason ? deadlineReason : undefined,
      },
      { onSuccess: onDone },
    )
  }

  const serverError = setup.error ? getApiError(setup.error) : null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Before we build your plan</h2>
      <p className="text-sm text-gray-500 mb-6">
        A few quick questions, asked once. Each answer changes your plan: how long it takes, how it is split into study sessions, what each module contains, and which resources we pick. We'll reuse them for every plan you generate.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Section
          icon={Clock}
          title="How much time can you realistically give each week?"
          options={HOURS_OPTIONS}
          value={weeklyHours}
          onChange={setWeeklyHours}
          error={errors.hours}
          cols={4}
        />

        <Section
          icon={Timer}
          title="How long can you usually study in one sitting? (optional)"
          options={SESSION_OPTIONS}
          value={sessionLength}
          onChange={setSessionLength}
        />

        <Section
          icon={CalendarCheck}
          title="Which days do you study? (optional)"
          options={DAYS_OPTIONS}
          value={studyDays}
          onChange={setStudyDays}
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

        <Section
          icon={ListChecks}
          title="How do you like to practise? (optional)"
          options={PRACTICE_OPTIONS}
          value={practiceStyle}
          onChange={setPracticeStyle}
        />

        <div className="h-px bg-gray-100" />

        <Section
          icon={Layers}
          title="Where are you with this kind of work? (optional)"
          options={STAGE_OPTIONS}
          value={learningStage}
          onChange={setLearningStage}
        />

        <Section
          icon={Wallet}
          title="What's your budget for learning resources? (optional)"
          options={BUDGET_OPTIONS}
          value={learningBudget}
          onChange={setLearningBudget}
        />

        <Section
          icon={Languages}
          title="Which language should videos be in? (optional)"
          options={LANGUAGE_OPTIONS}
          value={preferredLanguage}
          onChange={setPreferredLanguage}
          cols={4}
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

        {targetDate && (
          <Section
            icon={Target}
            title="What is this date for? (optional)"
            options={DEADLINE_OPTIONS}
            value={deadlineReason}
            onChange={setDeadlineReason}
          />
        )}

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
