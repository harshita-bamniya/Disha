import { useNavigate } from 'react-router-dom'
import { BarChart2, Users, Building2, Briefcase, IndianRupee, ArrowRight, TrendingUp } from 'lucide-react'
import { useAdminStats } from '../hooks/useAdmin'
import { Spinner } from '../shared/adminUI'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

function ReportCard({
  icon: Icon, title, description, href, stat, statLabel,
}: {
  icon: React.ElementType; title: string; description: string; href: string
  stat?: string | number; statLabel?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, transition: 'background 0.15s' }}
      onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
      onMouseOut={e => (e.currentTarget.style.background = '#fff')}
    >
      <div className="flex items-start justify-between">
        <div style={{ width: 40, height: 40, borderRadius: 12, background: N.creamDk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon className="w-5 h-5" style={{ color: N.ink }} />
        </div>
        {stat !== undefined && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{typeof stat === 'number' ? stat.toLocaleString() : stat}</p>
            {statLabel && <p style={{ fontSize: 10, color: N.muted, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>{statLabel}</p>}
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: N.ink }}>{title}</h3>
        <p style={{ fontSize: 12, color: N.muted, marginTop: 2, lineHeight: 1.5 }}>{description}</p>
      </div>
      <div className="flex items-center gap-1 mt-auto" style={{ fontSize: 12, fontWeight: 600, color: N.navy }}>
        Open report <ArrowRight size={12} />
      </div>
    </button>
  )
}

export default function ReportsPage() {
  const { data: stats, isLoading } = useAdminStats()

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px', marginBottom: 4 }}>Reports</h1>
        <p style={{ fontSize: 14, color: N.muted }}>Platform-wide analytics, growth trends, and financial overview.</p>
      </div>

      {/* Platform KPIs */}
      {isLoading ? <Spinner /> : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Candidates', value: stats.total_aspirants },
            { label: 'Total Employers',  value: stats.total_employers },
            { label: 'Total Jobs',       value: stats.total_job_postings },
            { label: 'Applications',     value: stats.total_applications },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Growth & Engagement */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Growth &amp; Engagement</span>
          <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            icon={Building2}
            title="Employer Reports"
            description="Employer registrations, verification status, engagement rate, and top hiring companies."
            href="/admin/reports/employers"
            stat={stats?.total_employers}
            statLabel="employers"
          />
          <ReportCard
            icon={Briefcase}
            title="Job Reports"
            description="Job posting trends, application funnel, average applications per job, and monthly cohort analysis."
            href="/admin/reports/jobs"
            stat={stats?.total_job_postings}
            statLabel="jobs"
          />
          <ReportCard
            icon={Users}
            title="Candidate Reports"
            description="Registration trends, KRS score distribution, application rates, and candidate-to-hire conversion."
            href="/admin/reports/candidates"
            stat={stats?.total_aspirants}
            statLabel="candidates"
          />
        </div>
      </div>

      {/* Financial */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Financial</span>
          <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            icon={IndianRupee}
            title="Financial Reports"
            description="MRR, ARPA, active subscriptions, plan distribution, and 6-month subscription trend."
            href="/admin/reports/financial"
          />
          <ReportCard
            icon={TrendingUp}
            title="Platform Analytics"
            description="Deep-dive analytics with custom date ranges: user growth, job volume, application funnel, score distribution."
            href="/admin/analytics"
          />
        </div>
      </div>
    </section>
  )
}
