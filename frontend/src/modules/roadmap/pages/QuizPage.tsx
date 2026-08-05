import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobPlanApi, type QuizSubmitResponse } from '@/api/jobPlan'
import AppSidebar from '@/components/layout/AppSidebar'
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink, Loader2, RotateCcw, Zap } from 'lucide-react'

export default function QuizPage() {
  const { jobId, moduleId } = useParams<{ jobId: string; moduleId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizSubmitResponse | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['job-learning-plan', jobId],
    queryFn: () => jobPlanApi.get(jobId!),
    enabled: !!jobId,
  })

  const module = data?.plan?.modules.find(m => m.id === moduleId)
  const quizProgress = (data?.progress ?? {})[`quiz_${moduleId}`] as { score_pct: number; passed: boolean } | undefined

  const generateMutation = useMutation({
    mutationFn: () => jobPlanApi.generateQuiz(jobId!, moduleId!),
    onSuccess: () => {
      // Retrying means a fresh set of questions, not just re-answering the same ones.
      setAnswers({})
      setResult(null)
      qc.invalidateQueries({ queryKey: ['job-learning-plan', jobId] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => jobPlanApi.submitQuiz(
      jobId!, moduleId!,
      (module?.quiz?.questions ?? []).map(q => ({ question_id: q.id, selected_option_id: answers[q.id] ?? '' })),
    ),
    onSuccess: (res) => {
      setResult(res)
      qc.invalidateQueries({ queryKey: ['job-learning-plan', jobId] })
    },
  })

  const quiz = module?.quiz
  const allAnswered = !!quiz && quiz.questions.every(q => !!answers[q.id])

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex' }}>
      <AppSidebar activePath="/app/roadmap" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(37,99,235,0.08)',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/roadmap')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
            Quiz{module ? ` · ${module.skill}` : ''}
          </span>
        </header>

        <main style={{ padding: '28px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <Loader2 size={28} color="#6366F1" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!isLoading && !module && (
            <p style={{ textAlign: 'center', color: '#94A3B8', padding: 60 }}>Module not found.</p>
          )}

          {!isLoading && module && !quiz && (
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid rgba(37,99,235,0.08)', padding: '40px 32px', textAlign: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
                No quiz yet for {module.skill}
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>
                Generate a quiz covering everything in this module's resources.
              </p>
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                  background: '#2563EB', color: 'white',
                  border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 13.5, fontWeight: 700,
                  cursor: generateMutation.isPending ? 'wait' : 'pointer',
                }}
              >
                {generateMutation.isPending
                  ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating quiz...</>
                  : <><Zap size={15} /> Generate Quiz</>}
              </button>
              {generateMutation.isError && (
                <p style={{ fontSize: 12, color: '#DC2626', marginTop: 14 }}>Failed to generate quiz. Please try again.</p>
              )}
            </div>
          )}

          {!isLoading && module && quiz && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {quizProgress?.passed && !result && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>You already passed this quiz — {quizProgress.score_pct}%</span>
                </div>
              )}

              <div style={{ background: 'white', borderRadius: 20, border: '1px solid rgba(37,99,235,0.08)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>{module.skill} — Quick Check</h2>
                    <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '4px 0 0' }}>{quiz.questions.length} questions covering this topic's resources</p>
                  </div>
                  {!result && (
                    <button
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      title="Generate a fresh set of questions"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                        background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 8,
                        padding: '6px 12px', fontSize: 11.5, fontWeight: 700, color: '#64748B',
                        cursor: generateMutation.isPending ? 'wait' : 'pointer',
                      }}
                    >
                      {generateMutation.isPending
                        ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : <RotateCcw size={12} />} New Questions
                    </button>
                  )}
                </div>

                {quiz.questions.map((q, qi) => {
                  const qResult = result?.results.find(r => r.question_id === q.id)
                  return (
                    <div key={q.id}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 10px' }}>{qi + 1}. {q.text}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {q.options.map(opt => {
                          const isSelected = answers[q.id] === opt.id
                          const isCorrectOpt = qResult && opt.id === qResult.correct_option_id
                          const isWrongSelected = qResult && isSelected && !qResult.is_correct
                          return (
                            <label
                              key={opt.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                borderRadius: 10, cursor: result ? 'default' : 'pointer',
                                background: isCorrectOpt ? '#F0FDF4' : isWrongSelected ? '#FEF2F2' : isSelected ? '#FAFBFC' : 'transparent',
                                border: `1.5px solid ${isCorrectOpt ? '#BBF7D0' : isWrongSelected ? '#FECACA' : isSelected ? '#2563EB' : '#E2E8F0'}`,
                              }}
                            >
                              <input
                                type="radio" name={q.id} checked={isSelected} disabled={!!result}
                                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                              />
                              <span style={{ fontSize: 13, color: '#374151' }}>{opt.text}</span>
                            </label>
                          )
                        })}
                      </div>
                      {qResult && (
                        <p style={{ fontSize: 12, color: qResult.is_correct ? '#16A34A' : '#DC2626', margin: '8px 0 0', lineHeight: 1.5 }}>
                          {qResult.is_correct ? '✓ Correct — ' : '✗ Incorrect — '}{qResult.explanation}
                        </p>
                      )}
                    </div>
                  )
                })}

                {!result ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                    <button
                      onClick={() => submitMutation.mutate()}
                      disabled={!allAnswered || submitMutation.isPending}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: allAnswered ? '#2563EB' : '#E2E8F0',
                        color: allAnswered ? 'white' : '#94A3B8', border: 'none', borderRadius: 12,
                        padding: '11px 22px', fontSize: 13.5, fontWeight: 700, cursor: allAnswered ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {submitMutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Submitting...</> : 'Submit Answers'}
                    </button>
                    {submitMutation.isError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <p style={{ fontSize: 12.5, color: '#DC2626', margin: 0 }}>
                          {(submitMutation.error as any)?.response?.status === 400
                            ? "This quiz wasn't saved properly on the server — please regenerate it."
                            : 'Failed to submit. Please try again.'}
                        </p>
                        <button
                          onClick={() => generateMutation.mutate()}
                          style={{ background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                        >
                          Regenerate
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: result.passed ? '#16A34A' : '#DC2626' }}>
                        Score: {result.score_pct}% {result.passed ? '— Passed!' : '— Not quite'}
                      </span>
                      {result.passed ? (
                        <button onClick={() => navigate('/app/roadmap')} style={{ background: 'none', border: '1.5px solid #2563EB', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>
                          Back to Plan
                        </button>
                      ) : (
                        <button
                          onClick={() => generateMutation.mutate()}
                          disabled={generateMutation.isPending}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, color: '#64748B', cursor: generateMutation.isPending ? 'wait' : 'pointer' }}
                        >
                          {generateMutation.isPending
                            ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating...</>
                            : <><RotateCcw size={13} /> Retry with new questions</>}
                        </button>
                      )}
                    </div>

                    {/* Retry guidance panel — only shown on failure */}
                    {!result.passed && result.retry_guidance && (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>
                          {result.retry_guidance.message}
                        </p>

                        {result.retry_guidance.missed_explanations.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                              What you missed
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {result.retry_guidance.missed_explanations.map((exp, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <span style={{ color: '#DC2626', fontSize: 12, marginTop: 1, flexShrink: 0 }}>✗</span>
                                  <p style={{ fontSize: 12.5, color: '#374151', margin: 0, lineHeight: 1.5 }}>{exp}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.retry_guidance.resources_to_revisit.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                              Revisit before retrying
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {result.retry_guidance.resources_to_revisit.map(res => (
                                <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1E3A5F', textDecoration: 'none' }}
                                >
                                  <BookOpen size={13} color="#B45309" style={{ flexShrink: 0 }} />
                                  {res.title}
                                  <ExternalLink size={10} color="#9CA3AF" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
