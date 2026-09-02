import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Briefcase, CheckCircle2, Building2, FileText, Award,
  BarChart3, Shield, Clock, Activity, IndianRupee,
} from 'lucide-react'
import { analyticsApi } from '@/api/analytics'
import { useAdminStats, useAdminActivity, useEmployerVerifications } from '../hooks/useAdmin'
import { Spinner, Empty, StatCard } from '../shared/adminUI'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { TrendMetric } from '@/api/analytics'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'


// ── Activity dot colour ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  signup:            'bg-[#1A2744]',
  application:       'bg-[#243359]',
  job_posted:        'bg-[#475569]',
  employer_approved: 'bg-[#94A3B8]',
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.text.muted, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
    </div>
  )
}

// ── Trend chart (navy monochrome) ─────────────────────────────────────────────
function TrendChart({ metric, label }: { metric: TrendMetric; label: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'trends', metric],
    queryFn: () => analyticsApi.getAdminTrends(metric, 30),
  })
  const series = data?.series ?? []
  const max = Math.max(1, ...series.map(p => p.count))
  const total = series.reduce((s, p) => s + p.count, 0)

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '16px 18px',
      transition: 'background 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
      onMouseOut={e => (e.currentTarget.style.background = '#fff')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink }}>{label}</p>
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.brand.navy }}>{total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
        {series.map((p, i) => {
          const pct = (p.count / max) * 100
          const isRecent = i >= series.length - 7
          return (
            <div
              key={p.date}
              title={`${p.date}: ${p.count}`}
              style={{
                flex: 1, minHeight: 2, borderRadius: '2px 2px 0 0',
                height: `${Math.max(pct, 3)}%`,
                background: isRecent ? colors.brand.navy : 'rgba(26,39,68,0.12)',
                transition: 'opacity 0.15s',
              }}
            />
          )
        })}
      </div>
      <p style={{ fontSize: 10, color: colors.text.muted, marginTop: 8 }}>
        {series.length > 0 ? `${series[0].date} → ${series[series.length - 1].date}` : 'last 30 days'}
      </p>
    </div>
  )
}

// ── KPI banner ────────────────────────────────────────────────────────────────
function KpiBanner({ stats }: { stats: Record<string, number | string> }) {
  const items = [
    { label: 'Total Aspirants',   value: stats.total_aspirants,       delta: `+${stats.new_users_last_7d} this week` },
    { label: 'Employers',         value: stats.total_employers,        delta: `${stats.pending_employers} pending` },
    { label: 'Job Postings',      value: stats.total_job_postings,     delta: `${stats.active_job_postings} active` },
    { label: 'Avg KRS Score',     value: stats.avg_krs_composite ?? '—', delta: 'platform avg' },
  ]
  return (
    <div style={{
      background: colors.brand.navy, borderRadius: 16,
      padding: '22px 28px',
      display: 'flex', flexWrap: 'wrap', gap: 16,
    }}>
      {items.map((kpi, i) => (
        <div key={kpi.label} style={{
          flex: '1 1 140px',
          paddingRight: i < items.length - 1 ? 28 : 0,
          paddingLeft: i > 0 ? 28 : 0,
          borderRight: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
        }}>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{kpi.value}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{kpi.label}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{kpi.delta}</p>
        </div>
      ))}
    </div>
  )
}

// ── Role-specific focus panels ────────────────────────────────────────────────

function KycFocusPanel() {
  const navigate = useNavigate()
  const { data: pending } = useEmployerVerifications('pending')
  const { data: underReview } = useEmployerVerifications('under_review')
  const overdueCount = (pending ?? []).filter(v =>
    Math.floor((Date.now() - new Date(v.submitted_at).getTime()) / 86_400_000) > 3,
  ).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 8 }}>
      {[
        { label: 'Pending Review',    value: pending?.length ?? '—',     accent: '#F59E0B' },
        { label: 'Under Review',      value: underReview?.length ?? '—', accent: colors.brand.navy },
        { label: 'Overdue (>3 days)', value: overdueCount,               accent: '#EF4444' },
      ].map(({ label, value, accent }) => (
        <div
          key={label}
          onClick={() => navigate('/admin/kyc')}
          style={{
            background: '#fff', borderRadius: 16, cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.08)',
            padding: '20px 22px',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
          onMouseOut={e => (e.currentTarget.style.background = '#fff')}
        >
          <p style={{ fontSize: 24, fontWeight: 900, color: accent }}>{value}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, marginTop: 4 }}>{label}</p>
        </div>
      ))}
    </div>
  )
}

