import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import AppSidebar from '@/components/layout/AppSidebar'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { MessageSquare, Play, BarChart2, ChevronRight, CheckCircle, Clock } from 'lucide-react'

const SESSION_TYPES = [
  { value: 'practice', label: 'Quick Round', desc: '5 questions, 15 min', icon: '⚡' },
  { value: 'timed', label: 'Standard', desc: '10 questions, 30 min', icon: '🎯' },
  { value: 'full_mock', label: 'Deep Dive', desc: '15 questions, 45 min', icon: '🔬' },
]

const STATUS_COLORS: Record<string, [string, string]> = {
  pending:    ['#64748B', '#F1F5F9'],
  in_progress:['#D97706', '#FEF3C7'],
  completed:  ['#16A34A', '#F0FDF4'],
  abandoned:  ['#DC2626', '#FEF2F2'],
}

export default function InterviewHomePage() {
  const navigate = useNavigate()
  const [sessionType, setSessionType] = useState('practice')
  const { activePrep } = useActivePrepJob()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['interview-sessions'],
    queryFn: interviewApi.listSessions,
  })

  const { data: performance } = useQuery({
    queryKey: ['interview-performance'],
    queryFn: interviewApi.getPerformance,
  })

  const createMutation = useMutation({
    mutationFn: () => interviewApi.createSession({
      session_type: sessionType,
      total_questions: sessionType === 'practice' ? 5 : sessionType === 'timed' ? 10 : 10,
      career_track_id: activePrep?.matched_track_id ?? undefined,
      job_context: activePrep
        ? `Job: ${activePrep.job_title} at ${activePrep.company_name}. Skills needed: ${activePrep.skills_to_develop.slice(0, 3).join(', ')}`
        : undefined,
    }),
    onSuccess: (session) => navigate(`/app/interview/room/${session.id}`),
  })

  const recentSessions = sessions?.slice(0, 5) ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex' }}>
      <AppSidebar activePath="/app/interview" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 8,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <MessageSquare size={18} color="#2D6A4F" />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
            Mock Interview
          </span>
        </header>

        <main style={{ padding: '24px 28px' }}>
          <ActivePrepBanner showSwitch />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, maxWidth: 1000 }}>
            {/* Left: Start new session */}
            <div>
              <div style={{
                background: 'white', borderRadius: 20, padding: '24px 28px', marginBottom: 24,
                border: '1.5px solid rgba(226,232,240,0.8)',
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
                  Start a Mock Interview
                </h2>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>
                  {activePrep
                    ? <>Practice questions tailored for <strong style={{ color: '#0F172A' }}>{activePrep.job_title} at {activePrep.company_name}</strong>. Get AI feedback on every answer.</>
                    : 'Practice corporate interview questions tailored for UPSC-to-private sector transitions. Get AI-powered feedback on every answer.'
                  }
                </p>

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  {SESSION_TYPES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSessionType(s.value)}
                      style={{
                        flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                        border: sessionType === s.value ? '2px solid #2D6A4F' : '1.5px solid rgba(226,232,240,0.8)',
                        background: sessionType === s.value ? 'rgba(45,106,79,0.04)' : 'white',
                        textAlign: 'center', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.desc}</div>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => navigate('/app/interview/setup')}
                    style={{
                      flex: 2, height: 44, borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: 'white', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    <Play size={14} fill="white" />
                    AI Interview (Role-Specific)
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    style={{
                      flex: 1, height: 44, borderRadius: 12,
                      background: 'white', border: '1.5px solid rgba(45,106,79,0.3)',
                      color: '#2D6A4F', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: createMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {createMutation.isPending ? 'Setting up...' : 'Quick Practice'}
                  </button>
                </div>
              </div>

              {/* Recent sessions */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 16, background: '#2563EB', borderRadius: 4 }} />
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Recent Sessions</h2>
                </div>
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <div style={{ width: 22, height: 22, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : recentSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 13 }}>
                    No sessions yet. Start your first mock interview!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentSessions.map(s => {
                      const [color, bg] = STATUS_COLORS[s.status] ?? ['#64748B', '#F1F5F9']
                      return (
                        <div
                          key={s.id}
                          onClick={() => navigate(`/app/interview/sessions/${s.id}`)}
                          style={{
                            background: 'white', borderRadius: 12, padding: '12px 16px',
                            border: '1.5px solid rgba(226,232,240,0.8)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'box-shadow 0.15s',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>
                                {s.session_type} Session
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color }}>
                                {s.status.replace('_', ' ')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <MessageSquare size={10} /> {s.responses_count}/{s.total_questions} answered
                              </span>
                              {s.avg_score !== null && (
                                <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>
                                  Score: {s.avg_score.toFixed(1)}/10
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} color="#CBD5E1" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Stats panel */}
            <div>
              {performance && (
                <div style={{
                  background: 'white', borderRadius: 20, padding: '20px 20px 16px',
                  border: '1.5px solid rgba(226,232,240,0.8)',
                }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>
                    Performance Overview
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Total Sessions', value: performance.total_sessions },
                      { label: 'Completed', value: performance.completed_sessions },
                      { label: 'Avg Score', value: performance.avg_overall_score.toFixed(1) + '/10' },
                      { label: 'Best Session', value: performance.best_session_score.toFixed(1) + '/10' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        background: 'rgba(248,250,252,0.8)', borderRadius: 10,
                        padding: '10px 12px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                          {value}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {performance.completed_sessions > 0 && (
                    <>
                      <div style={{ height: 1, background: 'rgba(226,232,240,0.6)', margin: '14px 0' }} />
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Dimension Averages
                      </h4>
                      {[
                        { label: 'Clarity', value: performance.avg_clarity },
                        { label: 'Conciseness', value: performance.avg_conciseness },
                        { label: 'Impact', value: performance.avg_impact },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#64748B' }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{value.toFixed(1)}</span>
                          </div>
                          <div style={{ height: 5, background: 'rgba(45,106,79,0.1)', borderRadius: 5 }}>
                            <div style={{
                              width: `${(value / 10) * 100}%`, height: '100%',
                              background: '#2563EB',
                              borderRadius: 5, transition: 'width 0.8s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
