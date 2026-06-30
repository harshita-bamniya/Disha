import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'

const PREDEFINED_SKILLS = [
  // Core analytical / research
  'Analytical Reasoning', 'Research & Analysis', 'Data Interpretation',
  'Data Analysis', 'Policy Research',
  // Communication & delivery
  'Report Writing', 'Essay Writing', 'Public Speaking',
  // Leadership & operations
  'Leadership', 'Management', 'Project Management', 'Strategic Planning',
  // Domain knowledge
  'Economics', 'Public Administration', 'Polity & Governance',
  'Ethics & Integrity', 'International Relations', 'Law & Legal Knowledge',
  'Stakeholder Engagement',
  // Proficiency
  'Communication', 'English Proficiency', 'Hindi Proficiency', 'Computer Skills',
  // UPSC subject knowledge
  'Science & Technology', 'Current Affairs', 'History', 'Geography', 'Environment',
  // Sector-specific
  'Teaching & Training', 'Budget & Finance',
]

const MAX_SKILLS = 10

export default function Step5Skills() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { skills } = useOnboardingSteps()
  const navigate = useNavigate()

  const toggle = (skill: string) => {
    setError('')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) {
        next.delete(skill)
      } else {
        if (next.size >= MAX_SKILLS) {
          setError(`You can select at most ${MAX_SKILLS} skills`)
          return prev
        }
        next.add(skill)
      }
      return next
    })
  }

  const addCustomSkill = () => {
    const skill = customInput.trim()
    if (!skill) return
    // Avoid duplicates (case-insensitive check)
    const existingLower = new Set([...selected].map(s => s.toLowerCase()))
    if (existingLower.has(skill.toLowerCase())) {
      setCustomInput('')
      return
    }
    if (selected.size >= MAX_SKILLS) {
      setError(`You can select at most ${MAX_SKILLS} skills`)
      return
    }
    setSelected(prev => new Set([...prev, skill]))
    setCustomInput('')
    setError('')
    inputRef.current?.focus()
  }

  const isPredefined = (skill: string) => PREDEFINED_SKILLS.includes(skill)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.size === 0) { setError('Please select at least 1 skill'); return }
    skills.mutate({ skills: Array.from(selected) })
  }

  const serverError = skills.error ? getApiError(skills.error) : null

  return (
    <OnboardingLayout
      currentStep={5}
      title="Your core skills"
      subtitle={`Select up to ${MAX_SKILLS} skills that best describe your strengths. Can't find yours? Add it below.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Predefined skill chips */}
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_SKILLS.map((skill) => {
            const isSelected = selected.has(skill)
            const isDisabled = !isSelected && selected.size >= MAX_SKILLS
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggle(skill)}
                disabled={isDisabled}
                className={cn(
                  'px-4 py-2 rounded-full border text-sm font-medium transition-all duration-150',
                  isSelected && 'bg-primary text-white border-primary',
                  !isSelected && !isDisabled && 'bg-white text-gray-600 border-gray-200 hover:border-primary/60',
                  isDisabled && 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed',
                )}
              >
                {skill}
              </button>
            )
          })}
        </div>

        {/* Custom skill input */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Add a skill not listed above
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
              placeholder="e.g. Machine Learning, Negotiation, SQL…"
              disabled={selected.size >= MAX_SKILLS}
              className={cn(
                'flex-1 h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                'disabled:bg-gray-50 disabled:text-gray-300',
                'border-gray-200',
              )}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              disabled={!customInput.trim() || selected.size >= MAX_SKILLS}
              className="shrink-0 h-11 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Selected skills — show custom ones with a distinct style */}
        {[...selected].some(s => !isPredefined(s)) && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400">Your custom skills:</p>
            <div className="flex flex-wrap gap-2">
              {[...selected].filter(s => !isPredefined(s)).map(skill => (
                <span
                  key={skill}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent text-sm font-medium rounded-full"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => toggle(skill)}
                    className="text-accent/60 hover:text-danger leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Counter + clear */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{selected.size} of {MAX_SKILLS} selected</span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => { setSelected(new Set()); setError('') }}
              className="text-danger hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {(error || serverError) && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {error || serverError}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/app/onboarding/step/6')}
            className="text-sm font-medium text-gray-500 hover:text-primary transition-colors px-2 py-2 whitespace-nowrap"
          >
            Skip for now
          </button>
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={skills.isPending}
            disabled={selected.size === 0}
          >
            Continue →
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
