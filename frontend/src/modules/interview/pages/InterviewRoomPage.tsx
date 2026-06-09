import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import AppSidebar from '@/components/layout/AppSidebar'
import { ArrowLeft, ChevronRight, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: session, isLoading } = useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: () => interviewApi.getSession(sessionId!),
    enabled: !!sessionId,
  })

  // Auto-start if pending
  const startMutation = useMutation({
    mutationFn: () => interviewApi.startSession(sessionId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interview-session', sessionId] }),
  })

  useEffect(() => {
    if (session?.status === 'pending') {
      startMutation.mutate()
    }
    // Pre-fill answered questions
    if (session) {
      const answered = new Set(
        session.questions
          .slice(0, session.responses_count)
          .map(q => q.id)
      )
      setAnsweredIds(answered)
      const nextUnanswered = session.questions.findIndex(q => !answered.has(q.id))
      if (nextUnanswered >= 0) setCurrentQIdx(nextUnanswered)
    }
  }, [session?.id])

  const submitMutation = useMutation({
    mutationFn: () => {
      const q = session!.questions[currentQIdx]
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      return interviewApi.submitResponse(sessionId!, {
        question_id: q.id,
        response_text: answer.trim(),
        response_time_sec: elapsed,
      })
    },
    onSuccess: () => {
      const q = session!.questions[currentQIdx]
      setAnsweredIds(prev => new Set([...prev, q.id]))
      setAnswer('')
      setStartTime(Date.now())
      qc.invalidateQueries({ queryKey: ['interview-session', sessionId] })

      const nextIdx = currentQIdx + 1
      if (nextIdx < (session?.questions.length ?? 0)) {
        setCurrentQIdx(nextIdx)
        textareaRef.current?.focus()
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      setCompleting(true)
      return interviewApi.completeSession(sessionId!)
    },
    onSuccess: () => navigate(`/app/interview/sessions/${sessionId}/feedback`),
    onSettled: () => setCompleting(false),
  })

  if (isLoading || !session) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/interview" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  const questions = session.questions
  const currentQuestion = questions[currentQIdx]
  const allAnswered = answeredIds.size >= questions.length
  const progress = Math.round((answeredIds.size / questions.length) * 100)

  if (completing) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '4px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Analyzing your responses...</p>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>AI is generating detailed feedback. This may take a moment.</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/interview" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/interview')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#64748B' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Question {currentQIdx + 1} of {questions.length}
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>•</span>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>{session.session_type}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(226,232,240,0.6)', borderRadius: 3, width: 200, marginTop: 4 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #2D6A4F, #40916C)', borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          {allAnswered && (
            <button
              onClick={() => completeMutation.mutate()}
              style={{
                padding: '8px 18px', borderRadius: 10,
                background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                color: 'white', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <CheckCircle size={13} /> Finish & Get Feedback
            </button>
          )}
        </header>

        <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          {/* Question sidebar */}
          <div style={{ width: 200, borderRight: '1px solid rgba(226,232,240,0.8)', background: 'white', overflow: 'auto', padding: '16px 12px', flexShrink: 0 }}>
            {questions.map((q, idx) => {
              const isAnswered = answeredIds.has(q.id)
              const isCurrent = idx === currentQIdx
              return (
                <button
                  key={q.id}
                  onClick={() => { if (isAnswered || idx === 0) { setCurrentQIdx(idx); setAnswer('') } }}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 9, marginBottom: 4,
                    background: isCurrent ? 'rgba(45,106,79,0.07)' : 'none',
                    border: isCurrent ? '1.5px solid rgba(45,106,79,0.2)' : '1.5px solid transparent',
                    cursor: isAnswered ? 'pointer' : isCurrent ? 'default' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: isAnswered ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : isCurrent ? 'rgba(45,106,79,0.12)' : 'rgba(226,232,240,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: isAnswered ? 'white' : '#64748B', fontWeight: 700,
                  }}>
                    {isAnswered ? <CheckCircle size={11} /> : idx + 1}
                  </div>
                  <span style={{ fontSize: 10, color: isCurrent ? '#0F172A' : '#94A3B8', fontWeight: isCurrent ? 700 : 400, lineHeight: 1.3, flex: 1,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    Q{idx + 1}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Main answer area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column' }}>
            {currentQuestion && (
              <>
                <div style={{
                  background: 'white', borderRadius: 16, padding: '20px 24px', marginBottom: 20,
                  border: '1.5px solid rgba(226,232,240,0.8)',
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {currentQuestion.question_type && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6', fontWeight: 700, textTransform: 'capitalize' }}>
                        {currentQuestion.question_type}
                      </span>
                    )}
                    {currentQuestion.difficulty && (
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#F0FDF4', color: '#16A34A', fontWeight: 700, textTransform: 'capitalize' }}>
                        {currentQuestion.difficulty}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.6, fontFamily: 'Hind, sans-serif' }}>
                    {currentQuestion.question_text}
                  </p>
                </div>

                {answeredIds.has(currentQuestion.id) ? (
                  <div style={{
                    background: 'rgba(45,106,79,0.04)', border: '1.5px solid rgba(45,106,79,0.15)',
                    borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <CheckCircle size={18} color="#16A34A" />
                    <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                      Answer submitted! You can continue to the next question.
                    </span>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Your Answer</label>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Use the STAR method for behavioral questions</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      autoFocus
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Type your answer here. Be specific and use examples from your experience..."
                      style={{
                        flex: 1, minHeight: 200, borderRadius: 12,
                        border: '1.5px solid rgba(226,232,240,0.8)', padding: '14px 16px',
                        fontSize: 13, color: '#0F172A', lineHeight: 1.7, resize: 'vertical',
                        outline: 'none', fontFamily: 'system-ui, sans-serif',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => answer.trim() && submitMutation.mutate()}
                      disabled={!answer.trim() || submitMutation.isPending}
                      style={{
                        alignSelf: 'flex-end', marginTop: 12,
                        padding: '10px 22px', borderRadius: 10,
                        background: answer.trim() ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : 'rgba(226,232,240,0.8)',
                        color: answer.trim() ? 'white' : '#94A3B8',
                        border: 'none', cursor: answer.trim() ? 'pointer' : 'not-allowed',
                        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                        opacity: submitMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      <Send size={13} />
                      {submitMutation.isPending ? 'Submitting...' : 'Submit Answer'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
