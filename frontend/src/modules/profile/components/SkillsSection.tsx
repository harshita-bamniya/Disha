import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import Button from '@/components/ui/Button'
import { useOnboardingOptions } from '@/modules/onboarding/hooks/useOnboarding'
import { PROFILE_KEY } from '../constants'
import { Section } from './Section'

// Extracted from ProfilePage.tsx (audit L-07/Sprint 6: split the
// god-component). Same markup and logic.
export function SkillsSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const { data: options } = useOnboardingOptions()
  const [selected, setSelected] = useState<Set<string>>(new Set(profile.skills))
  const [customInput, setCustomInput] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const MAX = 10

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveSkills({ skills: Array.from(selected) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const toggle = (skill: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(skill)) { next.delete(skill) } else if (next.size < MAX) { next.add(skill) }
      return next
    })
  }

  const addCustomSkill = () => {
    const skill = customInput.trim()
    if (!skill) return
    const existingLower = new Set([...selected].map(s => s.toLowerCase()))
    if (existingLower.has(skill.toLowerCase())) { setCustomInput(''); return }
    if (selected.size >= MAX) return
    setSelected(prev => new Set([...prev, skill]))
    setCustomInput('')
    inputRef.current?.focus()
  }

  const allSkills = options?.skills ?? []
  const isPredefined = (skill: string) => allSkills.includes(skill)
  const customSkills = [...selected].filter(s => !isPredefined(s))

  const summary = profile.skills.length > 0
    ? profile.skills.slice(0, 4).join(', ') + (profile.skills.length > 4 ? ` +${profile.skills.length - 4} more` : '')
    : 'No skills selected'

  return (
    <Section title="Skills" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-gray-400">{selected.size}/{MAX} selected</p>

        {/* Predefined skill chips */}
        <div className="flex flex-wrap gap-2">
          {allSkills.map(skill => {
            const isSelected = selected.has(skill)
            const isDisabled = !isSelected && selected.size >= MAX
            return (
              <button key={skill} type="button" onClick={() => toggle(skill)} disabled={isDisabled}
                className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  isSelected && 'bg-primary text-white border-primary',
                  !isSelected && !isDisabled && 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                  isDisabled && 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed')}>
                {skill}
              </button>
            )
          })}
        </div>

        {/* Custom skills already saved — show as removable chips */}
        {customSkills.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400">Your custom skills:</p>
            <div className="flex flex-wrap gap-2">
              {customSkills.map(skill => (
                <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent text-xs font-medium rounded-full">
                  {skill}
                  <button type="button" onClick={() => toggle(skill)} className="text-accent/60 hover:text-danger leading-none">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add custom skill input */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a skill not listed above</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
              placeholder="e.g. Machine Learning, Negotiation, SQL…"
              disabled={selected.size >= MAX}
              className={cn(
                'flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                'disabled:bg-gray-50 disabled:text-gray-300',
              )}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              disabled={!customInput.trim() || selected.size >= MAX}
              className="shrink-0 h-10 px-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} disabled={selected.size === 0} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}
