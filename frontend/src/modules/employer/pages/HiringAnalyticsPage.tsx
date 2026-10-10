import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import { Insights } from './EmployerDashboardLegacy'

/** Team activity, job performance and recruiter performance. These used to sit at the bottom of the dashboard. */
export default function HiringAnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Hiring analytics" subtitle="Team activity, job performance and recruiter performance" />
      <main style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ maxWidth: 1280 }}>
          <Insights defaultSection="activity" />
        </div>
      </main>
    </div>
  )
}
