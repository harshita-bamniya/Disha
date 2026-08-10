import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { type ProfileData } from '@/api/onboarding'
import Button from '@/components/ui/Button'
import { ProfileSection } from './ProfileSection'

interface Props { profile: ProfileData; open: boolean; onToggle: () => void }

const MOTIVATION_LABELS: Record<string, string> = {
  intrinsic: 'Driven by meaningful work',
  extrinsic: 'Motivated by recognition & salary',
  mixed: 'Motivated by both purpose and recognition',
}
const RISK_LABELS: Record<string, string> = {
  low: 'Prefers stability',
  medium: 'Open to calculated risks',
  high: 'Willing to take bold moves',
}

export function MindsetSection({ profile, open, onToggle }: Props) {
  const navigate = useNavigate()

  const summary = profile.motivation_type
    ? `${MOTIVATION_LABELS[profile.motivation_type] ?? profile.motivation_type} · ${RISK_LABELS[profile.risk_tolerance ?? 'medium'] ?? ''}`
    : 'Not completed'

  return (
    <ProfileSection title="Mindset Assessment" summary={summary} isOpen={open} onToggle={onToggle}>
      <div className="flex flex-col gap-4">
        {profile.disha_insight && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-primary mb-1">Your BeginablAI insight</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">"{profile.disha_insight}"</p>
          </div>
        )}

        {profile.motivation_type && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Motivation</p>
              <p className="text-xs font-semibold text-gray-700">{MOTIVATION_LABELS[profile.motivation_type] ?? profile.motivation_type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Risk appetite</p>
              <p className="text-xs font-semibold text-gray-700">{RISK_LABELS[profile.risk_tolerance ?? 'medium'] ?? ''}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Support system</p>
              <p className="text-xs font-semibold text-gray-700 capitalize">{profile.support_system ?? '—'}</p>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          fullWidth
          onClick={() => navigate('/app/onboarding/step/7')}
          className="flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retake assessment
        </Button>
      </div>
    </ProfileSection>
  )
}
