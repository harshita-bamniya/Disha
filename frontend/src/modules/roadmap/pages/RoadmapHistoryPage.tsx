import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobPlanApi } from '@/api/jobPlan'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import AppSidebar from '@/components/layout/AppSidebar'
import { Map, ChevronRight, TrendingUp, Loader2, ArrowRight, Briefcase } from 'lucide-react'

function statusBadge(status: 'generating' | 'ready' | 'failed') {
  if (status === 'generating') return { bg: '#FEF3C7', color: '#92400E', label: 'Generating…' }
  if (status === 'failed') return { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' }
  return { bg: '#DCFCE7', color: '#16A34A', label: 'Ready' }
}

export default function RoadmapHistoryPage() {
  const navigate = useNavigate()
  const { startPrep } = useActivePrepJob()
  const [openingJobId, setOpeningJobId] = useState<string | null>(null)

  const { data: jobPlans = [], isLoading: isLoadingAny } = useQuery({
    queryKey: ['job-plans-all'],
    queryFn: jobPlanApi.getAllMine,
  })

  function openJobPlan(jobId: string) {
    setOpeningJobId(jobId)
    startPrep(jobId, {
      onSuccess: () => navigate('/app/roadmap'),
      onSettled: () => setOpeningJobId(null),
    })
  }

  const isEmpty = !isLoadingAny && jobPlans.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex' }}>
      <AppSidebar activePath="/app/roadmap" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Map size={13} color="white" />
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>My Roadmaps</span>
        </header>

        <main style={{ padding: '24px 28px', flex: 1 }}>
          {isLoadingAny && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <Loader2 size={28} color="#15130F" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {isEmpty && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', padding: 40 }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Map size={36} color="white" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 10, fontFamily: 'Hind, sans-serif' }}>No Roadmaps Yet</h2>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, maxWidth: 400, marginBottom: 28 }}>
                Pick a job from your matches and click "Generate Roadmap" to build your first personalised roadmap.
              </p>
              <button
                onClick={() => navigate('/app/jobs')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(21,19,15,0.22)' }}
              >
                Browse Jobs <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!isLoadingAny && jobPlans.length > 0 && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
                {jobPlans.map(p => {
                  const badge = statusBadge(p.status)
                  const isOpening = openingJobId === p.job_id
                  return (
                    <div
                      key={p.job_id}
                      onClick={() => !isOpening && openJobPlan(p.job_id)}
                      style={{
                        background: 'white', borderRadius: 16, padding: '18px 22px',
                        border: p.is_active ? '1.5px solid #15130F' : '1.5px solid rgba(226,232,240,0.8)',
                        boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: isOpening ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 16, opacity: isOpening ? 0.7 : 1,
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF' }}>
                        <Briefcase size={20} color="#2563EB" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: 'Hind, sans-serif' }}>
                            {p.job_title}
                          </p>
                          {p.is_active && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A' }}>Active</span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>
                          {p.company_name} · {p.generated_at ? `Generated ${new Date(p.generated_at).toLocaleDateString()}` : 'Not generated yet'}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                      {p.status === 'ready' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 20, padding: '6px 14px' }}>
                          <TrendingUp size={12} color="#15130F" />
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#15130F' }}>{p.progress_pct}%</span>
                        </div>
                      )}
                      {isOpening ? <Loader2 size={16} color="#94A3B8" style={{ animation: 'spin 0.8s linear infinite' }} /> : <ChevronRight size={16} color="#94A3B8" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
