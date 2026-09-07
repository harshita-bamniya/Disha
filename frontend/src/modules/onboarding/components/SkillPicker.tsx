import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useOnboardingOptions } from '../hooks/useOnboarding'
import { onboardingApi } from '@/api/onboarding'

interface Props {
  selected: string[]
  onChange: (skills: string[]) => void
  maxSkills?: number
  /** Surfaced by the caller so it can show its own inline error alongside
   * server-validation errors — the picker only enforces the max-count cap. */
  onError?: (message: string) => void
}

/** Shared skill-selection UI: grouped curated chips, a live selections tray,
 * and a search box with autocomplete suggestions that also accepts a
 * genuinely custom skill. Used by onboarding Step 5 and the Profile page's
 * Skills section — keep both in sync by editing this, not by forking it. */
export default function SkillPicker({ selected, onChange, maxSkills = 10, onError }: Props) {
  const [customInput, setCustomInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const { data: options } = useOnboardingOptions()

  const debouncedQuery = useDebounce(customInput.trim(), 300)
  const { data: suggestions = [] } = useQuery({
    queryKey: ['onboarding', 'skills-suggest', debouncedQuery],
    queryFn: () => onboardingApi.suggestSkills(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const selectedLower = new Set(selected.map(s => s.toLowerCase()))
  const categories = options?.skill_categories ?? {}
  const isPredefined = (skill: string) => (options?.skills ?? []).includes(skill)
  const atCap = selected.length >= maxSkills

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (!s) return
    if (selectedLower.has(s.toLowerCase())) return
    if (atCap) { onError?.(`You can select at most ${maxSkills} skills`); return }
    onChange([...selected, s])
  }

  const removeSkill = (skill: string) => onChange(selected.filter(s => s !== skill))

  const toggle = (skill: string) => {
    if (selectedLower.has(skill.toLowerCase())) removeSkill(skill)
    else addSkill(skill)
  }

  // A suggestion is already in skill_taxonomy, so it can be added directly.
  // Anything else has to pass validate_skill (ESCO, then our own LLM) before
  // it's trusted enough to go on a profile — see the backend audit note in
  // onboarding/skill_validation.py for why a blind "add whatever's typed"
  // input isn't good enough.
  const validateMutation = useMutation({ mutationFn: onboardingApi.validateSkill })

  const submitCustom = () => {
    const text = customInput.trim()
    if (!text || validateMutation.isPending) return
    onError?.('')
    validateMutation.mutate(text, {
      onSuccess: (result) => {
        if (result.valid && result.canonical_name) {
          addSkill(result.canonical_name)
          setCustomInput('')
          setShowSuggestions(false)
          inputRef.current?.focus()
        } else {
          onError?.(`We couldn't verify "${text}" as a real skill — try a different term or pick a suggestion.`)
        }
      },
      onError: () => onError?.('Could not check that skill right now — please try again.'),
    })
  }

  const exactSuggestionMatch = suggestions.some(s => s.toLowerCase() === customInput.trim().toLowerCase())

  return (
    <div className="flex flex-col gap-5">
      {/* Selections tray — always visible so users never lose track of their picks */}
      <div className="flex flex-col gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your skills</p>
          <span className="text-xs text-gray-400">{selected.length} of {maxSkills}</span>
        </div>
        {selected.length === 0 ? (
          <p className="text-sm text-gray-400 py-1">No skills selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map(skill => (
              <span
                key={skill}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border',
                  isPredefined(skill)
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-accent/10 border-accent/30 text-accent',
                )}
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="hover:text-danger leading-none">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search / add custom skill, with live suggestions */}
      <div ref={boxRef} className="relative flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Search for a skill, or add your own
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={e => { setCustomInput(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitCustom() } }}
              placeholder="e.g. Public Speaking, Python, Negotiation…"
              disabled={atCap}
              className={cn(
                'w-full h-11 rounded-xl border bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                'disabled:bg-gray-50 disabled:text-gray-300 border-gray-200',
              )}
            />
          </div>
          <button
            type="button"
            onClick={submitCustom}
            disabled={!customInput.trim() || atCap || validateMutation.isPending}
            className="shrink-0 h-11 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {validateMutation.isPending ? 'Checking…' : 'Add'}
          </button>
        </div>

        {showSuggestions && customInput.trim().length >= 2 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.filter(s => !selectedLower.has(s.toLowerCase())).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { addSkill(s); setCustomInput(''); setShowSuggestions(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary/5 transition-colors"
              >
                {s}
              </button>
            ))}
            {!exactSuggestionMatch && (
              <button
                type="button"
                onClick={submitCustom}
                disabled={validateMutation.isPending}
                className="w-full text-left px-4 py-2.5 text-sm text-accent font-medium hover:bg-accent/5 transition-colors border-t border-gray-100 flex items-center gap-1.5 disabled:opacity-50"
              >
                {validateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {validateMutation.isPending ? `Checking "${customInput.trim()}"…` : `Add "${customInput.trim()}" as a new skill`}
              </button>
            )}
            {suggestions.length === 0 && exactSuggestionMatch && (
              <p className="px-4 py-2.5 text-xs text-gray-400">Already suggested above.</p>
            )}
          </div>
        )}
      </div>

      {/* Curated skills, grouped by category */}
      <div className="flex flex-col gap-4">
        {Object.entries(categories).map(([category, catSkills]) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</p>
            <div className="flex flex-wrap gap-2">
              {catSkills.map((skill) => {
                const isSelected = selectedLower.has(skill.toLowerCase())
                const isDisabled = !isSelected && atCap
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggle(skill)}
                    disabled={isDisabled}
                    className={cn(
                      'px-4 py-2 rounded-full border text-sm font-medium transition-all duration-150',
                      isSelected && 'bg-primary text-white border-primary',
                      !isSelected && !isDisabled && 'bg-white text-gray-600 border-gray-200 hover:border-primary/60',
                      isDisabled && 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed',
                    )}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