function FinanceFocusPanel() {
  const navigate = useNavigate()
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 16, padding: '18px 22px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 8,
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>Revenue Dashboard</p>
        <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>View MRR, ARPA, and subscription plan distribution</p>
      </div>
      <Button size="sm" onClick={() => navigate('/admin/billing')}>Open Revenue →</Button>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ stats, compact }: { stats: Record<string, number>; compact?: boolean }) {
  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard icon={Users}     label="Total Aspirants" value={stats.total_aspirants}     sub={`+${stats.new_users_last_7d} this week`} />
        <StatCard icon={Briefcase} label="Active Jobs"     value={stats.active_job_postings} sub={`${stats.total_job_postings} total`} />
        <StatCard icon={FileText}  label="Applications"    value={stats.total_applications}  sub={`${stats.hired_count} hired`} />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <KpiBanner stats={stats as unknown as Record<string, number | string>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard icon={CheckCircle2} label="Onboarding Done"    value={stats.completed_onboarding} sub={`${Math.round(stats.completed_onboarding / Math.max(stats.total_aspirants, 1) * 100)}% completion`} />
        <StatCard icon={FileText}     label="Applications"       value={stats.total_applications}   sub={`${stats.hired_count} hired`} />
        <StatCard icon={Award}        label="Hired"              value={stats.hired_count}          sub="Total placements" />
        <StatCard icon={Shield}       label="Approved Employers" value={stats.approved_employers}   sub={`${stats.total_employers - stats.approved_employers} not yet`} />
      </div>
    </div>
  )
}

