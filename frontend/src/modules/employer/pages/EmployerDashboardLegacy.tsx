import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { colors, radius, shadows } from '@/design-system/tokens'
import {
  Plus, Building2, Users2, ShieldCheck, CreditCard,
  CheckCircle2, ChevronRight, ArrowUpRight, AlertCircle,
  Activity, Briefcase, UserCheck,
} from 'lucide-react'
import {
  useEmployerDashboard, useDashboardKpis, useApplicationTrend,
  useUpcomingInterviews, useCompanyProfile, useDepartments,
  useEmployerPermissions, useTeamMembers, useVerificationStatus, useSubscription,
  useTeamActivity,
} from '../hooks/useJobs'
import { useEffect, useMemo, useState } from 'react'
import { analyticsApi, type RecruiterPerformanceEntry } from '@/api/analytics'
import Button from '@/shared/components/primitives/Button'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import ErrorState from '@/shared/components/feedback/ErrorState'
import AlertBanner from '@/shared/components/feedback/AlertBanner'
import PageHeader from '@/shared/layouts/PageHeader'
import { C } from '../ds'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, fallback = '—'): string {
  if (n == null) return fallback
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: Record<string, number> }) {
  const navigate = useNavigate()
  const stats = [
    { label: 'Active Jobs',        value: fmt(kpis.active_jobs),                                                      to: '/app/employer/jobs' },
    { label: 'Total Applications', value: fmt(kpis.total_applications),                                               to: '/app/employer/applicants' },
    { label: 'Applied Today',      value: fmt(kpis.applications_today),                                               to: undefined },
    { label: 'Interviews',         value: fmt(kpis.interviews_scheduled),                                             to: '/app/employer/calendar' },
    { label: 'Offers Sent',        value: fmt(kpis.offers_sent),                                                      to: '/app/employer/offers' },
    { label: 'Hires',              value: fmt(kpis.hires),                                                            to: undefined },
    { label: 'Response Rate',      value: `${kpis.response_rate_pct ?? 0}%`,                                         to: undefined },
    { label: 'Avg. Time to Hire',  value: kpis.avg_time_to_hire_days != null ? `${kpis.avg_time_to_hire_days}d` : '—', to: undefined },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
      gap: 12,
    }}>
      {stats.map(s => (
        <div
          key={s.label}
          onClick={() => s.to && navigate(s.to)}
          style={{
            background: colors.surface.card,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.lg,
            boxShadow: shadows.card,
            padding: '16px 18px',
            cursor: s.to ? 'pointer' : 'default',
            transition: 'box-shadow 0.15s, transform 0.15s',
          }}
          onMouseOver={e => { if (s.to) { e.currentTarget.style.boxShadow = shadows.cardHover; e.currentTarget.style.transform = 'translateY(-1px)' } }}
          onMouseOut={e => { e.currentTarget.style.boxShadow = shadows.card; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <p style={{
            fontSize: 22, fontWeight: 700, color: colors.text.ink,
            margin: 0, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
          }}>{s.value}</p>
          <p style={{ fontSize: 11, color: colors.text.muted, margin: '5px 0 0', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Application Trend (SVG area chart) ────────────────────────────────────────

function ApplicationTrend() {
  const { data } = useApplicationTrend(30)
  const series = data?.series ?? []
  const total  = series.reduce((s, p) => s + p.count, 0)
  const max    = Math.max(1, ...series.map(p => p.count))

  const W = 520, H = 120, PAD = { t: 10, r: 8, b: 28, l: 36 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b

  const pts = series.map((p, i) => ({
    x: PAD.l + (series.length < 2 ? cw / 2 : (i / (series.length - 1)) * cw),
    y: PAD.t + ch - (p.count / max) * ch,
    count: p.count,
    date: p.date,
  }))

  const pathD = pts.length < 2
    ? ''
    : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const areaD = pts.length < 2
    ? ''
    : `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + ch).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t + ch).toFixed(1)} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(r => ({
    y: PAD.t + ch * (1 - r),
    label: r === 0 ? '0' : Math.round(max * r).toString(),
  }))

  const tickCount = Math.min(6, series.length)
  const tickIndices = series.length < 2 ? [] : Array.from({ length: tickCount }, (_, i) =>
    Math.round(i * (series.length - 1) / (tickCount - 1))
  )

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>Application Trend</p>
          <p style={{ fontSize: 12, color: colors.text.muted, margin: '2px 0 0' }}>Last 30 days</p>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: colors.text.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{fmt(total)}</span>
            <span style={{ fontSize: 11, color: colors.text.muted }}>total</span>
          </div>
        )}
      </div>

      {series.length < 2 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 12, color: colors.text.muted }}>No applications yet</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines.map(g => (
            <g key={g.y}>
              <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke={colors.surface.elevated} strokeWidth="1" />
              <text x={PAD.l - 6} y={g.y + 4} fontSize="9" fill={colors.text.muted} textAnchor="end">{g.label}</text>
            </g>
          ))}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* Line */}
          {pathD && <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}

          {/* X-axis ticks */}
          {tickIndices.map(idx => {
            const p = pts[idx]
            const d = new Date(series[idx].date)
            const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            return (
              <text key={idx} x={p.x} y={H - 4} fontSize="9" fill={colors.text.muted} textAnchor="middle">{label}</text>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── Hiring Funnel ─────────────────────────────────────────────────────────────

function HiringFunnel({ kpis }: { kpis: Record<string, number> }) {
  const stages = [
    { label: 'Applications', value: kpis.total_applications,    pct: 100 },
    { label: 'Screened',     value: kpis.interviews_scheduled,  pct: kpis.total_applications > 0 ? Math.round((kpis.interviews_scheduled / kpis.total_applications) * 100) : 0 },
    { label: 'Offers',       value: kpis.offers_sent,           pct: kpis.total_applications > 0 ? Math.round((kpis.offers_sent / kpis.total_applications) * 100) : 0 },
    { label: 'Hired',        value: kpis.hires,                 pct: kpis.total_applications > 0 ? Math.round((kpis.hires / kpis.total_applications) * 100) : 0 },
  ]

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: '18px 20px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: '0 0 16px' }}>Hiring Funnel</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stages.map((s, i) => (
          <div key={s.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: colors.text.inkSoft, fontWeight: 500 }}>{s.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{s.value}</span>
              </div>
            </div>
            <div style={{ height: 5, background: colors.surface.elevated, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                width: `${s.pct}%`, height: '100%', borderRadius: 99,
                background: i === 0 ? '#2563EB' : i === 1 ? '#7C3AED' : i === 2 ? '#0891B2' : '#16A34A',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Organization summary (company-wide owners/HR managers only) ───────────────
// Recruiting KPIs below answer "how is this req pipeline doing" — this strip
// answers "how is my org doing", which a company-wide viewer overseeing
// multiple departments needs to see first, not buried under job-level stats.

function OrgSummaryStrip() {
  const navigate = useNavigate()
  const { data: departments } = useDepartments()
  const { data: team } = useTeamMembers()
  const { data: verification } = useVerificationStatus()
  const { data: subscription } = useSubscription()

  const isVerified = verification?.status === 'approved'

  const tiles = [
    {
      label: 'Departments', value: fmt(departments?.length),
      icon: Building2, color: '#7C3AED', to: '/app/employer/departments',
    },
    {
      label: 'Team members', value: fmt(team?.length),
      icon: Users2, color: colors.state.info, to: '/app/employer/company',
    },
    {
      label: 'Verification', value: isVerified ? 'Verified' : 'Pending',
      icon: isVerified ? ShieldCheck : AlertCircle,
      color: isVerified ? colors.state.success : colors.state.warning,
      to: '/app/employer/verification',
    },
    {
      label: 'Plan', value: subscription?.plan.name ?? '—',
      icon: CreditCard, color: colors.state.info, to: '/app/employer/subscription',
      capitalize: true,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {tiles.map(t => (
        <div
          key={t.label}
          onClick={() => navigate(t.to)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: colors.surface.card, border: `1px solid ${colors.border.default}`,
            borderRadius: radius.lg, boxShadow: shadows.card, padding: '12px 14px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: `${t.color}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <t.icon size={15} color={t.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: 0,
              textTransform: t.capitalize ? 'capitalize' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{t.value}</p>
            <p style={{ fontSize: 11, color: colors.text.muted, margin: 0 }}>{t.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Departments table ─────────────────────────────────────────────────────────

function DepartmentsTable() {
  const { data: departments } = useDepartments()
  const navigate = useNavigate()
  if (!departments?.length) return null

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: `1px solid ${colors.border.default}`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>
          Departments <span style={{ fontSize: 11, color: colors.text.muted, fontWeight: 400, marginLeft: 4 }}>{departments.length}</span>
        </p>
        <Link to="/app/employer/departments" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 12, color: colors.state.info, fontWeight: 500, textDecoration: 'none',
        }}>
          Manage <ChevronRight size={12} />
        </Link>
      </div>

      {/* Narrower than ~500px, this table scrolls horizontally rather than
          squishing columns or overflowing the card — standard pattern for
          tabular data that doesn't reflow into a single column sensibly. */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 500 }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 90px 90px 90px',
            padding: '8px 20px', background: colors.surface.bg,
            borderBottom: `1px solid ${colors.border.default}`,
          }}>
            {['Department', 'Head', 'Members', 'Active Jobs', 'Applicants'].map(col => (
              <span key={col} style={{ fontSize: 11, fontWeight: 600, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</span>
            ))}
          </div>

          {departments.map((d, i) => (
            <div
              key={d.id}
              onClick={() => navigate(`/app/employer/departments/${d.id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 90px 90px 90px',
                padding: '11px 20px',
                borderBottom: i < departments.length - 1 ? `1px solid ${colors.surface.bg}` : 'none',
                cursor: 'pointer', transition: 'background 0.1s',
                alignItems: 'center',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#F4F5F7' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: colors.surface.elevated,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={13} color={colors.text.muted} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.ink }}>{d.name}</span>
              </div>
              <span style={{ fontSize: 12, color: colors.text.muted }}>{d.head_name ?? '—'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{d.member_count}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{d.active_job_count}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{d.total_applicant_count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Upcoming Interviews ────────────────────────────────────────────────────────

function UpcomingInterviews() {
  const { data: interviews } = useUpcomingInterviews(5)

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${colors.border.default}`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>Upcoming Interviews</p>
        <Link to="/app/employer/calendar" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 12, color: colors.state.info, fontWeight: 500, textDecoration: 'none',
        }}>
          Calendar <ChevronRight size={12} />
        </Link>
      </div>

      {!interviews?.length ? (
        <div style={{ padding: '24px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: 12, color: colors.text.muted, margin: 0 }}>No upcoming interviews</p>
        </div>
      ) : (
        interviews.map((iv, i) => {
          const d = new Date(iv.scheduled_at)
          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={iv.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 18px',
              borderBottom: i < interviews.length - 1 ? `1px solid ${colors.surface.bg}` : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 7,
                background: colors.state.infoBg,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 9, color: '#93C5FD', fontWeight: 600, textTransform: 'uppercase' }}>
                  {d.toLocaleString('en-IN', { month: 'short' })}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: colors.text.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iv.candidate_name ?? 'Candidate'}</p>
                <p style={{ fontSize: 11, color: colors.text.muted, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iv.job_title}</p>
              </div>
              <span style={{ fontSize: 11, color: colors.text.muted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Action Items ──────────────────────────────────────────────────────────────

function ActionItems({ kpis }: { kpis: Record<string, number> }) {
  const navigate = useNavigate()

  const items: { label: string; count: number; to: string; color: string }[] = []
  if (kpis.draft_jobs > 0)          items.push({ label: 'draft jobs to publish', count: kpis.draft_jobs,           to: '/app/employer/jobs',     color: '#7C3AED' })
  if (kpis.interviews_scheduled > 0) items.push({ label: 'interviews scheduled',  count: kpis.interviews_scheduled, to: '/app/employer/calendar', color: '#D97706' })
  if (kpis.offers_pending > 0)       items.push({ label: 'offers pending response',count: kpis.offers_pending,      to: '/app/employer/offers',   color: '#0891B2' })

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>Action Items</p>
        <span style={{ fontSize: 11, color: colors.text.muted }}>Needs attention</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <CheckCircle2 size={15} color="#16A34A" />
          <p style={{ fontSize: 12, color: colors.text.muted, margin: 0 }}>All caught up</p>
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            onClick={() => navigate(item.to)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 18px',
              borderBottom: i < items.length - 1 ? `1px solid ${colors.surface.bg}` : 'none',
              cursor: 'pointer', transition: 'background 0.1s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#F4F5F7' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 20, borderRadius: 4,
                background: `${item.color}15`, color: item.color,
                fontSize: 11, fontWeight: 700, padding: '0 5px',
                fontVariantNumeric: 'tabular-nums',
              }}>{item.count}</span>
              <span style={{ fontSize: 12, color: colors.text.inkSoft }}>{item.label}</span>
            </div>
            <ArrowUpRight size={13} color={colors.text.muted} />
          </div>
        ))
      )}
    </div>
  )
}

// ── Verification banner ───────────────────────────────────────────────────────

export function VerificationBanner() {
  return (
    <AlertBanner
      variant="warning"
      title="Verification pending"
      message="Job posting is locked until your company documents are submitted."
      action={
        <Link to="/app/employer/verification" style={{
          padding: '5px 12px', borderRadius: 6,
          background: colors.state.warning, color: 'white',
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
        }}>
          Start verification
        </Link>
      }
    />
  )
}

// ── Setup Banner ──────────────────────────────────────────────────────────────

export function SetupBanner() {
  const { data: company } = useCompanyProfile()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('setup_banner_v2') === '1')
  if (!company || company.industry || dismissed) return null

  return (
    <AlertBanner
      variant="info"
      title="Complete your company profile"
      message="Add industry, logo, and description to attract stronger candidates."
      action={
        <Link to="/app/employer/setup" style={{
          padding: '5px 12px', borderRadius: 6,
          background: colors.state.info, color: 'white',
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
        }}>
          Complete
        </Link>
      }
      onDismiss={() => { sessionStorage.setItem('setup_banner_v2', '1'); setDismissed(true) }}
    />
  )
}

// ── Insights — folded in from the old standalone Analytics page. Only the
// three views that weren't already covered above (Application Trend /
// Hiring Funnel) survive the merge: team activity, per-job performance, and
// per-recruiter performance. All three are opt-in behind a tile click so
// the page doesn't front-load three extra network calls' worth of tables
// for someone who only wanted the at-a-glance numbers above. ──────────────

function formatAction(a: string) {
  return a.replace(/_/g, ' ').replace(/\./g, ' › ').replace(/\b\w/g, c => c.toUpperCase())
}

function JobPerfTable({ jobs }: { jobs: { title: string; hired: number; total_applications: number; conversion_rate_pct: number }[] }) {
  if (!jobs.length) return <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>No job data yet.</p>
  const COLS = '1fr 90px 90px 100px'
  return (
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

function RecruiterTable({ recruiters }: { recruiters: RecruiterPerformanceEntry[] }) {
  if (!recruiters.length) return <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>No recruiter data yet.</p>
  const COLS = '1fr 100px 100px 90px'
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 400 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '8px 20px', background: colors.surface.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {['Recruiter', 'Applications Moved', 'Interviews', 'Hired'].map(h => <span key={h}>{h}</span>)}
        </div>
        {recruiters.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 20px', borderBottom: `1px solid ${C.borderLight}`, fontSize: 13, alignItems: 'center' }}
            onMouseOver={e => { e.currentTarget.style.background = colors.surface.elevated }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontWeight: 500, color: C.ink1 }}>{r.name ?? 'Unknown'}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{r.applications_moved}</span>
            <span style={{ color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{r.interviews_conducted}</span>
            <span style={{ color: C.green, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.hires_closed}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
        border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.accentBg : 'transparent',
        color: active ? C.accent : C.ink2,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  )
}

function ActivityPanel() {
  const { data: activity, isLoading } = useTeamActivity()
  const [filterDept, setFilterDept] = useState<string | 'all' | 'unassigned'>('all')

  const depts = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    let unassigned = 0
    for (const entry of activity ?? []) {
      if (entry.department_id) {
        const existing = map.get(entry.department_id)
        map.set(entry.department_id, { name: entry.department_name ?? 'Unknown', count: (existing?.count ?? 0) + 1 })
      } else {
        unassigned += 1
      }
    }
    return { byId: map, unassigned }
  }, [activity])

  const filtered = (activity ?? []).filter(e => {
    if (filterDept === 'all') return true
    if (filterDept === 'unassigned') return !e.department_id
    return e.department_id === filterDept
  })

  if (isLoading) return <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>Loading…</p>
  if (!activity || activity.length === 0) return <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>No team activity recorded yet.</p>

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '14px 20px 0' }}>
        <Chip label="All" count={activity.length} active={filterDept === 'all'} onClick={() => setFilterDept('all')} />
        {[...depts.byId.entries()].map(([id, d]) => (
          <Chip key={id} label={d.name} count={d.count} active={filterDept === id} onClick={() => setFilterDept(id)} />
        ))}
        {depts.unassigned > 0 && (
          <Chip label="Company-wide" count={depts.unassigned} active={filterDept === 'unassigned'} onClick={() => setFilterDept('unassigned')} />
        )}
      </div>

      <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 10 }}>
        {filtered.length === 0 ? (
          <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3 }}>No activity for this department yet.</p>
        ) : filtered.map((entry, idx) => (
          <div
            key={entry.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 20px',
              borderBottom: idx < filtered.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.accentBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Activity size={13} color={C.accent} />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0 }}>
                {formatAction(entry.action)}
              </p>
              <p style={{ fontSize: 11, color: C.ink2, margin: '2px 0 0' }}>
                {entry.actor_name ?? entry.actor_email ?? 'Unknown'}
                {entry.department_name ? ` · ${entry.department_name}` : ''}
                {entry.resource ? ` · ${entry.resource}` : ''}
              </p>
            </div>
            <span style={{ fontSize: 11, color: C.ink3, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, label, headline, sub, active, onClick, accentColor }: {
  icon: React.ElementType; label: string; headline: string; sub: string;
  active: boolean; onClick: () => void; accentColor: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', background: colors.surface.card,
        border: `1.5px solid ${active ? accentColor : colors.border.default}`,
        borderRadius: radius.xl, padding: '14px 16px',
        boxShadow: active ? `0 0 0 3px ${accentColor}1A` : 'none',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accentColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={accentColor} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink1 }}>{label}</span>
        <ChevronRight size={13} color={C.ink3} style={{ marginLeft: 'auto' }} />
      </div>
      <p style={{ fontSize: 18, fontWeight: 700, color: C.ink1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{headline}</p>
      <p style={{ fontSize: 11, color: C.ink3, margin: '3px 0 0' }}>{sub}</p>
    </button>
  )
}

type InsightsSection = 'activity' | 'jobs' | 'recruiters'

export function Insights({ defaultSection }: { defaultSection: InsightsSection }) {
  const [section, setSection] = useState<InsightsSection>(defaultSection)
  const { data: perf,      isLoading: pL } = useQuery({ queryKey: ['employer','analytics','jobs'],       queryFn: analyticsApi.getJobPerformance })
  const { data: recruiter, isLoading: rL } = useQuery({ queryKey: ['employer','analytics','recruiters'], queryFn: analyticsApi.getRecruiterPerformance })
  const { data: activity }                 = useTeamActivity()

  const topJob = perf?.jobs.length ? [...perf.jobs].sort((a, b) => b.conversion_rate_pct - a.conversion_rate_pct)[0] : null
  const topRecruiter = recruiter?.recruiters.length ? [...recruiter.recruiters].sort((a, b) => b.hires_closed - a.hires_closed)[0] : null
  const deptCount = new Set((activity ?? []).filter(e => e.department_id).map(e => e.department_id)).size

  return (
    <div id="activity" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>Insights</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <SectionCard
          icon={Activity} label="Team Activity" accentColor="#7C3AED"
          active={section === 'activity'} onClick={() => setSection('activity')}
          headline={String(activity?.length ?? 0)}
          sub={deptCount > 0 ? `Across ${deptCount} department${deptCount === 1 ? '' : 's'}` : 'Recent actions'}
        />
        <SectionCard
          icon={Briefcase} label="Job Performance" accentColor={colors.state.success}
          active={section === 'jobs'} onClick={() => setSection('jobs')}
          headline={String(perf?.jobs.length ?? 0)}
          sub={topJob ? `Best: ${topJob.title} (${topJob.conversion_rate_pct}%)` : 'No jobs yet'}
        />
        <SectionCard
          icon={UserCheck} label="Recruiter Performance" accentColor={colors.state.warning}
          active={section === 'recruiters'} onClick={() => setSection('recruiters')}
          headline={String(recruiter?.recruiters.length ?? 0)}
          sub={topRecruiter ? `Top: ${topRecruiter.name ?? 'Unknown'} (${topRecruiter.hires_closed} hired)` : 'No recruiters yet'}
        />
      </div>

      <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
        {section === 'activity' && (
          <>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border.default}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Team Activity</span>
              <span style={{ fontSize: 12, color: C.ink3, marginLeft: 8 }}>Last 50 actions</span>
            </div>
            <ActivityPanel />
          </>
        )}
        {section === 'jobs' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${colors.border.default}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Job Performance</span>
              <span style={{ fontSize: 12, color: C.ink3 }}>{perf?.jobs.length ?? 0} jobs</span>
            </div>
            {pL ? <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>Loading…</p> : <JobPerfTable jobs={perf?.jobs ?? []} />}
          </>
        )}
        {section === 'recruiters' && (
          <>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.border.default}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Recruiter Performance</span>
            </div>
            {rL ? <p style={{ padding: '16px 20px', fontSize: 13, color: C.ink3, margin: 0 }}>Loading…</p> : <RecruiterTable recruiters={recruiter?.recruiters ?? []} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Skeleton — uses shared SkeletonCard, no local keyframes ──────────────────

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SkeletonCard lines={2} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
      <SkeletonCard lines={5} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LegacyEmployerDashboard() {
  const { data, isLoading, isError, refetch } = useEmployerDashboard()
  const { data: kpis, isLoading: kL }         = useDashboardKpis()
  const { data: perms }                       = useEmployerPermissions()
  const { data: departments }                 = useDepartments()
  const navigate                              = useNavigate()
  const location                              = useLocation()

  // Default true while permissions load — matches EmployerSidebar's own
  // fallback so the org strip doesn't flash in and out on first paint.
  const isCompanyWide = perms?.is_company_wide ?? true

  // "Post a Job" used to always land on the read-only Jobs Overview page,
  // which then told you to "open a department" to actually post one — a
  // detour for the exact people most likely to click this button first. Skip
  // it whenever we can resolve a single, unambiguous department to jump
  // straight into: the caller's own department if they're dept-scoped, or
  // the company's only department if they're company-wide with just one.
  // Zero departments or more than one still can't be guessed — send those
  // to the Departments page (workspace picker / create-first-department),
  // which is a more useful landing spot than Jobs Overview either way.
  const handlePostJob = () => {
    if (!isCompanyWide && perms?.department_id) {
      navigate(`/app/employer/departments/${perms.department_id}?newJob=1`)
    } else if (isCompanyWide && departments?.length === 1) {
      navigate(`/app/employer/departments/${departments[0].id}?newJob=1`)
    } else {
      // Zero departments (nothing to jump into) or 2+ (can't guess which) —
      // the Departments page itself is a better landing spot either way
      // than the old Jobs Overview dead end.
      navigate('/app/employer/departments')
    }
  }

  // "View activity" on the Team page links here with #activity — scroll the
  // Insights section into view once the page (and its data) has rendered.
  useEffect(() => {
    if (location.hash !== '#activity' || isLoading) return
    document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, isLoading])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Dashboard" subtitle="Your hiring activity at a glance" />

      <main style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>

      {(isLoading || kL) ? <DashboardSkeleton /> : (isError || !data) ? (
        <ErrorState title="Could not load dashboard" description="There was an error loading your dashboard data." onRetry={refetch} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1280 }}>

          {/* Banners */}
          {!data.is_approved && <VerificationBanner />}
          <SetupBanner />

          {/* Post a Job action */}
          {data.is_approved && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" onClick={handlePostJob}>
                <Plus size={13} strokeWidth={2.5} />Post a Job
              </Button>
            </div>
          )}

          {/* Organization health — how the org as a whole is doing, ahead of
              any single req's recruiting-ops numbers. Not relevant to a
              department-scoped recruiter/interviewer, who only sees their
              own req pipeline below. */}
          {isCompanyWide && <OrgSummaryStrip />}

          {/* KPI strip */}
          {kpis && <KpiStrip kpis={kpis as unknown as Record<string, number>} />}

          {/* Charts row */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <ApplicationTrend />
              <HiringFunnel kpis={kpis as unknown as Record<string, number>} />
            </div>
          )}

          {/* Departments — cross-department breakdown, company-wide viewers only */}
          {isCompanyWide && <DepartmentsTable />}

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {kpis && <ActionItems kpis={kpis as unknown as Record<string, number>} />}
            <UpcomingInterviews />
          </div>

          {/* Insights — team activity, job & recruiter performance (folded
              in from the old standalone Analytics page) */}
          <Insights defaultSection="activity" />

        </div>
      )}
      </main>
    </div>
  )
}
