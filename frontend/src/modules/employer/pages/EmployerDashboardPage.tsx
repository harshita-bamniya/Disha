import { useNavigate, Link } from 'react-router-dom'
import NotificationBell from '@/components/NotificationBell'
import {
  Plus, Clock, Building2, TrendingUp, Users, Briefcase,
  CalendarClock, Send, Award, X, Sparkles,
  CheckCircle2, ChevronRight, Activity, ArrowUpRight,
} from 'lucide-react'
import {
  useEmployerDashboard, useDashboardKpis, useApplicationTrend,
  useUpcomingInterviews, useCompanyProfile, useDepartments,
} from '../hooks/useJobs'
import { CommandBar } from '../components/CommandBar'
import { useState } from 'react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, fallback = '—'): string {
  if (n == null) return fallback
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: Record<string, number> }) {
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
      gridTemplateColumns: 'repeat(8, 1fr)',
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          onClick={() => s.to && window.location.assign(s.to)}
          style={{
            padding: '16px 18px',
            borderRight: i < stats.length - 1 ? '1px solid #F3F4F6' : 'none',
            cursor: s.to ? 'pointer' : 'default',
            transition: 'background 0.12s',
          }}
          onMouseOver={e => { if (s.to) e.currentTarget.style.background = '#F9FAFB' }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff' }}
        >
          <p style={{
            fontSize: 22, fontWeight: 700, color: '#111827',
            margin: 0, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
          }}>{s.value}</p>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '5px 0 0', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</p>
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
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Application Trend</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>Last 30 days</p>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{fmt(total)}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>total</span>
          </div>
        )}
      </div>

      {series.length < 2 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 12, color: '#D1D5DB' }}>No applications yet</p>
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
              <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#F3F4F6" strokeWidth="1" />
              <text x={PAD.l - 6} y={g.y + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{g.label}</text>
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
              <text key={idx} x={p.x} y={H - 4} fontSize="9" fill="#9CA3AF" textAnchor="middle">{label}</text>
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
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 20px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 16px' }}>Hiring Funnel</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stages.map((s, i) => (
          <div key={s.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.label}</span>
              <div style={{ display: 'flex', align: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{s.value}</span>
              </div>
            </div>
            <div style={{ height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
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

// ── Departments table ─────────────────────────────────────────────────────────

function DepartmentsTable() {
  const { data: departments } = useDepartments()
  const navigate = useNavigate()
  if (!departments?.length) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
          Departments <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 4 }}>{departments.length}</span>
        </p>
        <Link to="/app/employer/departments" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 12, color: '#2563EB', fontWeight: 500, textDecoration: 'none',
        }}>
          Manage <ChevronRight size={12} />
        </Link>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 140px 90px 90px 90px',
        padding: '8px 20px', background: '#F9FAFB',
        borderBottom: '1px solid #F3F4F6',
      }}>
        {['Department', 'Head', 'Members', 'Active Jobs', 'Applicants'].map(col => (
          <span key={col} style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</span>
        ))}
      </div>

      {departments.map((d, i) => (
        <div
          key={d.id}
          onClick={() => navigate(`/app/employer/departments/${d.id}`)}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 90px 90px 90px',
            padding: '11px 20px',
            borderBottom: i < departments.length - 1 ? '1px solid #F9FAFB' : 'none',
            cursor: 'pointer', transition: 'background 0.1s',
            alignItems: 'center',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#F9FAFB' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={13} color="#6B7280" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{d.name}</span>
          </div>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{d.head_name ?? '—'}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{d.member_count}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{d.active_job_count}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{d.total_applicant_count}</span>
        </div>
      ))}
    </div>
  )
}

// ── Upcoming Interviews ────────────────────────────────────────────────────────

