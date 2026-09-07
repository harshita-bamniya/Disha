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

export function WorkSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const [hasExp, setHasExp] = useState<boolean>(profile.has_work_experience ?? false)
  const [form, setForm] = useState({
    work_experience_years: profile.work_experience_years ?? 1,
    work_experience_domain: profile.work_experience_domain ?? '',
    last_designation: profile.last_designation ?? '',
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveWorkExperience(
      hasExp ? { has_work_experience: true, ...form } : { has_work_experience: false }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const summary = profile.has_work_experience
    ? `${profile.work_experience_years ?? 0} yr(s) in ${profile.work_experience_domain ?? '—'} as ${profile.last_designation ?? '—'}`
    : 'No prior work experience'

  return (
    <ProfileSection title="Work Experience" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Do you have work experience?</label>
          <div className="grid grid-cols-2 gap-3">
            {([{ val: true, label: 'Yes' }, { val: false, label: 'No' }] as const).map(({ val, label }) => (
              <button
                key={String(val)} type="button"
                onClick={() => setHasExp(val)}
                className={cn('h-10 rounded-xl border text-sm font-medium transition-all',
                  hasExp === val
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {hasExp && (
          <>
            <Input label="Years of experience" type="number" value={String(form.work_experience_years)} onChange={e => setForm(p => ({ ...p, work_experience_years: parseInt(e.target.value) || 1 }))} />
            <Input label="Domain / sector" placeholder="Education & Training, Banking…" value={form.work_experience_domain} onChange={e => setForm(p => ({ ...p, work_experience_domain: e.target.value }))} />
            <Input label="Last designation" placeholder="Content Writer, Policy Analyst…" value={form.last_designation} onChange={e => setForm(p => ({ ...p, last_designation: e.target.value }))} />
          </>
        )}
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
