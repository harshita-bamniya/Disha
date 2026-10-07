import ChangePasswordCard from '@/modules/auth/components/ChangePasswordCard'
import { ProfileSection } from './ProfileSection'

interface Props { open: boolean; onToggle: () => void }

export function SecuritySection({ open, onToggle }: Props) {
  return (
    <ProfileSection title="Security" summary="Change your account password" isOpen={open} onToggle={onToggle}>
      <ChangePasswordCard embedded />
    </ProfileSection>
  )
}