function UpcomingInterviews() {
  const { data: interviews } = useUpcomingInterviews(5)

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Upcoming Interviews</p>
        <Link to="/app/employer/calendar" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 12, color: '#2563EB', fontWeight: 500, textDecoration: 'none',
        }}>
          Calendar <ChevronRight size={12} />
        </Link>
      </div>

      {!interviews?.length ? (
        <div style={{ padding: '24px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>No upcoming interviews</p>
        </div>
      ) : (
        interviews.map((iv, i) => {
          const d = new Date(iv.scheduled_at)
          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={iv.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 18px',
              borderBottom: i < interviews.length - 1 ? '1px solid #F9FAFB' : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 7,
                background: '#EFF6FF',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 9, color: '#93C5FD', fontWeight: 600, textTransform: 'uppercase' }}>
                  {d.toLocaleString('en-IN', { month: 'short' })}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iv.candidate_name ?? 'Candidate'}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iv.job_title}</p>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
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
  if (kpis.offers_sent > 0)          items.push({ label: 'offers pending response',count: kpis.offers_sent,         to: '/app/employer/offers',   color: '#0891B2' })

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Action Items</p>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Needs attention</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <CheckCircle2 size={15} color="#16A34A" />
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>All caught up</p>
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            onClick={() => navigate(item.to)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 18px',
              borderBottom: i < items.length - 1 ? '1px solid #F9FAFB' : 'none',
              cursor: 'pointer', transition: 'background 0.1s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#F9FAFB' }}
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
              <span style={{ fontSize: 12, color: '#374151' }}>{item.label}</span>
            </div>
            <ArrowUpRight size={13} color="#D1D5DB" />
          </div>
        ))
      )}
    </div>
  )
}

// ── Verification banner ───────────────────────────────────────────────────────

function VerificationBanner() {
  return (
    <div style={{
      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
      padding: '11px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Clock size={14} color="#D97706" style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: '#92400E', margin: 0, flex: 1 }}>
        <strong style={{ fontWeight: 600 }}>Verification pending</strong> — job posting is locked until your company documents are submitted.
      </p>
      <Link to="/app/employer/verification" style={{
        padding: '5px 12px', borderRadius: 6,
        background: '#D97706', color: 'white',
        fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
      }}>
        Start verification
      </Link>
    </div>
  )
}

// ── Setup Banner ──────────────────────────────────────────────────────────────

function SetupBanner() {
  const { data: company } = useCompanyProfile()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('setup_banner_v2') === '1')
  if (!company || company.industry || dismissed) return null

  return (
    <div style={{
      background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8,
      padding: '11px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Sparkles size={14} color="#7C3AED" style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: '#5B21B6', margin: 0, flex: 1 }}>
        <strong style={{ fontWeight: 600 }}>Complete your company profile</strong> — add industry, logo, and description to attract stronger candidates.
      </p>
      <Link to="/app/employer/setup" style={{
        padding: '5px 12px', borderRadius: 6,
        background: '#7C3AED', color: 'white',
        fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
      }}>
        Complete
      </Link>
      <button
        type="button"
        onClick={() => { sessionStorage.setItem('setup_banner_v2', '1'); setDismissed(true) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', padding: 2, flexShrink: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  const pulse = {
    background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
  } as React.CSSProperties

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...pulse, height: 80, borderRadius: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ ...pulse, height: 160, borderRadius: 10 }} />
          <div style={{ ...pulse, height: 160, borderRadius: 10 }} />
        </div>
        <div style={{ ...pulse, height: 180, borderRadius: 10 }} />
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployerDashboardPage() {
  const { data, isLoading }           = useEmployerDashboard()
  const { data: kpis, isLoading: kL } = useDashboardKpis()
  const navigate                      = useNavigate()

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Top bar */}
      <header style={{
        height: 52,
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
            {data?.company_name ?? 'Dashboard'}
          </span>
          <span style={{ fontSize: 12, color: '#D1D5DB' }}>·</span>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{today}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CommandBar onPostJob={() => navigate('/app/employer/jobs')} />
          <NotificationBell />
          {data?.is_approved && (
            <button
              onClick={() => navigate('/app/employer/jobs')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 7,
                background: '#1E3A5F', color: 'white',
                border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} strokeWidth={2.5} />Post a Job
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: '#F9FAFB' }}>

        {(isLoading || kL) ? <Skeleton /> : !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 10, color: '#9CA3AF' }}>
            <Building2 size={36} strokeWidth={1.5} />
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#374151' }}>Could not load dashboard</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: 4, padding: '6px 16px', borderRadius: 7, background: '#1E3A5F', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1280 }}>

            {/* Banners */}
            {!data.is_approved && <VerificationBanner />}
            <SetupBanner />

            {/* KPI strip */}
            {kpis && <KpiStrip kpis={kpis as unknown as Record<string, number>} />}

            {/* Charts row */}
            {kpis && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>
                <ApplicationTrend />
                <HiringFunnel kpis={kpis as unknown as Record<string, number>} />
              </div>
            )}

            {/* Departments */}
            <DepartmentsTable />

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {kpis && <ActionItems kpis={kpis as unknown as Record<string, number>} />}
              <UpcomingInterviews />
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