// ── Admin action grid ─────────────────────────────────────────────────────────
function AdminActionGrid({ navigate }: { navigate: (r: string) => void }) {
  const items = [
    { label: 'Revenue',   sub: 'MRR · ARPA · Plans',      icon: IndianRupee, route: '/admin/billing',     accent: '#22C55E' },
    { label: 'Team',      sub: 'Sub-admins · Roles',       icon: Users,       route: '/admin/sub-admins',  accent: colors.brand.navy },
    { label: 'Audit log', sub: 'Platform event log',       icon: Activity,    route: '/admin/audit-log',   accent: '#475569' },
    { label: 'Platform',  sub: 'Settings · Feature flags', icon: Shield,      route: '/admin/settings',    accent: '#DC2626' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      {items.map(({ label, sub, icon: Icon, route, accent }) => (
        <div
          key={label}
          onClick={() => navigate(route)}
          style={{
            background: '#fff', borderRadius: 16, cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.08)',
            padding: '16px 18px',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
          onMouseOut={e => (e.currentTarget.style.background = '#fff')}
        >
          <Icon size={16} color={accent} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{label} →</p>
          <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Quick actions panel ───────────────────────────────────────────────────────
function QuickActionsPanel({ stats, flags, navigate }: {
  stats: Record<string, number> | undefined
  flags: { showFullStats: boolean; isSupportExec: boolean; isModerator: boolean; isVerificationOfficer: boolean; isFinanceManager: boolean }
  navigate: (r: string) => void
}) {
  const { showFullStats, isSupportExec, isModerator, isVerificationOfficer, isFinanceManager } = flags
  const actions = [
    showFullStats && { label: 'Pending Approvals', sub: `${stats?.pending_employers ?? 0} employers`,    icon: Clock,       route: '/admin/employers' },
    (showFullStats || isSupportExec) && { label: 'Manage Users',    sub: `${stats?.total_aspirants ?? 0} aspirants`,  icon: Users,       route: '/admin/users' },
    (showFullStats || isModerator) && { label: 'Review Jobs',     sub: `${stats?.active_job_postings ?? 0} active`, icon: Briefcase,   route: '/admin/jobs' },
    showFullStats && { label: 'All Applications',   sub: `${stats?.total_applications ?? 0} total`,   icon: FileText,    route: '/admin/applications' },
    isVerificationOfficer && { label: 'KYC Queue',     sub: 'Review verifications',                       icon: Shield,      route: '/admin/kyc' },
    isFinanceManager && { label: 'Revenue',       sub: 'MRR & subscriptions',                        icon: IndianRupee, route: '/admin/billing' },
  ].filter(Boolean) as { label: string; sub: string; icon: React.ElementType; route: string }[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {actions.map(({ label, sub, icon: Icon, route }) => (
        <button
          key={label}
          onClick={() => navigate(route)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 12, textAlign: 'left',
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer', transition: 'background 0.2s', width: '100%',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
          onMouseOut={e => (e.currentTarget.style.background = '#fff')}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#EAECF0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={15} color={colors.brand.navy} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{label}</p>
            <p style={{ fontSize: 11, color: colors.text.muted }}>{sub}</p>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 16, color: '#CBD5E1' }}>›</span>
        </button>
      ))}
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: activity, isLoading: actLoading } = useAdminActivity()
  const role = useAuthStore(s => s.user?.role ?? '')

  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin'
  const isModerator = role === 'moderator'
  const isVerificationOfficer = role === 'verification_officer'
  const isFinanceManager = role === 'finance_manager'
  const isSupportExec = role === 'support_executive'

  const showFullStats = isSuperAdmin || isAdmin

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const pageTitle = isVerificationOfficer ? 'KYC Dashboard'
    : isFinanceManager ? 'Revenue Overview'
    : isSupportExec ? 'Support Overview'
    : isModerator ? 'Moderation Dashboard'
    : 'Platform Overview'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
          {pageTitle}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, color: colors.brand.navy,
            background: 'rgba(26,39,68,0.07)', border: '0.5px solid rgba(26,39,68,0.12)',
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            Live · refreshes 60s
          </span>
          {role && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: colors.text.muted,
              background: '#F4F5F7', border: '0.5px solid #E2E8F0',
              borderRadius: 20, padding: '4px 12px', textTransform: 'capitalize',
            }}>
              {role.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* ── Role-specific focus panels ── */}
      {isVerificationOfficer && <KycFocusPanel />}
      {isFinanceManager && <FinanceFocusPanel />}

      {/* ── KPI banner + secondary stats ── */}
      {statsLoading ? <Spinner /> : stats && showFullStats ? (
        <StatsRow stats={stats as unknown as Record<string, number>} />
      ) : stats && (isModerator || isSupportExec) ? (
        <StatsRow stats={stats as unknown as Record<string, number>} compact />
      ) : null}

      {/* ── Super admin quick links ── */}
      {isSuperAdmin && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <SectionDivider label="Admin access" />
          <AdminActionGrid navigate={navigate} />
        </div>
      )}

      {/* ── Growth trends ── */}
      {showFullStats && (
        <div>
          <SectionDivider label="Growth trends — last 30 days" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <TrendChart metric="users"        label="User Acquisition" />
            <TrendChart metric="employers"    label="Employer Growth" />
            <TrendChart metric="jobs"         label="Job Postings" />
            <TrendChart metric="applications" label="Applications" />
          </div>
        </div>
      )}

      {/* ── Funnel + Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

        {/* Conversion funnel */}
        {showFullStats && stats && (
          <div>
            <SectionDivider label="Conversion funnel" />
            <div style={{
              background: '#fff', borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '20px 22px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {[
                { label: 'Registered',            value: stats.total_aspirants,                                      max: stats.total_aspirants },
                { label: 'Completed onboarding',  value: stats.completed_onboarding,                                 max: stats.total_aspirants },
                { label: 'Applied to a job',      value: Math.min(stats.total_applications, stats.total_aspirants),  max: stats.total_aspirants },
                { label: 'Hired',                 value: stats.hired_count,                                          max: stats.total_aspirants },
              ].map(({ label, value, max }, i) => {
                const pct = max > 0 ? Math.round(value / max * 100) : 0
                const opacity = 1 - i * 0.18
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: colors.text.ink }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink }}>
                        {value} <span style={{ color: colors.text.muted, fontWeight: 400 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: colors.brand.navy, opacity,
                        width: `${pct}%`, transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <SectionDivider label="Quick actions" />
          <QuickActionsPanel
            stats={stats as unknown as Record<string, number> | undefined}
            flags={{ showFullStats, isSupportExec, isModerator, isVerificationOfficer, isFinanceManager }}
            navigate={navigate}
          />
        </div>
      </div>

      {/* ── Activity feed ── */}
      <div>
        <SectionDivider label="Recent activity" />
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {actLoading ? <Spinner /> : !activity || activity.length === 0 ? (
            <Empty icon={Activity} text="No recent activity" />
          ) : (
            <div>
              {activity.slice(0, 20).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '12px 18px',
                    background: i % 2 === 0 ? '#fff' : '#F4F5F7',
                    borderBottom: i < Math.min(activity.length, 20) - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    transition: 'background 0.15s', cursor: 'default',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
                  onMouseOut={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F4F5F7')}
                >
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', STATUS_COLORS[item.type] ?? 'bg-gray-300')} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: colors.text.ink, lineHeight: 1.4 }}>{item.title}</p>
                    {item.subtitle && <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>{item.subtitle}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: '#CBD5E1', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
