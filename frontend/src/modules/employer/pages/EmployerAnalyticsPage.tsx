import { useQuery } from '@tanstack/react-query'
import { Briefcase, Users, Send, UserCheck, Clock, TrendingUp } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'
import { DS, C, fmtNum } from '../ds'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import StatCard from '@/shared/components/data-display/StatCard'
import ErrorState from '@/shared/components/feedback/ErrorState'

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview', interview_completed: 'Interviewed',
  offer_sent: 'Offer', hired: 'Hired',
}

const STAGE_COLORS = [colors.state.info, '#0891B2', '#7C3AED', colors.state.success, colors.state.warning, '#2563EB', colors.state.danger]

// ── Funnel bar chart ──────────────────────────────────────────────────────────
function FunnelChart({ stages, total }: { stages: { stage: string; count: number; pct_of_total: number }[]; total: number }) {
  const max = Math.max(...stages.map(s => s.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((s, i) => (
        <div key={s.stage}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: C.ink1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[i % STAGE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
              {STAGE_LABELS[s.stage] ?? s.stage}
            </span>
            <span style={{ fontSize: 12, color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
              {s.count} <span style={{ color: C.ink3 }}>({s.pct_of_total}%)</span>
            </span>
          </div>
          <div style={{ height: 6, background: C.borderLight, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: STAGE_COLORS[i % STAGE_COLORS.length], borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function DonutChart({ stages }: { stages: { stage: string; count: number; pct_of_total: number }[] }) {
  const total = stages.reduce((a, s) => a + s.count, 0)
  if (total === 0) return <p style={{ textAlign: 'center', color: C.ink3, fontSize: 12, padding: '24px 0' }}>No data yet</p>
  const R = 54, CX = 80, CY = 80, circ = 2 * Math.PI * R
  let cum = 0
  const top = [...stages].sort((a, b) => b.count - a.count).slice(0, 5)
  const arcs = top.map((s, i) => {
    const pct = s.count / total
    const rot = cum * 360 - 90
    cum += pct
    return { ...s, pct, rot, color: STAGE_COLORS[i % STAGE_COLORS.length] }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <circle key={a.stage} cx={CX} cy={CY} r={R}
            fill="none" stroke={a.color} strokeWidth={24}
            strokeDasharray={`${circ * a.pct} ${circ * (1 - a.pct)}`}
            strokeDashoffset={-(circ * (arcs.slice(0, i).reduce((s, x) => s + x.pct, 0)))}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ))}
        <circle cx={CX} cy={CY} r={R - 12} fill="#fff" />
        <text x={CX} y={CY + 5} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: C.ink1, fontVariantNumeric: 'tabular-nums' }}>{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        {arcs.map(a => (
          <div key={a.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.ink2, flex: 1 }}>{STAGE_LABELS[a.stage] ?? a.stage}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.ink1, fontVariantNumeric: 'tabular-nums' }}>{Math.round(a.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Job performance table ─────────────────────────────────────────────────────
function JobPerfTable({ jobs }: { jobs: { title: string; hired: number; total_applications: number; conversion_rate_pct: number }[] }) {
  if (!jobs.length) return <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>No job data yet.</p>
  const COLS = '1fr 90px 90px 100px'
  return (
    // Narrower than ~460px, this table scrolls horizontally rather than
    // squishing columns or overflowing the card — see DepartmentsTable
    // in EmployerDashboardPage.tsx for the reference pattern.
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 460 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '8px 20px', background: colors.surface.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {['Job Title', 'Applications', 'Hired', 'Conversion'].map(h => <span key={h}>{h}</span>)}
        </div>
        {jobs.map((j, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 20px', borderBottom: `1px solid ${C.borderLight}`, fontSize: 13, alignItems: 'center' }}
            onMouseOver={e => { e.currentTarget.style.background = colors.surface.elevated }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontWeight: 500, color: C.ink1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{j.total_applications}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{j.hired}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: C.borderLight, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${j.conversion_rate_pct}%`, height: '100%', background: C.accent, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600, width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{j.conversion_rate_pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recruiter table ───────────────────────────────────────────────────────────
function RecruiterTable({ recruiters }: { recruiters: { name: string; jobs_posted: number; total_applications: number; hired: number }[] }) {
  if (!recruiters.length) return <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>No recruiter data yet.</p>
  const COLS = '1fr 90px 90px 70px'
  return (
    // Narrower than ~400px, this table scrolls horizontally rather than
    // squishing columns or overflowing the card — see DepartmentsTable
    // in EmployerDashboardPage.tsx for the reference pattern.
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 400 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '8px 20px', background: colors.surface.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {['Recruiter', 'Jobs Posted', 'Applications', 'Hired'].map(h => <span key={h}>{h}</span>)}
        </div>
        {recruiters.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 20px', borderBottom: `1px solid ${C.borderLight}`, fontSize: 13, alignItems: 'center' }}
            onMouseOver={e => { e.currentTarget.style.background = colors.surface.elevated }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontWeight: 500, color: C.ink1 }}>{r.name}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{r.jobs_posted}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{r.total_applications}</span>
            <span style={{ color: C.green, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.hired}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployerAnalyticsPage() {
  const { data: funnel,    isLoading: fL, isError: fE, refetch: refetchFunnel } = useQuery({ queryKey: ['employer','analytics','funnel'],     queryFn: analyticsApi.getEmployerFunnel })
  const { data: perf,      isLoading: pL } = useQuery({ queryKey: ['employer','analytics','jobs'],       queryFn: analyticsApi.getJobPerformance })
  const { data: recruiter, isLoading: rL } = useQuery({ queryKey: ['employer','analytics','recruiters'], queryFn: analyticsApi.getRecruiterPerformance })
  const { data: kpis }                     = useQuery({ queryKey: ['employer','dashboard','kpis'],       queryFn: analyticsApi.getDashboardKpis })

  if (fE) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Analytics" subtitle="Hiring performance overview" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorState title="Analytics unavailable" description="Could not load analytics data. Please try again." onRetry={() => refetchFunnel()} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Analytics" subtitle="Hiring performance overview" />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>

          {/* KPI strip */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <StatCard icon={Briefcase}   label="Active Jobs"        value={fmtNum(kpis.active_jobs)} />
              <StatCard icon={Users}       label="Total Applications" value={fmtNum(kpis.total_applications)} />
              <StatCard icon={Send}        label="Offers Sent"        value={fmtNum(kpis.offers_sent)} />
              <StatCard icon={UserCheck}   label="Hires"              value={fmtNum(kpis.hires)} />
              <StatCard icon={Clock}       label="Avg. Days to Hire"  value={kpis.avg_time_to_hire_days != null ? `${kpis.avg_time_to_hire_days}d` : '—'} />
              <StatCard icon={TrendingUp}  label="Response Rate"      value={`${kpis.response_rate_pct}%`} />
            </div>
          )}

          {/* Funnel + Donut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={DS.card}>
              <div style={DS.cardHeader}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Application Funnel</span>
                <span style={{ fontSize: 12, color: C.ink3 }}>{funnel?.total_applications ?? 0} total</span>
              </div>
              <div style={{ padding: 20 }}>
                {fL ? <p style={{ fontSize: 12, color: C.ink3 }}>Loading…</p> : funnel ? <FunnelChart stages={funnel.stages} total={funnel.total_applications} /> : null}
              </div>
            </div>

            <div style={DS.card}>
              <div style={DS.cardHeader}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Stage Breakdown</span>
              </div>
              <div style={{ padding: 20 }}>
                {fL ? <p style={{ fontSize: 12, color: C.ink3 }}>Loading…</p> : funnel ? <DonutChart stages={funnel.stages} /> : null}
              </div>
            </div>
          </div>

          {/* Job performance */}
          <div style={DS.card}>
            <div style={DS.cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Job Performance</span>
              <span style={{ fontSize: 12, color: C.ink3 }}>{perf?.jobs.length ?? 0} jobs</span>
            </div>
            {pL ? <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>Loading…</p> : <JobPerfTable jobs={perf?.jobs ?? []} />}
          </div>

          {/* Recruiter performance */}
          <div style={DS.card}>
            <div style={DS.cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Recruiter Performance</span>
            </div>
            {rL ? <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>Loading…</p> : <RecruiterTable recruiters={recruiter?.recruiters ?? []} />}
          </div>

        </div>
      </div>
    </div>
  )
}
