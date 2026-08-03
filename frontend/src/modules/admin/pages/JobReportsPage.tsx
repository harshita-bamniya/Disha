import { useQuery } from '@tanstack/react-query'
import { Briefcase, Users, TrendingUp, BarChart2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { useAdminStats } from '../hooks/useAdmin'
import { Spinner, Empty, Breadcrumb } from '../shared/adminUI'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  hired: 'Hired',
  withdrawn: 'Withdrawn',
}

export default function JobReportsPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin', 'analytics', 90],
    queryFn: () => adminApi.getAnalytics({ days: 90 }),
  })

  const isLoading = statsLoading || analyticsLoading

  const jobVolume = analytics?.job_volume ?? []
  const funnel    = analytics?.application_funnel ?? []
  const total     = stats?.total_job_postings ?? 0
  const totalApps = stats?.total_applications ?? 0
  const avgApps   = total > 0 ? (totalApps / total).toFixed(1) : '—'

  const maxVol   = Math.max(1, ...jobVolume.map(p => p.count))
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count))

  const hired = funnel.find(f => f.status === 'hired')?.count ?? 0
  const fillRate = totalApps > 0 ? Math.round((hired / totalApps) * 100) : 0

  const cardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }

  return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Job Reports' }]} />

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Job Reports</h1>
        <p className="text-sm mt-1" style={{ color: N.muted }}>Job posting trends, application volume, and hiring funnel.</p>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Jobs',     value: total.toLocaleString(),     icon: Briefcase },
              { label: 'Total Applies',  value: totalApps.toLocaleString(), icon: Users },
              { label: 'Avg Apps / Job', value: avgApps,                    icon: BarChart2 },
              { label: 'Hire Rate',      value: `${fillRate}%`,             icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: N.creamDk, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={18} color={N.ink} />
                </div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Job volume trend */}
          {jobVolume.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Job Postings — Last 90 Days</span>
                <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
              </div>
              <div className="flex items-end gap-0.5 h-28">
                {jobVolume.map(p => (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.count} jobs`}
                    style={{ height: `${(p.count / maxVol) * 100}%`, minHeight: p.count > 0 ? 3 : 1, flex: 1, background: N.navy, borderRadius: 2, opacity: 0.75, transition: 'opacity 0.15s' }}
                    onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                    onMouseOut={e => (e.currentTarget.style.opacity = '0.75')}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px]" style={{ color: N.muted }}>{jobVolume[0]?.date}</span>
                <span className="text-[10px]" style={{ color: N.muted }}>{jobVolume[jobVolume.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Application funnel */}
          {funnel.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <h2 className="text-sm font-bold" style={{ color: N.ink }}>Application Funnel</h2>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {funnel.map(stage => (
                  <div key={stage.status} className="flex items-center gap-3">
                    <p className="text-xs w-32 shrink-0" style={{ color: '#475569' }}>{STATUS_LABELS[stage.status] ?? stage.status}</p>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: N.creamDk }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(stage.count / maxFunnel) * 100}%`,
                          background: stage.status === 'hired' ? '#16a34a' :
                                      stage.status === 'rejected' ? '#dc2626' :
                                      stage.status === 'shortlisted' ? '#7c3aed' :
                                      stage.status === 'under_review' ? '#2563eb' : '#6b7280',
                        }}
                      />
                    </div>
                    <p className="text-xs font-bold w-12 text-right tabular-nums" style={{ color: N.ink }}>{stage.count.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cohort table */}
          {(analytics?.cohort_table ?? []).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <h2 className="text-sm font-bold" style={{ color: N.ink }}>Monthly Hiring Cohort</h2>
                <p className="text-xs mt-0.5" style={{ color: N.muted }}>Signups → Applied → Hired conversion per month</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      {['Month', 'Signups', 'Applied', 'Hired', 'Conversion'].map(h => (
                        <th key={h} className="text-left px-5 py-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics!.cohort_table.map((row, idx) => (
                      <tr key={row.month} style={{ background: idx % 2 === 0 ? '#fff' : N.cream, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td className="px-5 py-3 font-medium tabular-nums" style={{ color: '#475569' }}>{row.month}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#475569' }}>{row.signups.toLocaleString()}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#475569' }}>{row.applied.toLocaleString()}</td>
                        <td className="px-5 py-3 font-bold tabular-nums text-green-700">{row.hired.toLocaleString()}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: N.muted }}>
                          {row.signups > 0 ? `${((row.hired / row.signups) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!stats && <Empty icon={Briefcase} text="No job data available yet" />}
        </>
      )}
    </section>
  )
}
