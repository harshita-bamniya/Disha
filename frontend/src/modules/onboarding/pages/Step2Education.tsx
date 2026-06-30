import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'
import type { Qualification } from '@/types'

const QUALIFICATIONS: { value: Qualification; label: string }[] = [
  { value: 'graduate', label: 'Graduate (B.A./B.Sc./B.Tech etc.)' },
  { value: 'post_graduate', label: 'Post Graduate (M.A./M.Sc./MBA etc.)' },
  { value: 'doctorate', label: 'Doctorate (Ph.D.)' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'other', label: 'Other' },
]

const CURRENT_YEAR = new Date().getFullYear()

export default function Step2Education() {
  const [form, setForm] = useState({
    highest_qualification: '' as Qualification | '',
    degree: '',
    field_of_study: '',
    institution: '',
    graduation_year: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { education } = useOnboardingSteps()

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [f]: e.target.value }))
    setErrors((p) => ({ ...p, [f]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.highest_qualification) e.highest_qualification = 'Please select your qualification'
    if (!form.degree.trim()) e.degree = 'Degree is required'
    if (!form.field_of_study.trim()) e.field_of_study = 'Field of study is required'
    if (!form.institution.trim()) e.institution = 'Institution name is required'
    const yr = parseInt(form.graduation_year)
    if (!form.graduation_year || isNaN(yr) || yr < 1970 || yr > 2030) e.graduation_year = 'Enter a valid graduation year (1970–2030)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    education.mutate({ ...form, highest_qualification: form.highest_qualification as Qualification, graduation_year: parseInt(form.graduation_year) })
  }

  const serverError = education.error ? getApiError(education.error) : null

  return (
    <OnboardingLayout currentStep={2} title="Your education" subtitle="Help us understand your academic background.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Highest qualification<span className="text-danger ml-0.5">*</span></label>
          <div className="flex flex-col gap-2">
            {QUALIFICATIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setForm((p) => ({ ...p, highest_qualification: value })); setErrors((p) => ({ ...p, highest_qualification: '' })) }}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium text-left px-4 transition-all duration-150',
                  form.highest_qualification === value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.highest_qualification && <p className="text-xs text-danger mt-0.5">{errors.highest_qualification}</p>}
        </div>

        <Input label="Degree" required placeholder="B.A., B.Sc., B.Tech, M.A.…" value={form.degree} onChange={set('degree')} error={errors.degree} />
        <Input label="Field of study" required placeholder="Political Science, Economics, Engineering…" value={form.field_of_study} onChange={set('field_of_study')} error={errors.field_of_study} />
        <Input label="Institution" required placeholder="University / College name" value={form.institution} onChange={set('institution')} error={errors.institution} prefix={<GraduationCap className="w-4 h-4" />} />
        <Input label="Graduation year" required type="number" placeholder={String(CURRENT_YEAR)} value={form.graduation_year} onChange={set('graduation_year')} error={errors.graduation_year} min={1970} max={2030} />

        {serverError && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={education.isPending} className="mt-2">Continue →</Button>
      </form>
    </OnboardingLayout>
  )
}
