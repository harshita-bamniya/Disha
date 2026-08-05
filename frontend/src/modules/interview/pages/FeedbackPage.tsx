import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import AppSidebar from '@/components/layout/AppSidebar'
import { ArrowLeft, CheckCircle, TrendingUp, MessageSquare, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const DIMENSION_LABELS: Record<string, string> = {
  clarity_score:      'Clarity',
  conciseness_score:  'Conciseness',
  impact_score:       'Impact',
  relevance_score:    'Relevance',
  star_adherence:     'STAR Structure',
  overall_score:      'Overall',
}

function ScoreRing({ score, max = 10, size = 56, color = '#2D6A4F' }: {
  score: number | null; max?: number; size?: number; color?: string
}) {
  const val = score ?? 0
  const pct = val / max
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}20`} strokeWidth={5} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.22} fontWeight={700}>
        {val.toFixed(1)}
      </text>
    </svg>
  )
}

function FeedbackCard({ item, index }: { item: any; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)

  const scoreColor = (s: number | null) => {
    if (!s) return '#94A3B8'
    if (s >= 8) return '#16A34A'
    if (s >= 6) return '#D97706'
    return '#DC2626'
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      border: '1.5px solid rgba(226,232,240,0.8)', overflow: 'hidden',
      marginBottom: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(45,106,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#2D6A4F',
        }}>{index + 1}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
          {item.question_text ?? `Question ${index + 1}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(item.overall_score) }}>
            {item.overall_score?.toFixed(1) ?? '—'}/10
          </span>
          {expanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(226,232,240,0.5)' }}>
          {/* Dimension scores */}
          <div style={{ display: 'flex', gap: 12, padding: '16px 0', flexWrap: 'wrap' }}>
            {Object.entries(DIMENSION_LABELS)
              .filter(([key]) => key !== 'overall_score')
              .map(([key, label]) => {
                const val = item[key] as number | null
                return (
                  <div key={key} style={{ textAlign: 'center', minWidth: 60 }}>
                    <ScoreRing score={val} size={44} color={val && val >= 7 ? '#16A34A' : val && val >= 5 ? '#D97706' : '#DC2626'} />
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, fontWeight: 600 }}>{label}</div>
                  </div>
                )
              })}
          </div>

          {item.original_response && (
            <div style={{ background: 'rgba(248,250,252,0.8)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your Answer
              </div>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, margin: 0 }}>{item.original_response}</p>
            </div>
          )}

          {item.strengths?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={11} /> Strengths
              </div>
              {item.strengths.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(22,163,74,0.3)' }}>
                  {s}
                </div>
              ))}
            </div>
          )}

          {item.improvements?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <TrendingUp size={11} /> Areas to Improve
              </div>
              {item.improvements.map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(217,119,6,0.3)' }}>
                  {s}
                </div>
              ))}
            </div>
          )}

          {item.rewritten_answer && (
            <div style={{ background: 'rgba(45,106,79,0.04)', border: '1px solid rgba(45,106,79,0.12)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2D6A4F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Model Answer
              </div>
              <p style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.7, margin: 0 }}>{item.rewritten_answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeedbackPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['session-feedback', sessionId],
    queryFn: () => interviewApi.getFeedback(sessionId!),
    enabled: !!sessionId,
  })

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex' }}>
      <AppSidebar activePath="/app/interview" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (!feedback) return null

  const overallColor = feedback.overall_avg >= 8 ? '#16A34A' : feedback.overall_avg >= 6 ? '#D97706' : '#DC2626'

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex' }}>
      <AppSidebar activePath="/app/interview" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/interview')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#64748B' }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
            Interview Feedback
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/app/interview')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9,
                border: '1.5px solid rgba(45,106,79,0.3)', background: 'white',
                color: '#2D6A4F', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}
            >
              <RotateCcw size={12} /> New Session
            </button>
          </div>
        </header>

        <main style={{ padding: '24px 28px', maxWidth: 800 }}>
          {/* Score summary */}
          <div style={{
            background: 'white', borderRadius: 20, padding: '24px 28px', marginBottom: 24,
            border: '1.5px solid rgba(226,232,240,0.8)',
            display: 'flex', alignItems: 'center', gap: 28,
          }}>
            <ScoreRing score={feedback.overall_avg} size={80} color={overallColor} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                {feedback.overall_avg >= 8
                  ? 'Excellent Performance!'
                  : feedback.overall_avg >= 6
                  ? 'Good Work — Keep Practicing'
                  : 'Room to Grow — Review the Feedback Below'}
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                Average score across {feedback.feedback_items.length} questions.
                Review each answer below to see specific improvements.
              </p>
            </div>
          </div>

          {/* Per-question feedback */}
          {feedback.feedback_items.map((item, idx) => (
            <FeedbackCard key={item.id} item={item} index={idx} />
          ))}
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
