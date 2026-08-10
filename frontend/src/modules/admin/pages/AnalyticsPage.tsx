import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2, Users, Briefcase, TrendingUp, Target, Download, Calendar,
} from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { AnalyticsResponse, TimeSeriesPoint, FunnelStage, ScoreBin, CohortRow } from '@/api/admin'
import { Spinner, downloadCSV } from '@/modules/admin/shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'


// ── Date range picker ──────────────────────────────────────────────────────────

type Preset = 7 | 30 | 90
const PRESETS: { label: string; value: Preset }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

type DateRange =
  | { type: 'preset'; days: Preset }
  | { type: 'custom'; from: string; to: string }

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const [showCustom, setShowCustom] = useState(value.type === 'custom')
  const [from, setFrom] = useState(value.type === 'custom' ? value.from : '')
  const [to, setTo]     = useState(value.type === 'custom' ? value.to : '')

  const applyCustom = () => {
    if (from && to && from <= to) onChange({ type: 'custom', from, to })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map(p => (
        <button
          key={p.value}
          onClick={() => { setShowCustom(false); onChange({ type: 'preset', days: p.value }) }}
          style={
            value.type === 'preset' && value.days === p.value
              ? { background: colors.brand.navy, color: '#fff', borderRadius: 10, border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600 }
              : { background: '#fff', color: colors.text.ink, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: '6px 12px', fontSize: 12, fontWeight: 600 }
          }
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setShowCustom(c => !c)}
        className="flex items-center gap-1.5"
        style={
          showCustom
            ? { background: colors.surface.bg, color: colors.text.ink, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: '6px 12px', fontSize: 12, fontWeight: 600 }
            : { background: '#fff', color: colors.text.ink, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: '6px 12px', fontSize: 12, fontWeight: 600 }
        }
      >
        <Calendar className="w-3 h-3" />
        Custom
      </button>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 32, padding: '0 8px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, outline: 'none' }} />
          <span style={{ fontSize: 12, color: colors.text.muted }}>–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 32, padding: '0 8px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, outline: 'none' }} />
          <button
            onClick={applyCustom}
            disabled={!from || !to || from > to}
            style={{ height: 32, padding: '0 12px', borderRadius: 10, background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', opacity: (!from || !to || from > to) ? 0.4 : 1 }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

// ── SVG bar chart ──────────────────────────────────────────────────────────────

function BarChart({
  data, xKey, yKey, color = '#6C63FF', height = 160,
}: {
  data: Record<string, any>[]
  xKey: string
  yKey: string
  color?: string
  height?: number
}) {
  if (!data.length) return <p style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', padding: '32px 0' }}>No data for this period</p>

  const maxVal = Math.max(...data.map(d => d[yKey] as number), 1)
  const W = 600
  const H = height
  const padL = 28
  const padB = 28
  const padT = 8
  const padR = 8
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = Math.max(4, chartW / data.length - 4)
  const gap = chartW / data.length

  const step = Math.ceil(data.length / 7)
  const labelIndices = new Set(data.map((_, i) => i).filter((_, i) => i % step === 0))
  if (data.length > 1) labelIndices.add(data.length - 1)

  const yTicks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {yTicks.map(t => {
        const y = padT + chartH - (t / maxVal) * chartH
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill={colors.text.muted}>{t}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const val = d[yKey] as number
        const barH = (val / maxVal) * chartH
        const x = padL + i * gap + (gap - barW) / 2
        const y = padT + chartH - barH
        const label = String(d[xKey])
        const shortLabel = label.length > 5 ? label.slice(5) : label

        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} opacity={0.85} />
            <title>{`${label}: ${val}`}</title>
            {data.length <= 15 && val > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill={color} fontWeight="600">{val}</text>
            )}
            {labelIndices.has(i) && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={8} fill={colors.text.muted}>{shortLabel}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Funnel chart ───────────────────────────────────────────────────────────────

const FUNNEL_COLORS: Record<string, string> = {
  applied: '#6C63FF',
  shortlisted: '#22C55E',
  interview_scheduled: '#F59E0B',
  interviewed: '#3B82F6',
  offered: '#8B5CF6',
  hired: '#10B981',
  rejected: '#EF4444',
}
const FUNNEL_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
}

function FunnelChart({ data }: { data: FunnelStage[] }) {
  if (!data.length) return <p style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', padding: '32px 0' }}>No applications in this period</p>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => {
        const pct = Math.round((d.count / max) * 100)
        const color = FUNNEL_COLORS[d.status] ?? colors.text.muted
        return (
          <div key={d.status} className="flex items-center gap-3">
            <span style={{ fontSize: 12, color: colors.text.muted, width: 160, flexShrink: 0 }}>{FUNNEL_LABELS[d.status] ?? d.status}</span>
            <div style={{ flex: 1, background: colors.surface.bg, borderRadius: 9999, height: 12, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, background: color, height: 12, borderRadius: 9999, transition: 'all 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, width: 40, textAlign: 'right' }}>{d.count.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Score distribution chart ───────────────────────────────────────────────────

function ScoreChart({ data }: { data: ScoreBin[] }) {
  return <BarChart data={data} xKey="range" yKey="count" color="#8B5CF6" height={140} />
}

// ── Cohort table ───────────────────────────────────────────────────────────────

function CohortTable({ data }: { data: CohortRow[] }) {
  if (!data.length) return <p style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', padding: '32px 0' }}>No cohort data available</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: colors.surface.bg }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Cohort (signup month)</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Signups</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Applied</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Hired</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Apply rate</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>Hire rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const applyRate = row.signups > 0 ? Math.round((row.applied / row.signups) * 100) : 0
            const hireRate  = row.applied > 0 ? Math.round((row.hired  / row.applied) * 100) : 0
            return (
              <tr
                key={row.month}
                style={{ background: idx % 2 === 0 ? '#fff' : colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
                onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : colors.surface.bg)}
              >
                <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: colors.text.ink }}>{row.month}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: colors.text.ink, textAlign: 'right' }}>{row.signups.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: colors.text.ink, textAlign: 'right' }}>{row.applied.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#16A34A', textAlign: 'right' }}>{row.hired.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: applyRate >= 50 ? '#16A34A' : applyRate >= 20 ? '#D97706' : colors.text.muted }}>
                    {applyRate}%
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: hireRate >= 10 ? '#16A34A' : hireRate >= 5 ? '#D97706' : colors.text.muted }}>
                    {hireRate}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Chart card wrapper ─────────────────────────────────────────────────────────

function ChartCard({
  icon: Icon, title, subtitle, children, onExport,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
  onExport?: () => void
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20 }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon className="w-4 h-4" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 900, color: colors.text.ink }}>{title}</p>
            {subtitle && <p style={{ fontSize: 12, color: colors.text.muted }}>{subtitle}</p>}
          </div>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1"
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.muted, fontSize: 12, fontWeight: 600 }}
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Summary stat pills ─────────────────────────────────────────────────────────

function SummaryPills({ data }: { data: AnalyticsResponse }) {
  const totalUsers = data.user_growth.reduce((s, d) => s + d.count, 0)
  const totalJobs  = data.job_volume.reduce((s, d) => s + d.count, 0)
  const totalApps  = data.application_funnel.reduce((s, d) => s + d.count, 0)
  const hired      = data.application_funnel.find(d => d.status === 'hired')?.count ?? 0

  const pills = [
    { label: 'New users', value: totalUsers },
    { label: 'Jobs posted', value: totalJobs },
    { label: 'Applications', value: totalApps },
    { label: 'Hires', value: hired },
  ]
  return (
    <div className="flex gap-3 flex-wrap mb-6">
      {pills.map(p => (
        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: colors.surface.bg, border: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: colors.text.ink }}>{p.value.toLocaleString()}</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: colors.text.muted }}>{p.label}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: colors.surface.bg, border: '1px solid rgba(0,0,0,0.08)' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: colors.text.muted }}>Period:</span>
        <span style={{ fontWeight: 700, fontSize: 12, color: colors.text.ink }}>{data.period.from_date} → {data.period.to_date}</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>({ type: 'preset', days: 30 })

  const params = range.type === 'preset'
    ? { days: range.days }
    : { from_date: range.from, to_date: range.to }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'analytics', params],
    queryFn: () => adminApi.getAnalytics(params),
    staleTime: 60_000,
  })

  const handleExport = useCallback((filename: string, rows: object[]) => {
    if (rows.length) downloadCSV(rows, filename)
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 className="w-5 h-5" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Analytics & Reports</h1>
            <p style={{ fontSize: 14, color: colors.text.muted }}>Platform growth, hiring funnel, match quality, and cohort retention.</p>
          </div>
        </div>
        {data && (
          <button
            onClick={() => handleExport(
              `disha_analytics_${data.period.from_date}_${data.period.to_date}`,
              [
                ...data.user_growth.map(d => ({ type: 'user_growth', ...d })),
                ...data.job_volume.map(d => ({ type: 'job_volume', ...d })),
              ],
            )}
            className="flex items-center gap-1.5 shrink-0"
            style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.ink, fontSize: 12, fontWeight: 600 }}
          >
            <Download className="w-3.5 h-3.5" />
            Export all CSV
          </button>
        )}
      </div>

      {/* Date range picker */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.muted }}>Period:</span>
        <DateRangePicker value={range} onChange={setRange} />
        {isFetching && !isLoading && (
          <span style={{ fontSize: 12, color: colors.text.muted }} className="animate-pulse">Refreshing…</span>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data ? null : (
        <>
          <SummaryPills data={data} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard
              icon={Users}
              title="User Growth"
              subtitle="New signups per day"
              onExport={() => handleExport('user_growth', data.user_growth)}
            >
              <BarChart data={data.user_growth} xKey="date" yKey="count" color="#6C63FF" />
            </ChartCard>

            <ChartCard
              icon={Briefcase}
              title="Job Posting Volume"
              subtitle="New jobs posted per day"
              onExport={() => handleExport('job_volume', data.job_volume)}
            >
              <BarChart data={data.job_volume} xKey="date" yKey="count" color="#3B82F6" />
            </ChartCard>

            <ChartCard
              icon={TrendingUp}
              title="Application Funnel"
              subtitle="Applications by stage in period"
              onExport={() => handleExport('application_funnel', data.application_funnel)}
            >
              <FunnelChart data={data.application_funnel} />
            </ChartCard>

            <ChartCard
              icon={Target}
              title="Match Score Distribution"
              subtitle="AI match score buckets across applications"
              onExport={() => handleExport('match_scores', data.match_score_distribution)}
            >
              <ScoreChart data={data.match_score_distribution} />
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard
              icon={BarChart2}
              title="Cohort Retention"
              subtitle="Signup month → who applied → who got hired (last 6 months)"
              onExport={() => handleExport('cohort_table', data.cohort_table)}
            >
              <CohortTable data={data.cohort_table} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
