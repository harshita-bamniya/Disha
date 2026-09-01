import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { type ProfileData } from '@/api/onboarding'
import Button from '@/components/ui/Button'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

export function LearningSetupSection({ profile, open, onToggle }: Props) {
  const navigate = useNavigate()

  const summary = profile.has_learning_setup
    ? `${profile.weekly_study_hours ?? '?'} hrs/week${profile.target_completion_date ? ` · targeting ${profile.target_completion_date}` : ''}`
    : 'Not completed yet'

  return (
    <ProfileSection title="Learning Setup" summary={summary} isOpen={open} onToggle={onToggle}>
      <div className="flex flex-col gap-4">
        {profile.disha_insight && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-primary mb-1">Your BeginablAI insight</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">"{profile.disha_insight}"</p>
          </div>
        )}

        {profile.has_learning_setup && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Weekly time</p>
              <p className="text-xs font-semibold text-gray-700">{profile.weekly_study_hours} hrs/week</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Target date</p>
              <p className="text-xs font-semibold text-gray-700">{profile.target_completion_date ?? 'No deadline set'}</p>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          fullWidth
          onClick={() => navigate('/app/learning-setup')}
          className="flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {profile.has_learning_setup ? 'Update learning setup' : 'Complete learning setup'}
        </Button>
      </div>
    </ProfileSection>
  )
}
