import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { interviewApi, OUTCOME_OPTIONS, type JobReadinessReport, type FeedbackItem } from '@/api/interview'
import { useState } from 'react'
import {
  CheckCircle, TrendingUp, RotateCcw, AlertTriangle,
  Target, Star, BookOpen, Calendar, ChevronDown, ChevronUp,
  Award, Briefcase, User, BarChart2, MapPin, Clock, ShieldAlert, MessageCircleQuestion
} from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import Tabs from '@/shared/components/navigation/Tabs'
import Spinner from '@/shared/components/feedback/Spinner'
import Button from '@/shared/components/primitives/Button'
import { colors } from '@/design-system/tokens'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return '#10B981'
  if (s >= 65) return '#F59E0B'
  if (s >= 50) return '#F97316'
  return '#EF4444'
}

function scoreLabel(s: number) {
  if (s >= 80) return 'Strong'
  if (s >= 65) return 'Good'
  if (s >= 50) return 'Average'
  return 'Needs Work'
}

// ── Big Readiness Score ───────────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const color = scoreColor(score)
  const angle = -135 + (score / 100) * 270
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block', width: 160, height: 100 }}>
        <svg viewBox="0 0 200 130" width="160" height="104">
          {/* Track */}
          <path d="M 20 110 A 80 80 0 1 1 180 110" fill="none" stroke="rgba(226,232,240,0.4)" strokeWidth="16" strokeLinecap="round" />
          {/* Fill */}
          <path
            d="M 20 110 A 80 80 0 1 1 180 110"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray="251.3"
            strokeDashoffset={251.3 * (1 - score / 100)}
            style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s' }}
          />
          {/* Needle */}
          <line
            x1="100" y1="110"
            x2={100 + 60 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={110 + 60 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={color} strokeWidth="3" strokeLinecap="round"
            style={{ transition: 'all 1.2s ease' }}
          />
          <circle cx="100" cy="110" r="6" fill={color} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 900, color, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{score}<span style={{ fontSize: 18 }}>%</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Skill Bar ─────────────────────────────────────────────────────────────────

function SkillBar({ skill, score, weight }: { skill: string; score: number; weight?: number }) {
  const c = scoreColor(score)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{skill}</span>
          {weight && <span style={{ fontSize: 10, color: '#94A3B8' }}>{weight}% weight</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{scoreLabel(score)}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{score}%</span>
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(226,232,240,0.5)', borderRadius: 8 }}>
        <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg, ${c}80, ${c})`, borderRadius: 8, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

// ── Recommendation Badge ──────────────────────────────────────────────────────

function HiringBadge({ rec }: { rec: string }) {
  const config = {
    'Strong Hire': { bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A', icon: '🌟' },
    'Hire': { bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB', icon: '✅' },
    'Maybe': { bg: '#FFFBEB', border: '#FDE68A', color: '#D97706', icon: '⚠️' },
    'No Hire': { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', icon: '❌' },
  }[rec] ?? { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B', icon: '📋' }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: config.bg, border: `1.5px solid ${config.border}` }}>
      <span style={{ fontSize: 18 }}>{config.icon}</span>
      <div>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hiring Recommendation</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: config.color }}>{rec}</div>
      </div>
    </div>
  )
}

// ── Question Feedback Card ────────────────────────────────────────────────────

function FeedbackCard({ item, index }: { item: FeedbackItem; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const sc = (s: number | null) => {
    if (!s) return '#94A3B8'
    if (s >= 8) return '#10B981'
    if (s >= 6) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid rgba(226,232,240,0.8)', marginBottom: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
      >
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'rgba(45,106,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#2D6A4F' }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, lineHeight: 1.4, marginBottom: 2 }}>{item.question_text ?? `Question ${index + 1}`}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {item.question_type && <span style={{ fontSize: 10, color: '#6366F1', background: '#EEF2FF', padding: '1px 6px', borderRadius: 10, fontWeight: 600, textTransform: 'capitalize' }}>{item.question_type}</span>}
            {item.skill_assessed && <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{item.skill_assessed}</span>}
            {item.is_fallback && <span style={{ fontSize: 10, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>AI scoring unavailable</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: sc(item.overall_score) }}>{item.overall_score?.toFixed(1) ?? '—'}<span style={{ fontSize: 10, fontWeight: 400 }}>/10</span></span>
          {open ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(226,232,240,0.4)' }}>
          {/* Dimension scores */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 0', flexWrap: 'wrap' }}>
            {[
              { key: 'clarity_score', label: 'Clarity' },
              { key: 'conciseness_score', label: 'Concise' },
              { key: 'impact_score', label: 'Impact' },
              { key: 'relevance_score', label: 'Relevance' },
              { key: 'star_adherence', label: 'Structure' },
            ].map(({ key, label }) => {
              const val = (item as any)[key] as number | null
              return (
                <div key={key} style={{ textAlign: 'center', minWidth: 56 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: sc(val) }}>{val ?? '—'}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>{label}</div>
                </div>
              )
            })}
          </div>

          {item.judge_disagreement_note && (
            <div style={{ background: '#FFFBEB', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scoring confidence — judges disagreed</div>
              <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6, margin: 0 }}>{item.judge_disagreement_note}</p>
            </div>
          )}

          {item.evidence_quote && (
            <div style={{ background: '#FAF5FF', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What earned this score</div>
              <p style={{ fontSize: 12, color: '#5B21B6', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{item.evidence_quote}"</p>
            </div>
          )}

          {item.original_response && (
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Answer</div>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, margin: 0 }}>{item.original_response}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: item.rewritten_answer ? 12 : 0 }}>
            {item.strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Strengths</div>
                {item.strengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(16,185,129,0.3)' }}>{s}</div>)}
              </div>
            )}
            {item.improvements?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} /> Improve</div>
                {item.improvements.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(245,158,11,0.3)' }}>{s}</div>)}
              </div>
            )}
          </div>

          {item.rewritten_answer && (
            <div style={{ background: 'rgba(45,106,79,0.04)', border: '1px solid rgba(45,106,79,0.12)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2D6A4F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model Answer</div>
              <p style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.7, margin: 0 }}>{item.rewritten_answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

function RoadmapTimeline({ steps }: { steps: JobReadinessReport['roadmap'] }) {
  const iconMap: Record<string, React.ReactNode> = {
    project: <BookOpen size={14} />,
    course: <Star size={14} />,
    practice: <Target size={14} />,
    reading: <BookOpen size={14} />,
  }
  const colorMap: Record<string, string> = {
    project: '#6366F1',
    course: '#10B981',
    practice: '#F59E0B',
    reading: '#3B82F6',
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: 'rgba(226,232,240,0.6)' }} />
      {steps.map((step, i) => {
        const color = colorMap[step.resource_type] ?? '#6366F1'
        return (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, zIndex: 1, background: 'white' }}>
              {iconMap[step.resource_type] ?? <Target size={14} />}
            </div>
            <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: '12px 16px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748B', fontWeight: 700 }}>
                  <Calendar size={11} /> {step.week_range}
                </div>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${color}12`, color, fontWeight: 700, textTransform: 'capitalize' }}>
                  {step.resource_type}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{step.focus}</div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{step.action}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Practice-next Card ────────────────────────────────────────────────────────

function PracticeNextCard({ skills, navigate }: { skills: string[]; navigate: (path: string) => void }) {
  return (
    <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(99,102,241,0.2)', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Target size={16} color="#6366F1" />
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Practice Before Your Next Interview</h2>
      </div>
      <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 14 }}>
        These came up weakest across your interviews so far — your next mock interview will already lean into them, but a head start helps.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {skills.map(skill => (
          <span key={skill} style={{ fontSize: 12, fontWeight: 700, color: '#4338CA', background: '#EEF2FF', padding: '5px 12px', borderRadius: 20 }}>
            {skill}
          </span>
        ))}
      </div>
      <button
        onClick={() => navigate('/app/roadmap')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontWeight: 700, fontSize: 13, padding: 0 }}
      >
        View your learning plan →
      </button>
    </div>
  )
}

