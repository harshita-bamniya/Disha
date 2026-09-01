import { useNavigate } from 'react-router-dom'
import PageHeader from '@/shared/layouts/PageHeader'
import { Compass } from 'lucide-react'
import LearningSetupForm from '../components/LearningSetupForm'

/** Standalone page for retaking the one-time learning setup from the Profile
 * page. The same form also appears inline, gating RoadmapPage, the first
 * time a user generates a job-specific plan. */
export default function LearningSetupPage() {
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Learning Setup" icon={<Compass size={15} color="#6366F1" />} />
      <main style={{ padding: '32px 36px', maxWidth: 620 }}>
        <LearningSetupForm onDone={() => navigate('/app/roadmap')} />
      </main>
    </>
  )
}
