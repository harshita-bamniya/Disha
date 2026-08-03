import { useQuery } from '@tanstack/react-query'
import { Users, Target, TrendingUp, Activity } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { useAdminStats } from '../hooks/useAdmin'
import { Spinner, Empty, Breadcrumb } from '../shared/adminUI'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function CandidateReportsPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin', 'analytics', 90],
    queryFn: () => adminApi.getAnalytics({ days: 90 }),
  })

  const isLoading = statsLoading || analyticsLoading

  const userGrowth   = analytics?.user_growth ?? []
  const scoreDist    = analytics?.match_score_distribution ?? []
  const cohort       = analytics?.cohort_table ?? []
  const funnel       = analytics?.application_funnel ?? []

  const maxGrowth = Math.max(1, ...userGrowth.map(p => p.count))
  const maxScore  = Math.max(1, ...scoreDist.map(b => b.count))

  const totalCandidates = stats?.total_aspirants ?? 0
  const totalApps       = stats?.total_applications ?? 0
  const hired           = funnel.find(f => f.status === 'hired')?.count ?? 0
  const applyRate       = totalCandidates > 0 ? Math.round((totalApps / totalCandidates) * 100) : 0

  return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Candidate Reports' }]} />

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Candidate Reports</h1>
        <p className="text-sm mt-1" style={{ color: N.muted }}>Registration trends, application behaviour, and score distribution.</p>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Candidates',   value: totalCandidates.toLocaleString(), icon: Users },
              { label: 'Total Applications', value: totalApps.toLocaleString(),       icon: Activity },
              { label: 'Apply Rate',         value: `${applyRate}%`,                  icon: TrendingUp },
              { label: 'Total Hired',        value: hired.toLocaleString(),            icon: Target },
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

          {/* Candidate registration trend */}
          {userGrowth.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>Candidate Registrations — Last 90 Days</span>
                <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
              </div>
              <div className="flex items-end gap-0.5 h-28">
                {userGrowth.map(p => (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.count}`}
                    style={{ height: `${(p.count / maxGrowth) * 100}%`, minHeight: p.count > 0 ? 3 : 1, flex: 1, background: N.navy, borderRadius: 2, transition: 'opacity 0.15s' }}
                    onMouseOver={e => (e.currentTarget.style.opacity = '0.7')}
                    onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px]" style={{ color: N.muted }}>{userGrowth[0]?.date}</span>
                <span className="text-[10px]" style={{ color: N.muted }}>{userGrowth[userGrowth.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* KRS Score distribution */}
          {scoreDist.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>KRS Match Score Distribution</span>
                <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
              </div>
              <div className="flex items-end gap-2 h-24">
                {scoreDist.map(bin => (
                  <div key={bin.range} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      title={`${bin.range}: ${bin.count} candidates`}
                      style={{ height: `${(bin.count / maxScore) * 100}%`, minHeight: bin.count > 0 ? 3 : 0, width: '100%', background: N.navy, borderRadius: 2, opacity: 0.75, transition: 'opacity 0.15s' }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '0.75')}
                    />
                    <span className="text-[9px] text-center leading-tight" style={{ color: N.muted }}>{bin.range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cohort table */}
          {cohort.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div className="px-5 py-3" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <h2 className="text-sm font-bold" style={{ color: N.ink }}>Candidate Funnel by Month</h2>
                <p className="text-xs mt-0.5" style={{ color: N.muted }}>Registrations → Applied → Hired</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      {['Month', 'Registered', 'Applied', 'Hired', 'Apply Rate', 'Hire Rate'].map(h => (
                        <th key={h} className="text-left px-5 py-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.map((row, idx) => (
                      <tr key={row.month} style={{ background: idx % 2 === 0 ? '#fff' : N.cream, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td className="px-5 py-3 font-medium tabular-nums" style={{ color: '#475569' }}>{row.month}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#475569' }}>{row.signups.toLocaleString()}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#475569' }}>{row.applied.toLocaleString()}</td>
                        <td className="px-5 py-3 font-bold tabular-nums text-green-700">{row.hired.toLocaleString()}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: N.muted }}>
                          {row.signups > 0 ? `${((row.applied / row.signups) * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: N.muted }}>
                          {row.applied > 0 ? `${((row.hired / row.applied) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!stats && <Empty icon={Users} text="No candidate data available yet" />}
        </>
      )}
    </section>
  )
}