// ── Outcome Survey (predictive-validity flywheel) ────────────────────────────

function OutcomeSurveyCard({ sessionId, reportedOutcome }: { sessionId: string; reportedOutcome: string | null }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)

  const submitMutation = useMutation({
    mutationFn: (outcome: string) => interviewApi.submitOutcome(sessionId, { outcome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-feedback', sessionId] }),
  })

  if (reportedOutcome) {
    const label = OUTCOME_OPTIONS.find(o => o.value === reportedOutcome)?.label ?? reportedOutcome
    return (
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 22px', border: '1.5px solid rgba(226,232,240,0.8)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle size={16} color="#10B981" />
        <span style={{ fontSize: 13, color: '#374151' }}>Thanks for letting us know — you reported: <strong>{label}</strong></span>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', borderRadius: 18, padding: '18px 22px', border: '1.5px solid rgba(99,102,241,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <MessageCircleQuestion size={16} color="#6366F1" />
        <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>How did the real interview go?</h2>
      </div>
      <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
        If you've applied for this role, let us know what happened — it helps us check that this score actually predicts real outcomes.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {OUTCOME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setSelected(opt.value); submitMutation.mutate(opt.value) }}
            disabled={submitMutation.isPending}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
              border: '1.5px solid rgba(99,102,241,0.25)',
              background: selected === opt.value ? '#EEF2FF' : 'white',
              color: '#4338CA',
              opacity: submitMutation.isPending && selected !== opt.value ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InterviewReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'report' | 'answers' | 'roadmap'>('report')

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['session-feedback', sessionId],
    queryFn: () => interviewApi.getFeedback(sessionId!),
    enabled: !!sessionId,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => interviewApi.regenerateReport(sessionId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['session-feedback', sessionId], updated)
    },
  })

  if (isLoading) return (
      <Spinner centered />
  )

  if (!feedback) return null

  const report = feedback.job_readiness_report
  // Audit finding (2026-08-24): a degraded report (the LLM call failed after
  // retry, or hit a rate limit past the fallback provider too) used to render
  // as if it were real — "0% readiness, No Hire" presented as the candidate's
  // actual assessment, no error state. Treat report.error the same as "no
  // report" here, so it falls through to the honest per-answer-average hero
  // and the report tab explains what actually happened.
  const reportErrored = !!report?.error
  const hasReport = !!report && !reportErrored
  const overallAvg = feedback.overall_avg
  const overallColor = overallAvg >= 8 ? '#10B981' : overallAvg >= 6 ? '#F59E0B' : '#EF4444'

  const REPORT_TABS = [
    { key: 'report',  label: 'Job Readiness Report', icon: <BarChart2 size={13} /> },
    { key: 'answers', label: 'Answer Feedback',       icon: <User size={13} /> },
    { key: 'roadmap', label: 'Learning Roadmap',      icon: <MapPin size={13} /> },
  ]

  return (
    <>
      <PageHeader
        title={report?.job_role ? `Interview Report — ${report.job_role}` : 'Interview Report'}
        back={
          <button
            onClick={() => navigate('/app/interview')}
            aria-label="Back to AI Interview"
            style={{ width: 30, height: 30, borderRadius: '50%', background: colors.surface.elevated, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text.inkSoft, fontSize: 16, flexShrink: 0 }}
          >←</button>
        }
        below={
          <Breadcrumb items={[
            { label: 'AI Interview', href: '/app/interview' },
            { label: 'Report' },
          ]} />
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/interview/history')}>
              View All Sessions
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/interview/setup')}>
              <RotateCcw size={12} style={{ marginRight: 4 }} /> New Interview
            </Button>
          </div>
        }
      />

      {/* Hero summary */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', padding: '32px 28px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {hasReport ? (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'center' }}>
              <div>
                <ReadinessGauge score={Math.round(report.overall_readiness_score)} />
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Job Readiness</div>
                  <HiringBadge rec={report.hiring_recommendation} />
                  {report.confidence_note && (
                    <p style={{ fontSize: 10.5, color: '#FCD34D', lineHeight: 1.5, marginTop: 8, maxWidth: 180 }}>
                      ⚠ {report.confidence_note}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', fontFamily: 'Hind, sans-serif', marginBottom: 8 }}>
                  {report.hiring_recommendation === 'Strong Hire' ? '🌟 Outstanding Performance!' :
                   report.hiring_recommendation === 'Hire' ? '✅ Solid Interview Performance' :
                   report.hiring_recommendation === 'Maybe' ? '⚡ Good Progress — Keep Building' :
                   '🎯 More Practice Needed — Here\'s Your Plan'}
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>
                  {report.readiness_message}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Technical', score: Math.round(report.technical_readiness_score), icon: '⚙️' },
                    { label: 'Communication', score: Math.round(report.communication_score), icon: '🗣️' },
                    { label: 'Confidence', score: Math.round(report.confidence_score), icon: '💪' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(item.score), marginBottom: 2 }}>{item.score}%</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: 40, marginBottom: 12, fontWeight: 900, color: overallColor, fontFamily: 'Hind, sans-serif' }}>
                {overallAvg.toFixed(1)}<span style={{ fontSize: 20 }}>/10</span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
                {overallAvg >= 8 ? 'Excellent Performance!' : overallAvg >= 6 ? 'Good Work — Keep Practicing' : 'Room to Grow'}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                Average score across {feedback.feedback_items.length} questions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background: colors.surface.card }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 28px' }}>
          <Tabs
            tabs={REPORT_TABS}
            active={activeTab}
            onChange={k => setActiveTab(k as 'report' | 'answers' | 'roadmap')}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px' }}>

        {hasReport && (
          <div style={{ marginBottom: 20 }}>
            <OutcomeSurveyCard sessionId={sessionId!} reportedOutcome={feedback.reported_outcome} />
          </div>
        )}

        {/* ── Report Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'report' && hasReport && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Competency scores */}
            <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(226,232,240,0.8)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #6366F1, #8B5CF6)', borderRadius: 4 }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Skill Competency Breakdown</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                {report.competencies.map(comp => (
                  <SkillBar
                    key={comp.skill}
                    skill={comp.skill}
                    score={Math.round(report.skill_scores?.[comp.skill] ?? 60)}
                    weight={comp.weight}
                  />
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Award size={16} color="#10B981" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Key Strengths</h2>
              </div>
              {report.strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>

            {/* Gaps */}
            <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <AlertTriangle size={16} color="#F59E0B" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Critical Gaps</h2>
              </div>
              {report.critical_gaps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>

            {report.consistency_notes?.length > 0 && (
              <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(139,92,246,0.25)', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <AlertTriangle size={16} color="#8B5CF6" />
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Consistency Check</h2>
                </div>
                {report.consistency_notes.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {report.pacing_notes?.length > 0 && (
              <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(59,130,246,0.25)', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Clock size={16} color="#3B82F6" />
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Pacing</h2>
                </div>
                {report.pacing_notes.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {report.integrity_notes?.length > 0 && (
              <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(220,38,38,0.25)', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <ShieldAlert size={16} color="#DC2626" />
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Integrity Flags</h2>
                </div>
                {report.integrity_notes.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Candidate summary */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04))', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(99,102,241,0.15)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Briefcase size={16} color="#6366F1" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Recruiter Summary</h2>
                <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>How a recruiter would describe you</span>
              </div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, fontStyle: 'italic', margin: 0 }}>
                "{report.candidate_summary}"
              </p>
            </div>

            {/* Recommendation */}
            <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: '1.5px solid rgba(226,232,240,0.8)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <HiringBadge rec={report.hiring_recommendation} />
              </div>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7 }}>
                {report.hiring_recommendation_reason}
              </p>
            </div>

            {feedback.weak_skills.length > 0 && (
              <PracticeNextCard skills={feedback.weak_skills} navigate={navigate} />
            )}
          </div>
        )}

        {activeTab === 'report' && !hasReport && (
          <div>
            <div style={{ background: reportErrored ? '#FEF2F2' : 'white', borderRadius: 18, padding: '32px', textAlign: 'center', border: reportErrored ? '1.5px solid #FECACA' : '1.5px solid rgba(226,232,240,0.8)', marginBottom: feedback.weak_skills.length > 0 ? 20 : 0 }}>
              {reportErrored ? (
                <>
                  <AlertTriangle size={22} color="#DC2626" style={{ marginBottom: 10 }} />
                  <p style={{ color: '#7F1D1D', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    We couldn't generate your Job Readiness Report
                  </p>
                  <p style={{ color: '#991B1B', fontSize: 13, marginBottom: 14 }}>
                    This is a technical failure, not your actual score — the average per-answer score above is real. This is usually temporary (a busy AI service) — try again, or start a new interview instead.
                  </p>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => regenerateMutation.mutate()}
                      disabled={regenerateMutation.isPending}
                      style={{ background: '#DC2626', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: regenerateMutation.isPending ? 'default' : 'pointer', color: 'white', fontWeight: 700, fontSize: 13, opacity: regenerateMutation.isPending ? 0.7 : 1 }}
                    >
                      {regenerateMutation.isPending ? 'Retrying…' : 'Try again'}
                    </button>
                    <button onClick={() => navigate('/app/interview/setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontWeight: 700, fontSize: 14 }}>
                      Start a new interview →
                    </button>
                  </div>
                  {regenerateMutation.isError && (
                    <p style={{ color: '#991B1B', fontSize: 12, marginTop: 10 }}>
                      Still couldn't generate it — give it a bit longer and try again.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: '#64748B', fontSize: 14 }}>
                  Full Job Readiness Report is only available for role-specific interviews.<br />
                  <button onClick={() => navigate('/app/interview/setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontWeight: 700, fontSize: 14 }}>
                    Start a targeted interview →
                  </button>
                </p>
              )}
            </div>
            {feedback.weak_skills.length > 0 && (
              <PracticeNextCard skills={feedback.weak_skills} navigate={navigate} />
            )}
          </div>
        )}

        {/* ── Answers Tab ────────────────────────────────────────────────────── */}
        {activeTab === 'answers' && (
          <div>
            <div style={{ background: 'white', borderRadius: 18, padding: '18px 22px', marginBottom: 18, border: '1.5px solid rgba(226,232,240,0.8)', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: overallColor, fontFamily: 'Hind, sans-serif' }}>{overallAvg.toFixed(1)}/10</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Overall Average</div>
              </div>
              <div style={{ flex: 1, height: 8, background: 'rgba(226,232,240,0.4)', borderRadius: 8 }}>
                <div style={{ width: `${(overallAvg / 10) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${overallColor}80, ${overallColor})`, borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{feedback.feedback_items.length} questions</div>
            </div>
            {feedback.feedback_items.map((item, idx) => (
              <FeedbackCard key={item.id} item={item} index={idx} />
            ))}
          </div>
        )}

        {/* ── Roadmap Tab ────────────────────────────────────────────────────── */}
        {activeTab === 'roadmap' && (
          <div>
            {hasReport && report.roadmap?.length > 0 ? (
              <div>
                <div style={{ background: 'white', borderRadius: 18, padding: '22px 24px', marginBottom: 24, border: '1.5px solid rgba(226,232,240,0.8)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <MapPin size={16} color="#6366F1" />
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                      Your Personalized Learning Roadmap
                    </h2>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 0 }}>
                    Based on gaps identified in your interview, here's your targeted plan to reach {report.job_role} readiness.
                    Current readiness: <strong style={{ color: scoreColor(report.overall_readiness_score) }}>{Math.round(report.overall_readiness_score)}%</strong>
                  </p>
                </div>
                <RoadmapTimeline steps={report.roadmap} />
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 18, padding: '32px', textAlign: 'center', border: '1.5px solid rgba(226,232,240,0.8)' }}>
                <p style={{ color: '#64748B', fontSize: 14 }}>
                  Personalized roadmap is generated for role-specific interviews.<br />
                  <button onClick={() => navigate('/app/interview/setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontWeight: 700, fontSize: 14 }}>
                    Start a targeted interview →
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </>
  )
}
