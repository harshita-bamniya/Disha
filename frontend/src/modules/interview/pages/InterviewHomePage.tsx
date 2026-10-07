import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Trash2 } from 'lucide-react'
import { interviewApi } from '@/api/interview'
import { verifiedApi } from '@/api/verifiedInterview'
import PageHeader from '@/shared/layouts/PageHeader'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { colors } from '@/design-system/tokens'

const { text, surface } = colors

const STATUS_BADGE: Record<string, 'gray' | 'amber' | 'green' | 'red'> = {
  scheduled: 'gray', pending: 'gray', in_progress: 'amber', completed: 'green', abandoned: 'red',
}

const SESSION_LABEL: Record<string, string> = {
  practice: 'Quick interview', timed: 'Timed interview', full_mock: 'In-depth interview',
  stress: 'Stress interview', drill: 'Drill',
}

// A small improvement tracker: the average score of your last completed
// interviews, oldest to newest.
function ScoreTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const first = scores[0]
  const last = scores[scores.length - 1]
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
        Your last {scores.length} interviews
      </h3>
      <div
        role="img"
        aria-label={`Average scores from oldest to newest: ${scores.map(s => s.toFixed(1)).join(', ')} out of 10`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}
      >
        {scores.map((s, i) => (
          <div key={i} title={`${s.toFixed(1)}/10`} style={{
            flex: 1, height: `${Math.max(8, (s / 10) * 100)}%`, borderRadius: 4,
            background: i === scores.length - 1 ? colors.state.info : surface.elevated,
          }} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: text.inkSoft, margin: '8px 0 0' }}>
        {last > first ? `Up ${(last - first).toFixed(1)} points since your first of these.` : last < first ? 'A dip lately. A drill on your weakest skill is a quick way back up.' : 'Holding steady.'}
      </p>
    </div>
  )
}

function Bar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const low = value < 6
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: text.inkSoft }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: low ? colors.state.danger : text.ink }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 5, background: surface.elevated, borderRadius: 5 }} role="img" aria-label={`${label}: ${value.toFixed(1)} out of ${max}`}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: low ? colors.state.danger : colors.state.info, borderRadius: 5 }} />
      </div>
    </div>
  )
}

export default function InterviewHomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => interviewApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['interview-performance'] })
    },
  })

  const confirmDelete = (id: string) => {
    if (window.confirm('Delete this interview and its report? This cannot be undone.')) deleteMutation.mutate(id)
  }

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['interview-sessions'],
    queryFn: interviewApi.listSessions,
  })
  const { data: invitations } = useQuery({
    queryKey: ['interview-invitations'],
    queryFn: verifiedApi.listMyInvitations,
  })
  const openInvitations = (invitations ?? []).filter(i => i.status === 'invited' || i.status === 'started')

  const { data: performance } = useQuery({
    queryKey: ['interview-performance'],
    queryFn: interviewApi.getPerformance,
  })

  const recent = sessions?.slice(0, 8) ?? []
  const trend = (sessions ?? [])
    .filter(s => s.status === 'completed' && s.session_type !== 'drill' && s.avg_score !== null)
    .slice(0, 8)
    .reverse()
    .map(s => s.avg_score as number)

  return (
    <>
      <PageHeader
        title="Interview history"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="outline" onClick={() => navigate('/app/interview/drill')}>Quick drill</Button>
            <Button size="sm" onClick={() => navigate('/app/interview/setup')}>Start new interview</Button>
          </div>
        }
      />

      <main style={{ padding: '24px 28px', maxWidth: 1000 }}>
        <ActivePrepBanner showSwitch />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
          <section aria-label="Recent interviews">
            {openInvitations.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 12px' }}>Invitations from employers</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openInvitations.map(inv => (
                    <Card key={inv.id} padding={14} hoverable onClick={() => navigate(`/app/interview/invitations/${inv.id}`)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: text.ink }}>{inv.employer_name}: {inv.role}</div>
                          <span style={{ fontSize: 12, color: text.muted }}>
                            {inv.status === 'started' ? 'In progress. ' : ''}Open until {new Date(inv.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge color="blue">{inv.status === 'started' ? 'Continue' : 'Invited'}</Badge>
                        <ChevronRight size={14} color={text.muted} aria-hidden />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <h2 style={{ fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 12px' }}>Recent interviews</h2>
            {isLoading ? (
              <Spinner centered />
            ) : recent.length === 0 ? (
              <Card padding={24}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: text.inkSoft }}>No interviews yet.</p>
                <Button size="sm" onClick={() => navigate('/app/interview/setup')}>Start your first interview</Button>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recent.map(s => (
                  <Card
                    key={s.id}
                    padding={14}
                    hoverable
                    onClick={() => navigate(s.status === 'completed' ? `/app/interview/report/${s.id}` : `/app/interview/room/${s.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: text.ink }}>{s.job_role || SESSION_LABEL[s.session_type] || 'Interview'}</span>
                          <Badge color={STATUS_BADGE[s.status] ?? 'gray'}>{s.status === 'in_progress' ? 'Resume' : s.status.replace('_', ' ')}</Badge>
                        </div>
                        <span style={{ fontSize: 12, color: text.muted }}>
                          {s.responses_count}/{s.total_questions} answered
                          {s.avg_score !== null && ` · Score ${s.avg_score.toFixed(1)}/10`}
                        </span>
                      </div>
                      <button
                        aria-label="Delete this interview"
                        title="Delete this interview"
                        disabled={deleteMutation.isPending}
                        onClick={e => { e.stopPropagation(); confirmDelete(s.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: text.muted }}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                      <ChevronRight size={14} color={text.muted} aria-hidden />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {performance && performance.total_sessions > 0 && (
            <section aria-label="Performance overview">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 12px' }}>Performance overview</h2>
              <Card padding={20}>
                <ScoreTrend scores={trend} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 18 }}>
                  {[
                    { label: 'Interviews', value: String(performance.total_sessions) },
                    { label: 'Completed', value: String(performance.completed_sessions) },
                    { label: 'Average score', value: `${performance.avg_overall_score.toFixed(1)}/10` },
                    { label: 'Best score', value: `${performance.best_session_score.toFixed(1)}/10` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: text.ink }}>{value}</div>
                      <div style={{ fontSize: 12, color: text.muted }}>{label}</div>
                    </div>
                  ))}
                </div>

                {performance.completed_sessions > 0 && (
                  <>
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Dimensions</h3>
                    <Bar label="Clarity" value={performance.avg_clarity} />
                    <Bar label="Conciseness" value={performance.avg_conciseness} />
                    <Bar label="Impact" value={performance.avg_impact} />
                  </>
                )}

                {performance.by_skill.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 10px' }}>Skills</h3>
                    {performance.by_skill.map(({ skill, avg_score, attempts }) => (
                      <Bar key={skill} label={`${skill} · ${attempts}x`} value={avg_score} />
                    ))}
                  </>
                )}
              </Card>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
