import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'

const DOMAINS = [
  'Banking & Finance', 'Consulting', 'Defence', 'Education', 'Engineering',
  'Government', 'Healthcare', 'IT & Software', 'Law', 'Management', 'Media',
  'NGO / Social Work', 'Research', 'Retail', 'Other',
]

export default function Step4WorkExperience() {
  const [hasExp, setHasExp] = useState<boolean | null>(null)
  const [form, setForm] = useState({ work_experience_years: '', work_experience_domain: '', last_designation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { workExperience } = useOnboardingSteps()
  const navigate = useNavigate()

  const validate = () => {
    const e: Record<string, string> = {}
    if (hasExp === null) e.hasExp = 'Please select an option'
    if (hasExp) {
      const yrs = parseInt(form.work_experience_years)
      if (!form.work_experience_years || isNaN(yrs) || yrs < 0) e.years = 'Enter valid years of experience'
      if (!form.work_experience_domain) e.domain = 'Please select a domain'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    workExperience.mutate({
      has_work_experience: hasExp!,
      work_experience_years: hasExp ? parseInt(form.work_experience_years) : undefined,
      work_experience_domain: hasExp ? form.work_experience_domain : undefined,
      last_designation: hasExp && form.last_designation ? form.last_designation : undefined,
    })
  }

  const serverError = workExperience.error ? getApiError(workExperience.error) : null

  return (
    <OnboardingLayout currentStep={4} title="Work experience" subtitle="Many aspirants have worked before or alongside their preparation — that's valuable." onSkip={() => navigate('/app/onboarding/step/5')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Do you have prior work experience?</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ val: true, label: 'Yes, I do' }, { val: false, label: 'No, fresher' }].map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => { setHasExp(val); setErrors((p) => ({ ...p, hasExp: '' })) }}
                className={cn(
                  'h-14 rounded-xl border text-sm font-medium transition-all duration-150 flex flex-col items-center justify-center gap-1',
                  hasExp === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                <Briefcase className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {errors.hasExp && <p className="text-xs text-danger mt-0.5">{errors.hasExp}</p>}
        </div>

        {hasExp === true && (
          <>
            <Input
              label="Years of experience"
              type="number"
              placeholder="2"
              value={form.work_experience_years}
              onChange={(e) => { setForm((p) => ({ ...p, work_experience_years: e.target.value })); setErrors((p) => ({ ...p, years: '' })) }}
              error={errors.years}
              min={0}
              max={50}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Domain / Sector</label>
              <select
                value={form.work_experience_domain}
                onChange={(e) => { setForm((p) => ({ ...p, work_experience_domain: e.target.value })); setErrors((p) => ({ ...p, domain: '' })) }}
                className={cn(
                  'w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 outline-none transition-all',
                  'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
                  errors.domain && 'border-danger',
                )}
              >
                <option value="">Select domain</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.domain && <p className="text-xs text-danger mt-0.5">{errors.domain}</p>}
            </div>

            <Input
              label="Last designation (optional)"
              placeholder="Research Analyst, Junior Manager…"
              value={form.last_designation}
              onChange={(e) => setForm((p) => ({ ...p, last_designation: e.target.value }))}
            />
          </>
        )}

        {hasExp === false && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary">
            No problem — your UPSC preparation is itself a strong professional credential.
          </div>
        )}

        {serverError && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={workExperience.isPending} className="mt-2">Continue →</Button>
      </form>
    </OnboardingLayout>
  )
}
