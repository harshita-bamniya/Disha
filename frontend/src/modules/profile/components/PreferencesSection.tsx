import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useOnboardingOptions } from '@/modules/onboarding/hooks/useOnboarding'
import { PROFILE_KEY, SALARY_OPTIONS } from './profileConstants'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

export function PreferencesSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const { data: options } = useOnboardingOptions()
  const [sectors, setSectors] = useState<Set<string>>(new Set(profile.preferred_sectors))
  const [openToReloc, setOpenToReloc] = useState<boolean | null>(
    profile.open_to_relocation != null ? profile.open_to_relocation : null
  )
  const [locations, setLocations] = useState<string[]>(profile.preferred_locations)
  const [locInput, setLocInput] = useState('')
  const [salary, setSalary] = useState<{ min: number; max: number } | null>(
    profile.expected_salary_min != null ? { min: profile.expected_salary_min, max: profile.expected_salary_max ?? 500 } : null
  )
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.savePreferences({
      preferred_sectors: Array.from(sectors),
      preferred_locations: openToReloc ? [] : locations,
      open_to_relocation: openToReloc ?? false,
      expected_salary_min: salary?.min ?? 0,
      expected_salary_max: salary?.max ?? 500,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const addLoc = () => {
    const loc = locInput.trim()
    if (loc && !locations.includes(loc)) setLocations(p => [...p, loc])
    setLocInput('')
  }

  const currentSalaryLabel = SALARY_OPTIONS.find(o => o.min === salary?.min)?.label ?? 'Not set'
  const summary = profile.preferred_sectors.length > 0
    ? `${profile.preferred_sectors.slice(0, 2).join(', ')} · ${currentSalaryLabel}`
    : 'Not filled yet'

  return (
    <ProfileSection title="Career Preferences" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-5">

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Preferred sectors</label>
          <div className="flex flex-wrap gap-2">
            {(options?.sectors ?? []).map(s => (
              <button
                key={s} type="button"
                onClick={() => setSectors(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })}
                className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  sectors.has(s)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Are you open to relocation?</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { val: true,  label: 'Yes, I can relocate'  },
              { val: false, label: 'No, I prefer my city' },
            ] as const).map(({ val, label }) => (
              <button
                key={String(val)} type="button"
                onClick={() => {
                  setOpenToReloc(val)
                  if (val) setLocations([])
                }}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  openToReloc === val
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {openToReloc === false && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Preferred locations</label>
            <p className="text-xs text-gray-400 -mt-1">Add the cities you'd like to work in.</p>
            <div className="flex gap-2">
              <Input
                placeholder="Delhi, Mumbai…"
                value={locInput}
                onChange={e => setLocInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLoc() } }}
                prefix={<MapPin className="w-4 h-4" />}
              />
              <button
                type="button"
                onClick={addLoc}
                className="shrink-0 px-4 h-11 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                aria-label="Add location"
              >
                Add
              </button>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {locations.map(loc => (
                  <span key={loc} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {loc}
                    <button type="button" onClick={() => setLocations(p => p.filter(l => l !== loc))} className="text-primary/60 hover:text-danger" aria-label={`Remove ${loc}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Expected salary range</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SALARY_OPTIONS.map(opt => (
              <button
                key={opt.label} type="button"
                onClick={() => setSalary({ min: opt.min, max: opt.max })}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  salary?.min === opt.min
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
