import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Button from '@/components/ui/Button'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import SkillPicker from '../components/SkillPicker'
import { getApiError } from '@/api/client'

const MAX_SKILLS = 10

export default function Step5Skills() {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const { skills } = useOnboardingSteps()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.length === 0) { setError('Please select at least 1 skill'); return }
    skills.mutate({ skills: selected })
  }

  const serverError = skills.error ? getApiError(skills.error) : null

  return (
    <OnboardingLayout
      currentStep={5}
      title="Your core skills"
      subtitle={`Select up to ${MAX_SKILLS} skills that best describe your strengths. Search below for anything not listed — if we don't have it yet, you can add it.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <SkillPicker
          selected={selected}
          onChange={(next) => { setSelected(next); setError('') }}
          maxSkills={MAX_SKILLS}
          onError={setError}
        />

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
            disabled={selected.length === 0}
          >
            Continue →
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
