import { useState } from 'react'
import { User, MapPin, Phone, GraduationCap, Briefcase, Sparkles } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps, useOnboardingProfile } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpdatePhone } from '@/modules/auth/hooks/useAuth'
import type { Gender } from '@/types'

type CurrentStatus = 'student' | 'fresher' | 'experienced'

const STATUSES: { value: CurrentStatus; label: string; icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'fresher', label: 'Fresher', icon: Sparkles },
  { value: 'experienced', label: 'Experienced', icon: Briefcase },
]

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir',
  'Ladakh','Lakshadweep','Puducherry',
]

export default function Step1Personal() {
  const [form, setForm] = useState({
    full_name: '', phone: '', current_status: '' as CurrentStatus | '', city: '',
    date_of_birth: '', gender: '' as Gender | '', state: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [prefilled, setPrefilled] = useState(false)
  const { personal } = useOnboardingSteps()
  const { data: profile } = useOnboardingProfile()
  const savedPhone = useAuthStore((s) => s.user?.phone) ?? ''
  const updatePhone = useUpdatePhone()

  // Pre-fill from whatever's already saved — this step is reachable even
  // after onboarding is complete (browser back, a stale link), and an empty
  // form would otherwise silently wipe existing optional fields on submit.
  if (profile && !prefilled) {
    setPrefilled(true)
    setForm({
      full_name: profile.full_name ?? '',
      phone: savedPhone,
      current_status: (profile.current_status ?? '') as CurrentStatus | '',
      city: profile.city ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      gender: (profile.gender ?? '') as Gender | '',
      state: profile.state ?? '',
    })
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [f]: e.target.value }))
    setErrors((p) => ({ ...p, [f]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim()) e.full_name = 'Name is required'
    if (!form.current_status) e.current_status = 'Please select your current status'
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!form.city.trim()) e.city = 'City is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    // Phone lives on the user record, not the onboarding profile — store it
    // first so a taken/invalid number stops the step before anything else saves.
    const phone = form.phone.replace(/\D/g, '')
    if (phone !== savedPhone) {
      try {
        await updatePhone.mutateAsync({ phone })
      } catch {
        return
      }
    }
    personal.mutate({
      full_name: form.full_name,
      current_status: form.current_status as CurrentStatus,
      city: form.city,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender ? (form.gender as Gender) : undefined,
      state: form.state || undefined,
    })
  }

  const serverError = updatePhone.error
    ? getApiError(updatePhone.error)
    : personal.error ? getApiError(personal.error) : null

  return (
    <OnboardingLayout currentStep={1} title="Let's get you started" subtitle="Just the basics — you can add the rest later from your dashboard.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          required
          placeholder="Priya Sharma"
          value={form.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          prefix={<User className="w-4 h-4" />}
        />

        <Input
          label="Phone number"
          required
          type="tel"
          placeholder="10-digit mobile number"
          value={form.phone}
          onChange={(e) => {
            if (e.target.value.replace(/\D/g, '').length > 10) return
            set('phone')(e)
          }}
          error={errors.phone}
          prefix={<Phone className="w-4 h-4" />}
          maxLength={10}
          inputMode="numeric"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Current status<span className="text-danger ml-0.5">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setForm((p) => ({ ...p, current_status: value })); setErrors((p) => ({ ...p, current_status: '' })) }}
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

        <Input
          label="Current city"
          required
          placeholder="New Delhi"
          value={form.city}
          onChange={set('city')}
          error={errors.city}
          prefix={<MapPin className="w-4 h-4" />}
        />

        <div className="h-px bg-gray-100 my-1" />

        <Input
          label="Date of birth"
          type="date"
          value={form.date_of_birth}
          onChange={set('date_of_birth')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Gender</label>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, gender: value }))}
                className={cn(
                  'h-10 rounded-xl border text-sm font-medium transition-all duration-150',
                  form.gender === value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">State / UT</label>
          <select
            value={form.state}
            onChange={set('state')}
            className="w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 outline-none transition-all border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Select state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {serverError && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={personal.isPending || updatePhone.isPending} className="mt-2">
          Continue →
        </Button>
      </form>
    </OnboardingLayout>
  )
}
