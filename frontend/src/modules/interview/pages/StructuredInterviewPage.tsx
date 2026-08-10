/**
 * Structured Interview Page — uses the session-based interview system with
 * AI-adaptive questioning. After each response the AI decides:
 *   - Follow-up probe (dig deeper)
 *   - Challenge (stress-test the answer)
 *   - Next question (move on)
 *
 * At completion, full AI feedback is generated per response.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { interviewApi, type SessionDetail, type SessionFeedback, type NextQuestionResult } from '@/api/interview'
import PageHeader from '@/shared/layouts/PageHeader'
import {
  Brain, ChevronRight, CheckCircle2, Loader2, Send, RotateCcw,
  ArrowLeft, Zap, AlertCircle, TrendingUp, MessageSquare, Star,
} from 'lucide-react'

type Phase = 'setup' | 'interview' | 'feedback'

interface ActiveQuestion {
  id?: string
  text: string
  is_followup: boolean
  question_type?: string
}

interface ResponseRecord {
  question: ActiveQuestion
  answer: string
  response_id: string
  provisional_score: number
  coaching_note: string
  action_taken: string
}

const SCORE_COLOR = (s: number) => s >= 7 ? '#22C55E' : s >= 5 ? '#F59E0B' : '#EF4444'
const SCORE_LABEL = (s: number) => s >= 8 ? 'Strong' : s >= 6 ? 'Good' : s >= 4 ? 'Developing' : 'Needs Work'

export default function StructuredInterviewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const careerTrackId = params.get('track') ?? undefined

  const [phase, setPhase] = useState<Phase>('setup')
  const [sessionType, setSessionType] = useState<'practice' | 'hr' | 'technical' | 'stress'>('practice')
  const [totalQ, setTotalQ] = useState(5)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [starting, setStarting] = useState(false)

  // Interview state
  const [currentQ, setCurrentQ] = useState<ActiveQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waitingNext, setWaitingNext] = useState(false)
  const [responses, setResponses] = useState<ResponseRecord[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [completingSession, setCompletingSession] = useState(false)
  const startTime = useRef<number>(Date.now())

  // Feedback state
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when question changes
  useEffect(() => {
    if (currentQ && phase === 'interview') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [currentQ, phase])

  async function startSession() {
    setStarting(true)
    try {
      const s = await interviewApi.createSession({
        career_track_id: careerTrackId,
        session_type: sessionType,
        total_questions: totalQ,
      })
      await interviewApi.startSession(s.id)
      setSession(s)

      // Set first question
      if (s.questions.length > 0) {
        const first = s.questions[0]
        setCurrentQ({ id: first.id, text: first.question_text, is_followup: false, question_type: first.question_type ?? undefined })
        setQIndex(0)
      }
      setPhase('interview')
      startTime.current = Date.now()
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  async function submitAnswer() {
    if (!session || !currentQ || !answer.trim() || submitting) return
    const responseText = answer.trim()
    const elapsed = Math.round((Date.now() - startTime.current) / 1000)
    setSubmitting(true)
    startTime.current = Date.now()

    try {
      // Need a real question_id. For follow-up questions (no id), use the last real question's id
      const questionId = currentQ.id
        ?? responses.findLast(r => r.question.id)?.question.id
        ?? session.questions[0]?.id ?? ''

      const { response_id } = await interviewApi.submitResponse(session.id, {
        question_id: questionId,
        response_text: responseText,
        response_time_sec: elapsed,
      })
      setAnswer('')

      // Ask AI for next action
      setWaitingNext(true)
      const next: NextQuestionResult = await interviewApi.getNextQuestion(session.id, response_id)

      // Record this exchange
      setResponses(prev => [...prev, {
        question: currentQ,
        answer: responseText,
        response_id,
        provisional_score: next.provisional_score,
        coaching_note: next.coaching_note,
        action_taken: next.action,
      }])

      if (next.session_complete || !next.question) {
        setSessionComplete(true)
      } else {
        const nextQ = next.question
        setCurrentQ({
          id: nextQ.id,
          text: nextQ.text,
          is_followup: nextQ.is_followup,
          question_type: nextQ.question_type,
        })
        setQIndex(prev => prev + 1)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
      setWaitingNext(false)
    }
  }

  async function completeFeedback() {
    if (!session) return
    setCompletingSession(true)
    setLoadingFeedback(true)
    try {
      const fb = await interviewApi.completeSession(session.id)
      setFeedback(fb)
      setPhase('feedback')
    } catch (e) {
      console.error(e)
    } finally {
      setCompletingSession(false)
      setLoadingFeedback(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); submitAnswer() }
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13, marginBottom: 24 }}>
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Brain size={22} color="#3B82F6" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>
                AI-Adaptive Interview
              </h1>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 28 }}>
              The AI listens to each answer and decides whether to probe deeper, challenge you, or move on — just like a real interviewer.
            </p>

            {/* Session type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                Interview Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { id: 'practice', label: 'Practice', desc: 'General balanced questions' },
                  { id: 'hr', label: 'HR Round', desc: 'Motivation, culture fit, background' },
                  { id: 'technical', label: 'Technical', desc: 'Domain knowledge and problem-solving' },
                  { id: 'stress', label: 'Stress Round', desc: 'High pressure, pushback on answers' },
                ].map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSessionType(t.id as any)}
                    style={{
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${sessionType === t.id ? '#3B82F6' : 'rgba(226,232,240,0.8)'}`,
                      background: sessionType === t.id ? 'rgba(59,130,246,0.06)' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: sessionType === t.id ? '#1D4ED8' : '#1E3A5F', marginBottom: 3 }}>
                      {t.label}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                Number of Questions: {totalQ}
              </label>
              <input
                type="range" min={3} max={10} value={totalQ}
                onChange={e => setTotalQ(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#3B82F6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                <span>3 (quick)</span><span>10 (full round)</span>
              </div>
            </div>

            <button
              onClick={startSession}
              disabled={starting}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                background: '#2563EB',
                color: 'white', border: 'none', cursor: starting ? 'not-allowed' : 'pointer',
                fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}
            >
              {starting
                ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Starting…</>
                : <><Brain size={16} /> Start Adaptive Interview</>
              }
            </button>
          </div>
        </div>
    )
  }

  // ── INTERVIEW ─────────────────────────────────────────────────────────────────
  if (phase === 'interview') {
    const totalResponded = responses.length
    const runningAvg = totalResponded > 0
      ? (responses.reduce((sum, r) => sum + r.provisional_score, 0) / totalResponded).toFixed(1)
      : null

    return (
      <>
        <PageHeader
          title="AI-Adaptive Interview"
          icon={<Brain size={16} color="#3B82F6" />}
          subtitle={`${totalResponded} / ${session?.total_questions ?? totalQ} answered`}
          actions={
            runningAvg ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', borderRadius: 20, padding: '5px 12px' }}>
                <TrendingUp size={12} color="#3B82F6" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>Running avg: {runningAvg}/10</span>
              </div>
            ) : undefined
          }
        />

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, padding: '24px 28px', alignItems: 'start' }}>
            {/* Left: Current question */}
            <div>
              {/* Session complete banner */}
              {sessionComplete && !completingSession && (
                <div style={{
                  background: '#F0FDF4',
                  border: '1.5px solid rgba(34,197,94,0.3)',
                  borderRadius: 20, padding: '24px 28px', marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <CheckCircle2 size={22} color="#22C55E" />
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                      All questions answered!
                    </h2>
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 18 }}>
                    Ready to generate detailed AI feedback on all your responses — scores, coaching notes, and model answers.
                  </p>
                  <button
                    onClick={completeFeedback}
                    disabled={loadingFeedback}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 24px', borderRadius: 12,
                      background: '#16A34A',
                      color: 'white', border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
                    }}
                  >
                    {loadingFeedback
                      ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating feedback…</>
                      : <><Zap size={15} /> Get AI Feedback</>
                    }
                  </button>
                </div>
              )}

              {/* Current question card */}
              {currentQ && !sessionComplete && (
                <div style={{
                  background: 'white', borderRadius: 20,
                  border: '1.5px solid rgba(59,130,246,0.2)',
                  padding: '24px 28px',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: currentQ.is_followup ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                      color: currentQ.is_followup ? '#7C3AED' : '#1D4ED8',
                    }}>
                      {currentQ.is_followup ? '↩ Follow-up' : `Q${qIndex + 1}`}
                    </div>
                    {currentQ.question_type && (
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                        {currentQ.question_type}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', lineHeight: 1.5, marginBottom: 20 }}>
                    {currentQ.text}
                  </p>

                  <textarea
                    ref={textareaRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your answer here… Use STAR method: Situation → Task → Action → Result. Press Ctrl+Enter to submit."
                    rows={7}
                    disabled={submitting || waitingNext}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 12,
                      border: '1.5px solid rgba(59,130,246,0.18)',
                      fontSize: 14, color: '#1E3A5F', lineHeight: 1.7,
                      resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                      background: submitting ? '#F9FAFB' : 'white', boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.45)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.18)'}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>
                      {answer.length} chars · Ctrl+Enter to submit
                    </span>

                    <button
                      onClick={submitAnswer}
                      disabled={!answer.trim() || submitting || waitingNext}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '11px 22px', borderRadius: 12,
                        background: answer.trim() && !submitting && !waitingNext
                          ? '#2563EB' : '#E5E7EB',
                        color: answer.trim() && !submitting && !waitingNext ? 'white' : '#9CA3AF',
                        border: 'none',
                        cursor: answer.trim() && !submitting && !waitingNext ? 'pointer' : 'not-allowed',
                        fontSize: 13, fontWeight: 700,
                        boxShadow: answer.trim() && !submitting && !waitingNext
                          ? '0 4px 12px rgba(59,130,246,0.25)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {submitting || waitingNext
                        ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                          {waitingNext ? 'Adapting…' : 'Submitting…'}
                        </>
                        : <><Send size={14} /> Submit Answer</>
                      }
                    </button>
                  </div>

                  {waitingNext && (
                    <div style={{
                      marginTop: 14, padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)',
                      fontSize: 12, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Brain size={14} style={{ flexShrink: 0 }} />
                      AI is evaluating your response and deciding the next question…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Response history */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: 'white', borderRadius: 16,
                border: '1.5px solid rgba(226,232,240,0.8)',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>
                  Response Log
                </p>
                {responses.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>No responses yet. Answer the first question to begin.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {responses.map((r, i) => (
                      <div key={r.response_id} style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: 'rgba(248,250,252,0.8)',
                        border: `1px solid ${SCORE_COLOR(r.provisional_score)}25`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>
                            {r.question.is_followup ? '↩ Follow-up' : `Q${i + 1}`}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: SCORE_COLOR(r.provisional_score),
                            background: `${SCORE_COLOR(r.provisional_score)}12`,
                            padding: '2px 7px', borderRadius: 20,
                          }}>
                            {r.provisional_score}/10 · {SCORE_LABEL(r.provisional_score)}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: '#374151', margin: '0 0 4px', lineHeight: 1.4 }}>
                          {r.question.text.length > 80 ? r.question.text.slice(0, 80) + '…' : r.question.text}
                        </p>
                        {r.coaching_note && r.coaching_note !== 'AI evaluation unavailable — response recorded.' && (
                          <p style={{ fontSize: 11, color: '#64748B', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                            {r.coaching_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress indicator */}
              <div style={{
                background: 'white', borderRadius: 14,
                border: '1.5px solid rgba(226,232,240,0.8)',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Progress</span>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    {totalResponded} / {session?.total_questions ?? totalQ}
                  </span>
                </div>
                <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 100, height: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    width: `${Math.min(100, (totalResponded / (session?.total_questions ?? totalQ)) * 100)}%`,
                    background: '#2563EB',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          </div>
      </>
    )
  }

  // ── FEEDBACK ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Interview Complete — AI Feedback"
        icon={<CheckCircle2 size={16} color="#22C55E" />}
        actions={
          <button
            onClick={() => navigate('/app/mock-interview')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              background: '#2563EB',
              color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            <RotateCcw size={13} /> Practice Again
          </button>
        }
      />

        <main style={{ padding: '28px', maxWidth: 860, margin: '0 auto' }}>
          {/* Overall score card */}
          {feedback && (
            <div style={{
              background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(29,78,216,0.04))',
              border: '1.5px solid rgba(59,130,246,0.2)',
              borderRadius: 20, padding: '24px 28px', marginBottom: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 14, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Overall Performance</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 700, color: SCORE_COLOR(feedback.overall_avg), lineHeight: 1 }}>
                    {feedback.overall_avg.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 20, color: '#94A3B8', fontWeight: 600 }}>/ 10</span>
                </div>
                <p style={{ fontSize: 13, color: SCORE_COLOR(feedback.overall_avg), fontWeight: 700, marginTop: 4 }}>
                  {SCORE_LABEL(feedback.overall_avg * 10)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>{feedback.feedback_items.length} responses evaluated</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'Clarity', key: 'clarity_score' },
                    { label: 'Impact', key: 'impact_score' },
                    { label: 'STAR', key: 'star_adherence' },
                  ].map(({ label, key }) => {
                    const avg = feedback.feedback_items.reduce((sum, f) => sum + ((f as any)[key] ?? 0), 0) / Math.max(1, feedback.feedback_items.length)
                    return (
                      <div key={key} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: SCORE_COLOR(avg) }}>{avg.toFixed(1)}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Per-response feedback */}
          {feedback?.feedback_items.map((item, i) => (
            <div key={item.id} style={{
              background: 'white', borderRadius: 18,
              border: `1.5px solid ${SCORE_COLOR(item.overall_score ?? 5)}25`,
              padding: '22px 26px', marginBottom: 16,
              boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Question {i + 1}
                  </span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F', marginTop: 4, lineHeight: 1.4 }}>
                    {item.question_text}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: SCORE_COLOR(item.overall_score ?? 5) }}>
                    {item.overall_score ?? '—'}/10
                  </div>
                  <div style={{ fontSize: 11, color: SCORE_COLOR(item.overall_score ?? 5), fontWeight: 700 }}>
                    {SCORE_LABEL(item.overall_score ?? 5)}
                  </div>
                </div>
              </div>

              {/* Score bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Clarity', val: item.clarity_score },
                  { label: 'Concise', val: item.conciseness_score },
                  { label: 'Impact', val: item.impact_score },
                  { label: 'STAR', val: item.star_adherence },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: SCORE_COLOR(val ?? 5) }}>{val ?? '—'}</div>
                    <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 100, height: 4, margin: '3px 0' }}>
                      <div style={{ height: '100%', borderRadius: 100, width: `${((val ?? 5) / 10) * 100}%`, background: SCORE_COLOR(val ?? 5) }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Strengths */}
              {item.strengths.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    Strengths
                  </p>
                  {item.strengths.map((s, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <CheckCircle2 size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Improvements */}
              {item.improvements.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    To Improve
                  </p>
                  {item.improvements.map((s, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <AlertCircle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Model answer */}
              {item.rewritten_answer && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={13} /> View model answer <ChevronRight size={12} />
                  </summary>
                  <div style={{
                    marginTop: 10, padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)',
                    fontSize: 13, color: '#374151', lineHeight: 1.6,
                  }}>
                    {item.rewritten_answer}
                  </div>
                </details>
              )}
            </div>
          ))}
        </main>
    </>
  )
}
