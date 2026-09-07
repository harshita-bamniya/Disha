import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { PROFILE_KEY } from './profileConstants'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

const QUALIFICATIONS = [
  { val: 'graduate',      label: 'Graduate' },
  { val: 'post_graduate', label: 'Post Graduate' },
  { val: 'doctorate',     label: 'Doctorate' },
  { val: 'diploma',       label: 'Diploma' },
  { val: 'other',         label: 'Other' },
]

export function EducationSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    highest_qualification: profile.highest_qualification ?? '',
    degree: profile.degree ?? '',
    field_of_study: profile.field_of_study ?? '',
    institution: profile.institution ?? '',
    graduation_year: profile.graduation_year ?? new Date().getFullYear(),
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveEducation({ ...form, highest_qualification: form.highest_qualification as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const summary = profile.highest_qualification
    ? `${profile.highest_qualification.replace('_', ' ')} in ${profile.field_of_study ?? '—'}, ${profile.institution ?? '—'}`
    : 'Not filled yet'

  return (
    <ProfileSection title="Education" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Highest qualification</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUALIFICATIONS.map(({ val, label }) => (
              <button
                key={val} type="button"
                onClick={() => setForm(p => ({ ...p, highest_qualification: val }))}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  form.highest_qualification === val
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Input label="Degree name" placeholder="B.A., M.A., B.Tech…" value={form.degree} onChange={e => setForm(p => ({ ...p, degree: e.target.value }))} />
        <Input label="Field of study" placeholder="Political Science, History…" value={form.field_of_study} onChange={e => setForm(p => ({ ...p, field_of_study: e.target.value }))} />
        <Input label="Institution" value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} />
        <Input label="Graduation year" type="number" value={String(form.graduation_year)} onChange={e => setForm(p => ({ ...p, graduation_year: parseInt(e.target.value) || p.graduation_year }))} />
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
