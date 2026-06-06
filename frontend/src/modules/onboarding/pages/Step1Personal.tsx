import { useState } from 'react'
import { User, Calendar, MapPin } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'
import type { Gender } from '@/types'

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
  const [form, setForm] = useState({ full_name: '', date_of_birth: '', gender: '' as Gender | '', city: '', state: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { personal } = useOnboardingSteps()

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [f]: e.target.value }))
    setErrors((p) => ({ ...p, [f]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim()) e.full_name = 'Name is required'
    if (!form.date_of_birth) e.date_of_birth = 'Date of birth is required'
    if (!form.gender) e.gender = 'Please select a gender'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.state) e.state = 'Please select your state'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    personal.mutate({ ...form, gender: form.gender as Gender })
  }

  const serverError = personal.error ? getApiError(personal.error) : null

  return (
    <OnboardingLayout currentStep={1} title="Tell us about yourself" subtitle="This helps us personalise your career journey.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          placeholder="Priya Sharma"
          value={form.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          prefix={<User className="w-4 h-4" />}
        />

        <Input
          label="Date of birth"
          type="date"
          value={form.date_of_birth}
          onChange={set('date_of_birth')}
          error={errors.date_of_birth}
          prefix={<Calendar className="w-4 h-4" />}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Gender</label>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setForm((p) => ({ ...p, gender: value })); setErrors((p) => ({ ...p, gender: '' })) }}
                className={cn(
                  'h-10 rounded-xl border text-sm font-medium transition-all duration-150',
                  form.gender === value ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.gender && <p className="text-xs text-danger mt-0.5">{errors.gender}</p>}
        </div>

        <Input
          label="Current city"
          placeholder="New Delhi"
          value={form.city}
          onChange={set('city')}
          error={errors.city}
          prefix={<MapPin className="w-4 h-4" />}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">State / UT</label>
          <select
            value={form.state}
            onChange={set('state')}
            className={cn(
              'w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 outline-none transition-all',
              'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
              errors.state && 'border-danger',
            )}
          >
            <option value="">Select state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.state && <p className="text-xs text-danger mt-0.5">{errors.state}</p>}
        </div>

        {serverError && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{serverError}</p>}

        <Button type="submit" fullWidth size="lg" loading={personal.isPending} className="mt-2">
          Continue →
        </Button>
      </form>
    </OnboardingLayout>
  )
}
