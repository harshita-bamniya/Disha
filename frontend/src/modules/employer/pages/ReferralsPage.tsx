import { useSearchParams } from 'react-router-dom'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import Tabs from '@/shared/components/navigation/Tabs'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { useEmployerPermissions } from '../hooks/useJobs'
import { useMyReferrals, useNominate } from '../hooks/useReferrals'
import MyReferralsPanel from '../components/referrals/MyReferralsPanel'
import OverviewPanel from '../components/referrals/OverviewPanel'
import ReferralsPanel from '../components/referrals/ReferralsPanel'
import RewardsPanel from '../components/referrals/RewardsPanel'
import PeoplePanel from '../components/referrals/PeoplePanel'
import SettingsPanel from '../components/referrals/SettingsPanel'

const ADMIN_ROLES = new Set(['employer', 'employer_owner', 'hr_manager'])

function MyReferrals() {
  const { data, isLoading, isError, refetch } = useMyReferrals()
  const nominate = useNominate()
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  if (isError || !data) return <ErrorState description="Could not load your referrals." onRetry={() => refetch()} />
  return <MyReferralsPanel data={data} nominating={nominate.isPending} onNominate={p => nominate.mutateAsync(p)} />
}

export default function ReferralsPage() {
  const { data: perms, isLoading } = useEmployerPermissions()
  const isAdmin = !!perms && perms.is_company_wide && ADMIN_ROLES.has(perms.role_name)
  const [params, setParams] = useSearchParams()

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner /></div>

  const tabs = [
    ...(isAdmin ? [{ key: 'overview', label: 'Overview' }, { key: 'referrals', label: 'Referrals' }, { key: 'rewards', label: 'Bonuses' }, { key: 'people', label: 'People' }] : []),
    { key: 'mine', label: 'My referrals' },
    ...(isAdmin ? [{ key: 'settings', label: 'Settings' }] : []),
  ]
  const wanted = params.get('tab')
  const active = tabs.some(t => t.key === wanted) ? (wanted as string) : tabs[0].key
  const go = (key: string) => setParams({ tab: key }, { replace: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Referrals" subtitle="Let your own people bring in great candidates" />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tabs.length > 1 && <Tabs tabs={tabs} active={active} onChange={go} variant="pill" />}
          {active === 'overview' && <OverviewPanel onGoTo={go} />}
          {active === 'referrals' && <ReferralsPanel />}
          {active === 'rewards' && <RewardsPanel />}
          {active === 'people' && <PeoplePanel />}
          {active === 'mine' && <MyReferrals />}
          {active === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}
