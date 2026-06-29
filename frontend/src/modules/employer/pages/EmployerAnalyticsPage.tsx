import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Briefcase } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled', interview_completed: 'Interview Completed',
  offer_sent: 'Offer Sent', hired: 'Hired',
}

export default function EmployerAnalyticsPage() {
  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['employer', 'analytics', 'funnel'],
    queryFn: analyticsApi.getEmployerFunnel,
  })
  const { data: perf, isLoading: perfLoading } = useQuery({
    queryKey: ['employer', 'analytics', 'jobs'],
    queryFn: analyticsApi.getJobPerformance,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 24px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <Link to="/app/employer/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} />Back to dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <TrendingUp size={20} color="#3B82F6" />
          <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Hiring Analytics</h1>
        </div>

        {/* Funnel */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: '0 0 4px' }}>Application Funnel</h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>
            {funnelLoading ? 'Loading…' : `${funnel?.total_applications ?? 0} total applications across your company`}
          </p>
          {funnel && funnel.stages.map(s => (
            <div key={s.stage} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{STAGE_LABELS[s.stage] ?? s.stage}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{s.count} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({s.pct_of_total}%)</span></span>
              </div>
              <div style={{ height: 8, background: '#F1F5F9', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ width: `${s.pct_of_total}%`, height: '100%', background: '#3B82F6', borderRadius: 20 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Job performance */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <Briefcase size={16} color="#3B82F6" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Job Performance</h2>
          </div>
          {perfLoading ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : !perf || perf.jobs.length === 0 ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>No job postings yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#94A3B8', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>
                  <th style={{ textAlign: 'left', padding: '10px 20px' }}>Job</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Applications</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Shortlisted</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Interviewed</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Hired</th>
                  <th style={{ textAlign: 'right', padding: '10px 20px' }}>Conversion</th>
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
                    <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 700, color: '#7C3AED' }}>{j.conversion_rate_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
