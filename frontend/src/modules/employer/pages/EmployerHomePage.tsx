import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { employerHomeApi } from '@/api/employerHome'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import Tabs from '@/shared/components/navigation/Tabs'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import KpiTiles from '@/shared/components/dashboard/KpiTiles'
import { useDepartments, useEmployerDashboard, useEmployerPermissions } from '../hooks/useJobs'
import HeroBanner from '../components/home/HeroBanner'
import TrendCard from '../components/home/TrendCard'
import OpenJobsCard from '../components/home/OpenJobsCard'
import PipelineCard from '../components/home/PipelineCard'
import UpcomingInterviewsCard from '../components/home/UpcomingInterviewsCard'
import RecentApplicantsCard from '../components/home/RecentApplicantsCard'
import { SetupBanner, VerificationBanner } from './EmployerDashboardLegacy'

const RANGES = [7, 30, 90] as const

/** The employer home: what needs the team today, how hiring is going, and who and what is coming up. */
export default function EmployerHomePage() {
  const { data: dashboard } = useEmployerDashboard()
  const { data: perms } = useEmployerPermissions()
  const { data: departments } = useDepartments()
  const navigate = useNavigate()

  // The period and the comparison live in the address, so a view can be shared and survives a refresh.
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('days'))
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30
  const compare = params.get('compare') === '1'
  const update = (next: { days?: number; compare?: boolean }) => {
    const p = new URLSearchParams(params)
    p.set('days', String(next.days ?? days))
    if (next.compare ?? compare) p.set('compare', '1'); else p.delete('compare')
    setParams(p, { replace: true })
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer', 'home', 'overview', days, compare],
    queryFn: () => employerHomeApi.overview(days, compare),
    refetchInterval: 60_000,
  })

  // Jobs are posted inside a department's workspace. Go straight there when there is only one possible place.
  const isCompanyWide = perms?.is_company_wide ?? true
  const postJob = () => {
    if (!isCompanyWide && perms?.department_id) navigate(`/app/employer/departments/${perms.department_id}?newJob=1`)
    else if (isCompanyWide && departments?.length === 1) navigate(`/app/employer/departments/${departments[0].id}?newJob=1`)
    else navigate('/app/employer/departments')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Dashboard" subtitle="Your hiring at a glance" />

      <main style={{ padding: '22px 28px 32px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1320, margin: '0 auto' }}>
          {dashboard && !dashboard.is_approved && <VerificationBanner />}
          <SetupBanner />

          <HeroBanner companyName={dashboard?.company_name ?? ''} canPost={!!dashboard?.is_approved} onPostJob={postJob} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.text.ink, letterSpacing: '-0.2px' }}>Hiring performance</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: colors.text.muted }}>{data ? `${data.range.from} to ${data.range.to}, India time` : ' '}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Tabs tabs={RANGES.map(r => ({ key: String(r), label: `${r} days` }))} active={String(days)} onChange={k => update({ days: Number(k) })} variant="pill" />
              <button
                onClick={() => update({ compare: !compare })}
                aria-pressed={compare}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, color: compare ? colors.brand.navy : colors.text.inkSoft,
                  background: compare ? 'rgba(26,39,68,0.08)' : colors.surface.card, border: `1px solid ${compare ? colors.brand.navy : colors.border.medium}`,
                }}
              >
                <span aria-hidden style={{ width: 16, height: 16, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: compare ? colors.brand.navy : 'transparent', border: `1.5px solid ${compare ? colors.brand.navy : colors.border.strong}` }}>
                  {compare && <Check size={11} color="#fff" strokeWidth={3} />}
                </span>
                Compare with previous
              </button>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : isError || !data ? (
            <ErrorState title="Could not load your dashboard" description="Something went wrong loading your hiring numbers." onRetry={() => refetch()} />
          ) : !data.approved ? (
            <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>Your hiring numbers appear here once your company is verified and you have published a job.</p>
          ) : (
            <>
              <KpiTiles tiles={data.tiles} days={days} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <TrendCard tiles={data.tiles} from={data.range.from} days={days} />
                  <OpenJobsCard jobs={data.jobs} />
                </div>
                <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <UpcomingInterviewsCard items={data.upcoming_interviews} />
                  <PipelineCard stages={data.pipeline} />
                  <RecentApplicantsCard items={data.recent_applicants} />
                </div>
              </div>
              <Link to="/app/employer/analytics" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: colors.state.info, textDecoration: 'none' }}>
                Team activity and recruiter performance <ArrowRight size={13} aria-hidden />
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
