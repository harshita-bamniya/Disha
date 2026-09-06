import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { GraduationCap, Sparkles, Briefcase, Phone } from 'lucide-react'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ChipSelector from '@/shared/components/primitives/ChipSelector'
import { useOnboardingOptions } from '@/modules/onboarding/hooks/useOnboarding'
import { useUpdatePhone } from '@/modules/auth/hooks/useAuth'
import { PROFILE_KEY } from './profileConstants'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

type CurrentStatus = 'student' | 'fresher' | 'experienced'

const STATUSES: { value: CurrentStatus; label: string; icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'fresher', label: 'Fresher', icon: Sparkles },
  { value: 'experienced', label: 'Experienced', icon: Briefcase },
]

export function PersonalSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const { data: options } = useOnboardingOptions()
  const updatePhone = useUpdatePhone()
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    phone: profile.phone ?? '',
    current_status: (profile.current_status ?? '') as CurrentStatus | '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: async () => {
      if (form.phone !== (profile.phone ?? '')) {
        await updatePhone.mutateAsync({ phone: form.phone })
      }
      return onboardingApi.savePersonal({
        full_name: form.full_name,
        current_status: form.current_status as CurrentStatus,
        city: form.city,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender ? (form.gender as any) : undefined,
        state: form.state || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const handleSave = () => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim()) e.full_name = 'Name is required'
    if (!form.current_status) e.current_status = 'Please select your current status'
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!form.city.trim()) e.city = 'City is required'
    setErrors(e)
    if (Object.keys(e).length === 0) mut.mutate()
  }

  const summary = profile.full_name
    ? `${profile.full_name} · ${profile.city ?? '—'}, ${profile.state ?? '—'}`
    : 'Not filled yet'

  return (
    <ProfileSection title="Personal Info" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={form.full_name} error={errors.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
        <Input
          label="Phone number" type="tel" prefix={<Phone className="w-4 h-4" />}
          value={form.phone} error={errors.phone}
          maxLength={10} inputMode="numeric"
          onChange={e => {
            const v = e.target.value
            if (v.replace(/\D/g, '').length > 10) return
            setForm(p => ({ ...p, phone: v }))
          }}
        />
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Current status</label>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm(p => ({ ...p, current_status: value }))}
                className={cn(
                  'h-16 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all duration-150',
                  form.current_status === value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {errors.current_status && <p className="text-xs text-danger mt-0.5">{errors.current_status}</p>}
        </div>
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
        <Input label="City" value={form.city} error={errors.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
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
        {(mut.error || updatePhone.error) && <p style={{ fontSize: 12, color: '#DC2626' }}>{getApiError((mut.error || updatePhone.error)!, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={handleSave}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
