import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobPlanApi } from '@/api/jobPlan'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import AspLayout from '@/shared/layouts/AspLayout'
import { Map, ChevronRight, TrendingUp, Loader2, ArrowRight, Briefcase, Trash2 } from 'lucide-react'

function statusBadge(status: 'generating' | 'ready' | 'failed') {
  if (status === 'generating') return { color: '#D97706', label: 'Generating…' }
  if (status === 'failed') return { color: '#DC2626', label: 'Failed' }
  return { color: '#16A34A', label: 'Ready' }
}

export default function RoadmapHistoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { startPrep } = useActivePrepJob()
  const [openingJobId, setOpeningJobId] = useState<string | null>(null)

  const { data: jobPlans = [], isLoading: isLoadingAny } = useQuery({
    queryKey: ['job-plans-all'],
    queryFn: jobPlanApi.getAllMine,
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => jobPlanApi.remove(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-plans-all'] })
      qc.invalidateQueries({ queryKey: ['active-prep'] })
    },
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
    <AspLayout activePath="/app/roadmap">
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(37,99,235,0.08)',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Map size={14} color="white" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>My Roadmaps</span>
        </header>

        <main style={{ padding: '32px 36px', flex: 1 }}>
          {isLoadingAny && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <Loader2 size={26} color="#6366F1" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {isEmpty && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>No Roadmaps Yet</h2>
              <p style={{ fontSize: 13.5, color: '#9CA3AF', lineHeight: 1.6, maxWidth: 380, marginBottom: 22 }}>
                Pick a job from your matches and click "Generate Roadmap" to build your first personalised roadmap.
              </p>
              <button
                onClick={() => navigate('/app/jobs')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366F1', color: 'white', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Browse Jobs <ArrowRight size={14} />
              </button>
            </div>
          )}

          {!isLoadingAny && jobPlans.length > 0 && (
            <div style={{ maxWidth: 760 }}>
              {jobPlans.map((p, i) => {
                const badge = statusBadge(p.status)
                const isOpening = openingJobId === p.job_id
                return (
                  <div
                    key={p.job_id}
                    onClick={() => !isOpening && openJobPlan(p.job_id)}
                    style={{
                      padding: '16px 0',
                      borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                      cursor: isOpening ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 16, opacity: isOpening ? 0.6 : 1,
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2FF' }}>
                      <Briefcase size={17} color="#6366F1" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
                          {p.job_title}
                        </p>
                        {p.is_active && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A' }}>Active</span>
                        )}
                        {!p.job_is_open && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', background: '#F1F5F9', padding: '1px 7px', borderRadius: 20 }}>
                            Job closed
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
                        {p.company_name} · {p.generated_at ? `Generated ${new Date(p.generated_at).toLocaleDateString()}` : 'Not generated yet'}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: badge.color, flexShrink: 0 }}>
                      {badge.label}
                    </span>
                    {p.status === 'ready' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <TrendingUp size={12} color="#9CA3AF" />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4B5563' }}>{p.progress_pct}%</span>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/app/jobs/${p.job_id}`) }}
                      title="View job posting"
                      style={{
                        flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#6366F1',
                        background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      View job
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (window.confirm(`Delete the roadmap for ${p.job_title}? This can't be undone.`)) {
                          deleteMutation.mutate(p.job_id)
                        }
                      }}
                      disabled={deleteMutation.isPending && deleteMutation.variables === p.job_id}
                      title="Delete roadmap"
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: 'none',
                        background: 'none', color: '#CBD5E1', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#CBD5E1' }}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === p.job_id
                        ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : <Trash2 size={14} />}
                    </button>
                    {isOpening ? <Loader2 size={15} color="#9CA3AF" style={{ animation: 'spin 0.8s linear infinite' }} /> : <ChevronRight size={15} color="#D1D5DB" />}
                  </div>
                )
              })}
            </div>
          )}
        </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </AspLayout>
  )
}
