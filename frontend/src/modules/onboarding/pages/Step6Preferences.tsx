import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useOnboardingSteps } from '../hooks/useOnboarding'
import { getApiError } from '@/api/client'

const SECTORS = [
  'Government & Civil Services', 'Public Sector Undertakings (PSU)',
  'Management Consulting', 'Education & Training', 'NGO & Social Sector',
  'Banking & Finance', 'Legal', 'Research & Analytics', 'Media & Journalism',
  'Healthcare & Public Health', 'IT & Technology', 'Defence & Security',
  'International Organizations', 'Think Tanks & Policy', 'Entrepreneurship',
]

const SALARY_OPTIONS = [
  { label: 'Up to ₹5 LPA', min: 0, max: 5 },
  { label: '₹5–10 LPA', min: 5, max: 10 },
  { label: '₹10–20 LPA', min: 10, max: 20 },
  { label: '₹20–40 LPA', min: 20, max: 40 },
  { label: '₹40 LPA+', min: 40, max: 500 },
]

export default function Step6Preferences() {
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const [openToRelocation, setOpenToRelocation] = useState<boolean | null>(null)
  const [location, setLocation] = useState('')
  const [locations, setLocations] = useState<string[]>([])
  const [salary, setSalary] = useState<{ min: number; max: number } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { preferences } = useOnboardingSteps()
  const navigate = useNavigate()

  const toggleSector = (s: string) => {
    setErrors((p) => ({ ...p, sectors: '' }))
    setSelectedSectors((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const addLocation = () => {
    const loc = location.trim()
    if (loc && !locations.includes(loc)) {
      setLocations((p) => [...p, loc])
      setErrors((p) => ({ ...p, locations: '' }))
    }
    setLocation('')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (selectedSectors.size === 0) e.sectors = 'Select at least 1 sector'
    if (openToRelocation === null) e.relocation = 'Please answer this question'
    if (openToRelocation === false && locations.length === 0)
      e.locations = 'Add at least 1 preferred location'
    if (!salary) e.salary = 'Please select expected salary range'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    preferences.mutate({
      preferred_sectors: Array.from(selectedSectors),
      preferred_locations: openToRelocation ? [] : locations,
      open_to_relocation: openToRelocation!,
      expected_salary_min: salary!.min,
      expected_salary_max: salary!.max,
    })
  }

  const serverError = preferences.error ? getApiError(preferences.error) : null

  return (
    <OnboardingLayout
      currentStep={6}
      title="Career preferences"
      subtitle="Tell us what you're looking for. This shapes your personalised matches."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Sectors */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Sectors you're interested in
          </label>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSector(s)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                  selectedSectors.has(s)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {errors.sectors && <p className="text-xs text-danger">{errors.sectors}</p>}
        </div>

        {/* Relocation — asked FIRST */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Are you open to relocation?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true,  label: 'Yes, I can relocate' },
              { val: false, label: 'No, I prefer my city' },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => {
                  setOpenToRelocation(val)
                  setErrors((p) => ({ ...p, relocation: '', locations: '' }))
                }}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-150',
                  openToRelocation === val
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.relocation && <p className="text-xs text-danger">{errors.relocation}</p>}
        </div>

        {/* Preferred locations — only shown when NOT open to relocation */}
        {openToRelocation === false && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Preferred work locations
            </label>
            <p className="text-xs text-gray-400 -mt-1">
              Add the cities you'd like to work in.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Delhi, Mumbai, Hyderabad…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addLocation() }
                }}
                prefix={<MapPin className="w-4 h-4" />}
              />
              <button
                type="button"
                onClick={addLocation}
                className="shrink-0 px-4 h-11 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                Add
              </button>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <span
                    key={loc}
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
                  >
                    {loc}
                    <button
                      type="button"
                      onClick={() => setLocations((p) => p.filter((l) => l !== loc))}
                      className="text-primary/60 hover:text-danger"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.locations && <p className="text-xs text-danger">{errors.locations}</p>}
          </div>
        )}

        {/* Salary */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Expected salary range</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SALARY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setSalary({ min: opt.min, max: opt.max })
                  setErrors((p) => ({ ...p, salary: '' }))
                }}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-150',
                  salary?.min === opt.min
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {errors.salary && <p className="text-xs text-danger">{errors.salary}</p>}
        </div>

        {serverError && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/app/onboarding/step/7')}
            className="text-sm font-medium text-gray-500 hover:text-primary transition-colors px-2 py-2 whitespace-nowrap"
          >
            Skip for now
          </button>
          <Button type="submit" fullWidth size="lg" loading={preferences.isPending}>
            Continue →
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
