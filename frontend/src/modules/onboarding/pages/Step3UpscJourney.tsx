import { useState } from 'react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'
import type { UpscExam, UpscStage } from '@/types'

const EXAMS: { value: UpscExam; label: string; desc: string }[] = [
  { value: 'cse', label: 'UPSC CSE', desc: 'Civil Services Exam (IAS/IPS/IFS…)' },
  { value: 'capf', label: 'CAPF', desc: 'Central Armed Police Forces' },
  { value: 'cds', label: 'CDS', desc: 'Combined Defence Services' },
  { value: 'ies', label: 'IES', desc: 'Indian Engineering Services' },
  { value: 'cms', label: 'CMS', desc: 'Combined Medical Services' },
  { value: 'state_pcs', label: 'State PCS', desc: 'State Public Service Commission' },
  { value: 'other', label: 'Other', desc: 'Other UPSC / competitive exam' },
]

const STAGES: { value: UpscStage; label: string }[] = [
  { value: 'none', label: 'Not yet / No attempt' },
  { value: 'prelims', label: 'Cleared Prelims' },
  { value: 'mains', label: 'Cleared Mains' },
  { value: 'interview', label: 'Appeared in Interview' },
]

export default function Step3UpscJourney() {
  const [form, setForm] = useState({
    upsc_exam: '' as UpscExam | '',
    years_preparing: '',
    upsc_attempts: '',
    highest_stage_cleared: 'none' as UpscStage,
    optional_subject: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { upscJourney } = useOnboardingSteps()

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.upsc_exam) e.upsc_exam = 'Please select an exam'
    const yrs = parseInt(form.years_preparing)
    if (!form.years_preparing || isNaN(yrs) || yrs < 0 || yrs > 30) e.years_preparing = 'Enter valid years (0–30)'
    const att = parseInt(form.upsc_attempts)
    if (form.upsc_attempts === '' || isNaN(att) || att < 0 || att > 20) e.upsc_attempts = 'Enter valid attempts (0–20)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    upscJourney.mutate({
      upsc_exam: form.upsc_exam as UpscExam,
      years_preparing: parseInt(form.years_preparing),
      upsc_attempts: parseInt(form.upsc_attempts),
      highest_stage_cleared: form.highest_stage_cleared,
      optional_subject: form.optional_subject || undefined,
    })
  }

  const serverError = upscJourney.error ? getApiError(upscJourney.error) : null

  return (
    <OnboardingLayout currentStep={3} title="Your UPSC journey" subtitle="Every attempt is experience. Tell us about your preparation.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Exam type */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Which exam are you preparing for?</label>
          <div className="grid grid-cols-2 gap-2">
            {EXAMS.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setForm((p) => ({ ...p, upsc_exam: value })); setErrors((p) => ({ ...p, upsc_exam: '' })) }}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all duration-150',
                  form.upsc_exam === value ? 'bg-primary/5 border-primary' : 'bg-white border-gray-200 hover:border-primary/40',
                )}
              >
                <p className={cn('text-sm font-semibold', form.upsc_exam === value ? 'text-primary' : 'text-gray-800')}>{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
          {errors.upsc_exam && <p className="text-xs text-danger mt-0.5">{errors.upsc_exam}</p>}
        </div>

        {/* Years + Attempts */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Years preparing"
            type="number"
            placeholder="3"
            value={form.years_preparing}
            onChange={(e) => { setForm((p) => ({ ...p, years_preparing: e.target.value })); setErrors((p) => ({ ...p, years_preparing: '' })) }}
            error={errors.years_preparing}
            min={0}
            max={30}
          />
          <Input
            label="Total attempts"
            type="number"
            placeholder="2"
            value={form.upsc_attempts}
            onChange={(e) => { setForm((p) => ({ ...p, upsc_attempts: e.target.value })); setErrors((p) => ({ ...p, upsc_attempts: '' })) }}
            error={errors.upsc_attempts}
            min={0}
            max={20}
          />
        </div>

        {/* Highest stage */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Highest stage cleared</label>
          <div className="flex flex-col gap-2">
            {STAGES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, highest_stage_cleared: value }))}
                className={cn(
                  'h-10 rounded-xl border text-sm font-medium text-left px-4 transition-all duration-150',
                  form.highest_stage_cleared === value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional subject — only for CSE */}
        {form.upsc_exam === 'cse' && (
          <Input
            label="Optional subject (if applicable)"
            placeholder="Sociology, Public Administration, Geography…"
            value={form.optional_subject}
            onChange={(e) => setForm((p) => ({ ...p, optional_subject: e.target.value }))}
            hint="Leave blank if you haven't chosen yet"
          />
        )}

        {serverError && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={upscJourney.isPending} className="mt-2">Continue →</Button>
      </form>
    </OnboardingLayout>
  )
}
