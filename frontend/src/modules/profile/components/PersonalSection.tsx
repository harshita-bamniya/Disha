import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { getApiError } from '@/api/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ChipSelector from '@/shared/components/primitives/ChipSelector'
import { useOnboardingOptions } from '@/modules/onboarding/hooks/useOnboarding'
import { PROFILE_KEY } from './profileConstants'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

export function PersonalSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const { data: options } = useOnboardingOptions()
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.savePersonal({ ...form, gender: form.gender as any, state: form.state }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const summary = profile.full_name
    ? `${profile.full_name} · ${profile.city ?? '—'}, ${profile.state ?? '—'}`
    : 'Not filled yet'

  return (
    <ProfileSection title="Personal Info" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
        <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} />
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Gender</label>
          <ChipSelector
            options={['Male', 'Female', 'Other', 'Prefer not to say']}
            selected={form.gender === 'prefer_not_to_say' ? 'Prefer not to say' : form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : ''}
            onChange={(val: string) => {
              const map: Record<string, string> = { 'Male': 'male', 'Female': 'female', 'Other': 'other', 'Prefer not to say': 'prefer_not_to_say' }
              setForm(p => ({ ...p, gender: map[val] ?? val }))
            }}
          />
        </div>
        <Input label="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>State</label>
          <select
            value={form.state}
            onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
            style={{ height: 48, borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '0 14px', fontSize: 14, color: '#111827', outline: 'none', background: 'white', transition: 'border 0.2s' }}
            onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
            onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <option value="">Select state</option>
            {(options?.states ?? []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {mut.error && <p style={{ fontSize: 12, color: '#DC2626' }}>{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
