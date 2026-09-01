import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { getApiError } from '@/api/client'
import Button from '@/components/ui/Button'
import SkillPicker from '@/modules/onboarding/components/SkillPicker'
import { PROFILE_KEY } from './profileConstants'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

const MAX_SKILLS = 10

export function SkillsSection({ profile, open, onToggle }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>(profile.skills)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveSkills({ skills: selected }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const summary = profile.skills.length > 0
    ? profile.skills.slice(0, 4).join(', ') + (profile.skills.length > 4 ? ` +${profile.skills.length - 4} more` : '')
    : 'No skills selected'

  return (
    <ProfileSection title="Skills" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <SkillPicker
          selected={selected}
          onChange={(next) => { setSelected(next); setError('') }}
          maxSkills={MAX_SKILLS}
          onError={setError}
        />

        {(error || mut.error) && (
          <p className="text-xs text-danger">{error || getApiError(mut.error, 'Save failed')}</p>
        )}
        <Button fullWidth loading={mut.isPending} disabled={selected.length === 0} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </ProfileSection>
  )
}
