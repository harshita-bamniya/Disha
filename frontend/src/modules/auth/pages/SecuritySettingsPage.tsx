import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { EMPLOYER_ROLES } from '@/types'

// Security settings no longer have their own page — 2FA and change-password
// now live inside Company Profile (employers) / Profile (aspirants), each
// alongside the rest of that role's account settings instead of a separate
// sidebar destination. This route is kept only so old links/bookmarks still
// land somewhere sensible.
export default function SecuritySettingsPage() {
  const user = useAuthStore(s => s.user)
  const isEmployer = user ? EMPLOYER_ROLES.includes(user.role) : false
  return <Navigate to={isEmployer ? '/app/employer/profile' : '/app/profile'} replace />
}
