import { useNavigate } from 'react-router-dom'
import { Bookmark, MapPin, Target, Trash2, ArrowUpRight, Compass, Loader2 } from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import EmptyState from '@/shared/components/feedback/EmptyState'
import { NAVY, INK, INK_SFT, MUTED, BORDER, colors } from '@/design-system/tokens'
import { formatSalary } from '@/api/jobs'
import { usePreparedJobs, useUnprepareJob } from '@/modules/dashboard/hooks/useKrs'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { toast } from '@/shared/components/feedback/Toast'

const INK_S    = INK_SFT
const CREAM_DK = colors.surface.elevated

export default function PrepListPage() {
  const navigate = useNavigate()
  const { data: jobs, isLoading } = usePreparedJobs()
  const unprepare = useUnprepareJob()
  const { activePrep, startPrep, isStartingPrep } = useActivePrepJob()

  return (
    <>
      <PageHeader
        title="Prep List"
        subtitle="Jobs you've saved to come back to — apply, focus your roadmap, or remove them here."
        icon={<Bookmark size={14} color={NAVY} />}
      />

      <main style={{ padding: '28px 32px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 92, borderRadius: 16, background: '#F8FAFC', animation: 'pulse 1.6s infinite', border: `1px solid ${BORDER}` }} />
            ))}
          </div>
        )}

        {!isLoading && (jobs ?? []).length === 0 && (
          <EmptyState
            icon={<Bookmark size={22} />}
            title="Nothing saved yet"
            description={'Tap "Prepare" on any job in Jobs or your Dashboard to add it here.'}
            action={
              <button
                onClick={() => navigate('/app/jobs')}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: NAVY, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Browse jobs
              </button>
            }
          />
        )}

        {!isLoading && (jobs ?? []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs!.map(job => {
              const salary = formatSalary(job.salary_min, job.salary_max)
              const isActive = activePrep?.job_id === job.id
              return (
                <div key={job.id} style={{
                  background: 'white', borderRadius: 16,
                  border: `1.5px solid ${isActive ? NAVY : BORDER}`,
                  padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 14.5, fontWeight: 700, color: INK, margin: 0 }}>{job.title}</p>
                      {isActive && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, background: `${NAVY}0F`, padding: '2px 8px', borderRadius: 20 }}>
                          Active roadmap focus
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12.5, color: MUTED, margin: '3px 0 8px' }}>{job.company_name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: INK_S }}>
                        <Target size={11} color={NAVY} /> {job.match_score}% match
                      </span>
                      {job.location && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: INK_S }}>
                          <MapPin size={11} /> {job.location}
                        </span>
                      )}
                      {salary && <span style={{ fontSize: 11.5, color: INK_S }}>{salary}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => navigate(`/app/jobs/${job.id}`)}
                      title="View job details"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${CREAM_DK}`, background: 'white', color: INK_S, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Details <ArrowUpRight size={12} />
                    </button>
                    <button
                      onClick={() => {
                        startPrep(job.id)
                        navigate('/app/roadmap')
                      }}
                      disabled={isActive || isStartingPrep}
                      title={isActive ? 'This is already your active roadmap focus' : 'Focus your roadmap on this job'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: 'none',
                        background: isActive ? CREAM_DK : NAVY, color: isActive ? MUTED : 'white',
                        fontSize: 12, fontWeight: 700, cursor: isActive || isStartingPrep ? 'default' : 'pointer',
                        opacity: isStartingPrep ? 0.7 : 1,
                      }}
                    >
                      {isStartingPrep ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Compass size={12} />}
                      {isActive ? 'Focused' : 'Focus roadmap'}
                    </button>
                    <button
                      onClick={() => {
                        unprepare.mutate(job.id, {
                          onError: () => toast.danger('Could not remove this job. Please try again.'),
                        })
                      }}
                      disabled={unprepare.isPending}
                      aria-label="Remove from prep list"
                      title="Remove from prep list"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${CREAM_DK}`, background: 'white', color: MUTED, cursor: unprepare.isPending ? 'wait' : 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </>
  )
}
