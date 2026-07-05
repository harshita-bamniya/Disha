import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Briefcase, Users, Clock, Target } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Sched.', interview_completed: 'Interviewed',
  offer_sent: 'Offer Sent', hired: 'Hired',
}

const STAGE_COLORS = [
  '#3B82F6', '#0EA5E9', '#6366F1', '#8B5CF6', '#7C3AED', '#059669', '#10B981',
]

// ── Mini card ─────────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 900, color: '#1E3A5F', margin: 0, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '2px 0 0' }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: '#CBD5E1', margin: '1px 0 0' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function FunnelChart({ stages, total }: { stages: { stage: string; count: number; pct_of_total: number }[]; total: number }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stages.map((s, i) => {
        const barWidth = (s.count / maxCount) * 100
        const color = STAGE_COLORS[i % STAGE_COLORS.length]
        return (
          <div key={s.stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {STAGE_LABELS[s.stage] ?? s.stage}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
                {s.count} <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 11 }}>({s.pct_of_total}%)</span>
              </span>
            </div>
            <div style={{ height: 10, background: '#F1F5F9', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 20, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ stages }: { stages: { stage: string; count: number; pct_of_total: number }[] }) {
  const total = stages.reduce((a, s) => a + s.count, 0)
  if (total === 0) return <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No data yet</p>

  const R = 60
  const CX = 90
  const CY = 90
  const circumference = 2 * Math.PI * R
  let cumulativePct = 0

  // Only show top 5 stages by count
  const top = [...stages].sort((a, b) => b.count - a.count).slice(0, 5)

  const arcs = top.map((s, i) => {
    const pct = s.count / total
    const offset = circumference * (1 - pct)
    const rotation = cumulativePct * 360 - 90
    cumulativePct += pct
    return { ...s, pct, offset, rotation, color: STAGE_COLORS[i % STAGE_COLORS.length] }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
        {arcs.map(a => (
          <circle
            key={a.stage}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={28}
            strokeDasharray={`${circumference * a.pct} ${circumference * (1 - a.pct)}`}
            strokeDashoffset={-(circumference * (cumulativePct - a.pct))}
            transform={`rotate(${a.rotation} ${CX} ${CY})`}
          />
        ))}
        <circle cx={CX} cy={CY} r={R - 14} fill="#fff" />
        <text x={CX} y={CY - 6} textAnchor="middle" style={{ fontSize: 18, fontWeight: 900, fill: '#1E3A5F', fontFamily: 'Hind, sans-serif' }}>{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" style={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600, letterSpacing: 0.5 }}>TOTAL</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {arcs.map(a => (
          <div key={a.stage} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 600, flex: 1 }}>{STAGE_LABELS[a.stage] ?? a.stage}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{Math.round(a.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bar chart (SVG) for avg time to hire ─────────────────────────────────────
function TTHBarChart({ jobs }: { jobs: { title: string; hired: number; total_applications: number; conversion_rate_pct: number }[] }) {
  const top = [...jobs].filter(j => j.hired > 0).slice(0, 6)
  if (top.length === 0) return <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 16 }}>No hiring data yet</p>

  const maxConv = Math.max(...top.map(j => j.conversion_rate_pct), 1)
  const barH = 24
  const gap = 10
  const labelW = 130
  const chartW = 200
  const svgH = top.length * (barH + gap)

  return (
    <svg width={labelW + chartW + 60} height={svgH} style={{ overflow: 'visible' }}>
      {top.map((j, i) => {
        const y = i * (barH + gap)
        const w = (j.conversion_rate_pct / maxConv) * chartW
        return (
          <g key={j.title}>
            <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}>
              {j.title.length > 18 ? j.title.slice(0, 17) + '…' : j.title}
            </text>
            <rect x={labelW} y={y} width={w} height={barH} rx={6} fill="#3B82F6" opacity={0.85} />
            <text x={labelW + w + 6} y={y + barH / 2 + 4} style={{ fontSize: 11, fill: '#7C3AED', fontWeight: 700 }}>
              {j.conversion_rate_pct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmployerAnalyticsPage() {
  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['employer', 'analytics', 'funnel'],
    queryFn: analyticsApi.getEmployerFunnel,
  })
  const { data: perf, isLoading: perfLoading } = useQuery({
    queryKey: ['employer', 'analytics', 'jobs'],
    queryFn: analyticsApi.getJobPerformance,
  })
  const { data: recruiterPerf, isLoading: recruiterLoading } = useQuery({
    queryKey: ['employer', 'analytics', 'recruiters'],
    queryFn: analyticsApi.getRecruiterPerformance,
  })
  const { data: kpis } = useQuery({
    queryKey: ['employer', 'dashboard', 'kpis'],
    queryFn: analyticsApi.getDashboardKpis,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F0FE 50%, #F5F0FF 100%)', padding: '28px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link to="/app/employer/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.95)', color: '#64748B', textDecoration: 'none' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: '#1E3A5F', margin: 0 }}>Hiring Analytics</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Company-wide hiring performance</p>
          </div>
        </div>

        {/* KPI strip */}
        {kpis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <MetricCard icon={Briefcase}  label="Active Jobs"       value={kpis.active_jobs}              color="#3B82F6" />
            <MetricCard icon={Users}      label="Total Applications" value={kpis.total_applications}        color="#7C3AED" />
            <MetricCard icon={Target}     label="Offers Sent"        value={kpis.offers_sent}               color="#059669" />
            <MetricCard icon={TrendingUp} label="Hires"              value={kpis.hires}                     color="#1E3A5F" />
            <MetricCard icon={Clock}      label="Avg. Time to Hire"  value={kpis.avg_time_to_hire_days !== null ? `${kpis.avg_time_to_hire_days}d` : '—'} color="#D97706" />
            <MetricCard icon={TrendingUp} label="Response Rate"      value={`${kpis.response_rate_pct}%`}  color="#0EA5E9" />
          </div>
        )}

        {/* Row 1: Funnel + Donut */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Funnel bar */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={15} color="#3B82F6" />Application Funnel
            </h2>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 16px' }}>
              {funnelLoading ? 'Loading…' : `${funnel?.total_applications ?? 0} total applications`}
            </p>
            {funnelLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[80, 60, 45, 35, 25, 15, 8].map(w => (
                  <div key={w} style={{ height: 10, borderRadius: 20, background: '#F1F5F9', width: `${w}%` }} />
                ))}
              </div>
            ) : funnel ? (
              <FunnelChart stages={funnel.stages} total={funnel.total_applications} />
            ) : null}
          </div>

          {/* Donut breakdown */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Target size={15} color="#7C3AED" />Stage Breakdown
            </h2>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 16px' }}>Distribution across pipeline stages</p>
            {funnelLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : funnel ? (
              <DonutChart stages={funnel.stages} />
            ) : null}
          </div>
        </div>

        {/* Row 2: Job conversion bar chart */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Briefcase size={15} color="#3B82F6" />Job Conversion Rates
          </h2>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 16px' }}>Applications → Hire conversion per job</p>
          {perfLoading ? (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : perf && perf.jobs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <TTHBarChart jobs={perf.jobs} />
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No job postings yet.</p>
          )}
        </div>

        {/* Row 3: Job performance table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <Briefcase size={16} color="#3B82F6" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Job Performance</h2>
          </div>
          {perfLoading ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : !perf || perf.jobs.length === 0 ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>No job postings yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Job', 'Applications', 'Shortlisted', 'Interviewed', 'Hired', 'Conversion'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Job' ? 'left' : 'right', padding: h === 'Job' ? '10px 20px' : '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perf.jobs.map(j => (
                    <tr key={j.job_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: '#0F172A' }}>
                        {j.title}
                        {!j.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>(paused)</span>}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{j.total_applications}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{j.shortlisted}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{j.interviewed}</td>
                      <td style={{ textAlign: 'right', padding: '12px', color: '#059669', fontWeight: 700 }}>{j.hired}</td>
                      <td style={{ textAlign: 'right', padding: '12px 20px' }}>
                        <span style={{ fontWeight: 700, color: j.conversion_rate_pct >= 10 ? '#059669' : j.conversion_rate_pct >= 5 ? '#D97706' : '#DC2626' }}>
                          {j.conversion_rate_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recruiter performance */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <Users size={16} color="#3B82F6" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Recruiter Performance</h2>
          </div>
          {recruiterLoading ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : !recruiterPerf || recruiterPerf.recruiters.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Users size={32} color="#E5E7EB" style={{ display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>No team activity recorded yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Recruiter', 'Moved', 'Interviews', 'Notes', 'Hires', 'Avg TTH'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Recruiter' ? 'left' : 'right', padding: h === 'Recruiter' ? '10px 20px' : '10px 12px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recruiterPerf.recruiters.map(r => (
                    <tr key={r.user_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#3B82F6', flexShrink: 0 }}>
                            {(r.name ?? 'U')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{r.name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{r.applications_moved}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{r.interviews_conducted}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{r.notes_added}</td>
                      <td style={{ textAlign: 'right', padding: '12px', color: '#059669', fontWeight: 700 }}>{r.hires_closed}</td>
                      <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 700, color: '#D97706' }}>
                        {r.avg_days_to_hire !== null ? `${r.avg_days_to_hire}d` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
