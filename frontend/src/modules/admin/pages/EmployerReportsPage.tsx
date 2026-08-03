import { useQuery } from '@tanstack/react-query'
import { Building2, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { useAdminStats, useAdminEmployers } from '../hooks/useAdmin'
import { Spinner, Empty, Breadcrumb } from '../shared/adminUI'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function EmployerReportsPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin', 'analytics', 30],
    queryFn: () => adminApi.getAnalytics({ days: 30 }),
  })
  const { data: allEmployers } = useAdminEmployers('all')

  const isLoading = statsLoading || analyticsLoading

  const employers  = allEmployers ?? []
  const verified   = employers.filter(e => e.is_approved).length
  const pending    = employers.filter(e => !e.is_approved).length
  const withJobs   = employers.filter(e => (e.job_count ?? 0) > 0).length
  const engagementRate = employers.length > 0 ? Math.round((withJobs / employers.length) * 100) : 0

  const cohortRows = analytics?.cohort_table ?? []
  const maxGrowth = Math.max(1, ...cohortRows.map(r => r.signups))

  const cardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }

  return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Employer Reports' }]} />

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Employer Reports</h1>
        <p className="text-sm mt-1" style={{ color: N.muted }}>Employer growth, verification trends, and hiring engagement.</p>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employers',    value: stats?.total_employers ?? 0, icon: Building2 },
              { label: 'Approved',           value: verified,                    icon: CheckCircle },
              { label: 'Pending Approval',   value: pending,                     icon: Clock },
              { label: 'Active (have jobs)', value: withJobs,                    icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: N.creamDk, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={18} color={N.ink} />
                </div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Engagement rate */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Employer Engagement Rate</span>
              <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: N.ink, marginBottom: 4 }}>{engagementRate}%</p>
            <p className="text-xs" style={{ color: N.muted }}>of registered employers have at least one job posted</p>
            <div className="mt-4 h-2.5 rounded-full overflow-hidden" style={{ background: N.creamDk }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${engagementRate}%`, background: N.navy }} />
            </div>
          </div>

          {/* Verification breakdown */}
          {employers.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <h2 className="text-sm font-bold" style={{ color: N.ink }}>Verification Status Breakdown</h2>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  { label: 'Approved', count: employers.filter(e => e.is_approved).length,  color: '#22C55E' },
                  { label: 'Pending',  count: employers.filter(e => !e.is_approved).length, color: '#F59E0B' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <p className="text-xs w-28 shrink-0" style={{ color: '#475569' }}>{label}</p>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: N.creamDk }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / employers.length) * 100}%`, background: color }} />
                    </div>
                    <p className="text-xs font-bold w-8 text-right tabular-nums" style={{ color: N.ink }}>{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth trend */}
          {cohortRows.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Platform User Growth (last 6 months)</span>
                <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
              </div>
              <div className="flex items-end gap-3 h-24">
                {cohortRows.map(row => (
                  <div key={row.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      title={`${row.month}: ${row.signups} signups`}
                      style={{ height: `${(row.signups / maxGrowth) * 100}%`, minHeight: 3, width: '100%', background: N.navy, borderRadius: 2, opacity: 0.8, transition: 'opacity 0.15s' }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '0.8')}
                    />
                    <span className="text-[10px]" style={{ color: N.muted }}>{row.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top employers by job count */}
          {employers.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <h2 className="text-sm font-bold" style={{ color: N.ink }}>Top Employers by Jobs Posted</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    {['Company', 'Jobs', 'Status'].map((h, i) => (
                      <th key={h} className={i > 0 ? 'text-right' : 'text-left'} style={{ padding: '10px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...employers]
                    .sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0))
                    .slice(0, 10)
                    .map((e, idx) => (
                      <tr key={e.id} style={{ background: idx % 2 === 0 ? '#fff' : N.cream, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td className="truncate max-w-[240px] font-medium" style={{ padding: '12px 20px', color: N.ink }}>{e.company_name}</td>
                        <td className="text-right font-bold tabular-nums" style={{ padding: '12px 20px', color: N.ink }}>{e.job_count ?? 0}</td>
                        <td className="text-right" style={{ padding: '12px 20px' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{
                            background: e.is_approved ? '#F0FDF4' : '#FFFBEB',
                            color: e.is_approved ? '#15803D' : '#B45309',
                          }}>{e.is_approved ? 'approved' : 'pending'}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {employers.length === 0 && <Empty icon={Building2} text="No employer data available yet" />}
        </>
      )}
    </section>
  )
}
