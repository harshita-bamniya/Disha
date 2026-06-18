import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { roadmapApi, type RoadmapOut, type StageStatus, type NarrativeFeedback, type TicketTemplate, type TicketSubmission } from '@/api/roadmap'
import AppSidebar from '@/components/layout/AppSidebar'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import ExercisePanel from '../components/ExercisePanel'
import LearningPathsPanel from '../components/LearningPathsPanel'
import JobLearningPlanPanel from '../components/JobLearningPlanPanel'
import { xpApi } from '@/api/xp'
import {
  Map, CheckCircle2, Circle, Lock, ChevronRight, ChevronDown,
  Sparkles, FileText, Briefcase, Mic, Send, RotateCcw,
  AlertCircle, Loader2, ArrowRight, Star, TrendingUp, Clock,
  Zap, Users,
} from 'lucide-react'

// ── Stage icons ───────────────────────────────────────────────────────────────
const STAGE_ICONS = [Sparkles, TrendingUp, Briefcase, FileText, Mic, Map]
const STAGE_COLORS: Record<StageStatus['status'], string> = {
  passed:  '#059669',
  active:  '#15130F',
  pending: '#94A3B8',
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative panel (Stage 1)
// ─────────────────────────────────────────────────────────────────────────────
function NarrativePanel({ roadmap }: { roadmap: RoadmapOut }) {
  const [text, setText] = useState(roadmap.narrative_feedback?.rewritten_version ? '' : '')
  const [feedback, setFeedback] = useState<NarrativeFeedback | null>(roadmap.narrative_feedback ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  async function handleSubmit() {
    if (text.trim().length < 100) { setError('Minimum 100 characters required.'); return }
    setLoading(true); setError('')
    try {
      const result = await roadmapApi.submitNarrative(roadmap.id, text)
      setFeedback(result)
      qc.invalidateQueries({ queryKey: ['roadmap'] })
      qc.invalidateQueries({ queryKey: ['jrs'] })
    } catch {
      setError('Failed to evaluate narrative. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#F0FDF4', borderRadius: 14, padding: '16px 20px', border: '1px solid #BBF7D0' }}>
        <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          Write 2–4 paragraphs about your background and career goals. Our AI coach will reframe your UPSC experience into private-sector vocabulary that resonates with hiring managers.
        </p>
      </div>

      {!feedback && (
        <>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            placeholder="I am a passionate individual who spent 4 years preparing for the UPSC civil services examination... (write your story here)"
            style={{
              width: '100%', minHeight: 200, padding: '14px 16px',
              border: '1.5px solid rgba(226,232,240,0.9)', borderRadius: 12,
              fontSize: 13, color: '#0F172A', lineHeight: 1.7,
              resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: text.length < 100 ? '#EF4444' : '#94A3B8' }}>
              {text.length} / 100 min chars
            </span>
            {error && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
            <button
              onClick={handleSubmit}
              disabled={loading || text.trim().length < 100}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: loading || text.trim().length < 100 ? '#E2E8F0' : 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
                color: loading || text.trim().length < 100 ? '#94A3B8' : 'white',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: 13, fontWeight: 700, cursor: loading || text.trim().length < 100 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Evaluating...</> : <><Sparkles size={14} /> Evaluate with AI</>}
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#F8FAFC', borderRadius: 14, padding: '16px 20px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: feedback.overall_score >= 70 ? '#DCFCE7' : feedback.overall_score >= 50 ? '#FEF3C7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: feedback.overall_score >= 70 ? '#16A34A' : feedback.overall_score >= 50 ? '#D97706' : '#DC2626', fontFamily: 'Hind, sans-serif' }}>
                {feedback.overall_score}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Narrative Score</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0' }}>
                {feedback.commercial_language_pct}% commercial language · {feedback.upsc_jargon_found.length} jargon phrases found
              </p>
              <p style={{ fontSize: 12, color: '#15130F', fontWeight: 600, marginTop: 4 }}>{feedback.coaching_note}</p>
            </div>
          </div>

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', marginBottom: 8 }}>What works well</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {feedback.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={14} color="#16A34A" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {feedback.specific_improvements.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginBottom: 8 }}>Specific rewrites</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {feedback.specific_improvements.slice(0, 3).map((imp, i) => (
                  <div key={i} style={{ background: '#FFFBEB', borderRadius: 10, padding: '12px 14px', border: '1px solid #FDE68A' }}>
                    <p style={{ fontSize: 11, color: '#92400E', margin: '0 0 6px', fontStyle: 'italic' }}>"{imp.original}"</p>
                    <p style={{ fontSize: 11, color: '#78350F', margin: '0 0 6px' }}><strong>Issue:</strong> {imp.issue}</p>
                    <p style={{ fontSize: 11, color: '#166534', margin: 0 }}><strong>Rewrite:</strong> {imp.rewrite}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewritten version */}
          {feedback.rewritten_version && (
            <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '16px 18px', border: '1px solid #BBF7D0' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', margin: '0 0 10px' }}>AI-improved version</p>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{feedback.rewritten_version}</p>
            </div>
          )}

          <button
            onClick={() => { setFeedback(null); setText('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid rgba(226,232,240,0.9)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#64748B', background: 'white', cursor: 'pointer', width: 'fit-content' }}
          >
            <RotateCcw size={12} /> Submit new version
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket panel (Stage 4)
// ─────────────────────────────────────────────────────────────────────────────
function TicketPanel({ roadmap }: { roadmap: RoadmapOut }) {
  const [selectedTicket, setSelectedTicket] = useState<TicketTemplate | null>(null)
  const [submissionText, setSubmissionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const qc = useQueryClient()

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: roadmapApi.getTickets,
  })
  const { data: submissions = [] } = useQuery({
    queryKey: ['ticket-submissions', roadmap.id],
    queryFn: () => roadmapApi.getSubmissions(roadmap.id),
    refetchInterval: (data) => {
      const hasPending = (data as TicketSubmission[] | undefined)?.some(s => s.review_status === 'pending' || s.review_status === 'reviewing')
      return hasPending ? 5000 : false
    },
  })

  const DIFF_COLORS: Record<string, string> = { junior: '#10B981', mid: '#3B82F6', senior: '#8B5CF6' }

  async function handleSubmit() {
    if (!selectedTicket || submissionText.trim().length < 50) return
    setSubmitting(true)
    try {
      await roadmapApi.submitTicket(roadmap.id, selectedTicket.id, submissionText)
      setSubmitted(true)
      setSelectedTicket(null)
      setSubmissionText('')
      qc.invalidateQueries({ queryKey: ['ticket-submissions', roadmap.id] })
      qc.invalidateQueries({ queryKey: ['jrs'] })
    } catch {
      // silent — user can retry
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {submitted && (
        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 16px', border: '1px solid #BBF7D0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <CheckCircle2 size={16} color="#16A34A" />
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Submitted! AI review usually takes 1–2 minutes.</span>
        </div>
      )}

      {/* Past submissions */}
      {submissions.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Past Submissions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissions.map(sub => (
              <div key={sub.id} style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub.ai_review_result ? 10 : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{sub.ticket_title || 'Work Ticket'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    background: sub.review_status === 'done' ? '#DCFCE7' : sub.review_status === 'failed' ? '#FEE2E2' : '#F1F5F9',
                    color: sub.review_status === 'done' ? '#16A34A' : sub.review_status === 'failed' ? '#DC2626' : '#64748B',
                  }}>
                    {sub.review_status === 'pending' && '⏳ Pending review'}
                    {sub.review_status === 'reviewing' && '🤖 Reviewing...'}
                    {sub.review_status === 'done' && `✓ Score: ${sub.ai_review_result?.overall_score ?? '—'}`}
                    {sub.review_status === 'failed' && '✗ Review failed'}
                  </span>
                </div>
                {sub.ai_review_result && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>
                      {sub.ai_review_result.grade_label} — "{sub.ai_review_result.hiring_manager_verdict}"
                    </p>
                    {sub.ai_review_result.improvements.length > 0 && (
                      <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                        Top fix: {sub.ai_review_result.improvements[0]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available tickets */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Available Tickets</p>
        {tickets.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94A3B8' }}>No tickets available for your career track yet. Check back soon.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                style={{
                  background: selectedTicket?.id === ticket.id ? '#F0FDF4' : 'white',
                  borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                  border: selectedTicket?.id === ticket.id ? '1.5px solid #15130F' : '1.5px solid rgba(226,232,240,0.8)',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.05)', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{ticket.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                    background: `${DIFF_COLORS[ticket.difficulty]}15`, color: DIFF_COLORS[ticket.difficulty],
                    textTransform: 'capitalize' as const }}>{ticket.difficulty}</span>
                </div>
                <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, margin: '0 0 10px',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                  {ticket.context}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94A3B8' }}>
                  <Clock size={11} /> ~{ticket.estimated_hours}h estimated
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submission form */}
      {selectedTicket && (
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '20px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{selectedTicket.title}</p>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}><strong>Context:</strong> {selectedTicket.context}</p>
          <p style={{ fontSize: 12, color: '#0F172A', fontWeight: 600, marginBottom: 16 }}><strong>Deliverable:</strong> {selectedTicket.deliverable}</p>
          <textarea
            value={submissionText}
            onChange={e => setSubmissionText(e.target.value)}
            placeholder="Write your analysis and recommendations here..."
            style={{ width: '100%', minHeight: 220, padding: '14px 16px', border: '1.5px solid rgba(226,232,240,0.9)', borderRadius: 12, fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button
              onClick={() => setSelectedTicket(null)}
              style={{ padding: '8px 16px', border: '1.5px solid rgba(226,232,240,0.9)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#64748B', background: 'white', cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || submissionText.trim().length < 50}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: submitting || submissionText.trim().length < 50 ? 'not-allowed' : 'pointer', background: submitting || submissionText.trim().length < 50 ? '#E2E8F0' : 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: submitting || submissionText.trim().length < 50 ? '#94A3B8' : 'white' }}
            >
              {submitting ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Submitting...</> : <><Send size={13} /> Submit</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage card
// ─────────────────────────────────────────────────────────────────────────────
function StageCard({ stage, roadmap, isExpanded, onToggle }: {
  stage: StageStatus
  roadmap: RoadmapOut
  isExpanded: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const color = STAGE_COLORS[stage.status]
  const Icon = STAGE_ICONS[stage.stage_number - 1]
  const qc = useQueryClient()

  const [checkingGate, setCheckingGate] = useState(false)
  const [gateResult, setGateResult] = useState<null | { can_advance: boolean; criteria: Array<{ label: string; current_value: number; min_value: number; passed: boolean }>; message: string }>(null)

  async function handleGateCheck() {
    setCheckingGate(true)
    try {
      const result = await roadmapApi.checkGate(roadmap.id, stage.stage_number)
      setGateResult(result)
    } catch {
      // silent
    } finally {
      setCheckingGate(false)
    }
  }

  const advanceMutation = useMutation({
    mutationFn: () => roadmapApi.advanceStage(roadmap.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap'] })
      qc.invalidateQueries({ queryKey: ['jrs'] })
      setGateResult(null)
    },
  })

  return (
    <div style={{
      background: 'white', borderRadius: 20,
      border: stage.status === 'active' ? `2px solid ${color}` : '1.5px solid rgba(226,232,240,0.8)',
      boxShadow: stage.status === 'active' ? `0 4px 20px ${color}20` : '0 2px 8px rgba(15,23,42,0.04)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={stage.status !== 'pending' ? onToggle : undefined}
        style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, cursor: stage.status !== 'pending' ? 'pointer' : 'default', userSelect: 'none' as const }}
      >
        {/* Stage icon */}
        <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: stage.status === 'passed' ? '#DCFCE7' : stage.status === 'active' ? `${color}15` : '#F1F5F9' }}>
          {stage.status === 'passed' ? <CheckCircle2 size={22} color="#16A34A" /> : stage.status === 'pending' ? <Lock size={18} color="#CBD5E1" /> : <Icon size={20} color={color} />}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: color, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
              Stage {stage.stage_number}
            </span>
            {stage.status === 'active' && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color }}>In Progress</span>
            )}
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: stage.status === 'pending' ? '#CBD5E1' : '#0F172A', margin: '3px 0 0', fontFamily: 'Hind, sans-serif' }}>{stage.title}</p>
          {stage.estimated_days && (
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>~{stage.estimated_days} days</p>
          )}
        </div>

        {/* Progress or chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {stage.status !== 'pending' && stage.progress_pct > 0 && stage.status !== 'passed' && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: 'Hind, sans-serif' }}>{stage.progress_pct}%</span>
            </div>
          )}
          {stage.status !== 'pending' && (isExpanded ? <ChevronDown size={16} color="#94A3B8" /> : <ChevronRight size={16} color="#94A3B8" />)}
        </div>
      </div>

      {/* Progress bar */}
      {stage.status === 'active' && (
        <div style={{ height: 3, background: '#F1F5F9', margin: '0 22px 0' }}>
          <div style={{ width: `${stage.progress_pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 3, transition: 'width 0.8s ease' }} />
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && stage.status !== 'pending' && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid rgba(226,232,240,0.6)', marginTop: 16 }}>
          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: '16px 0' }}>{stage.description}</p>

          {/* Stage-specific content */}
          {stage.stage_number === 1 && <NarrativePanel roadmap={roadmap} />}
          {stage.stage_number === 2 && (
            roadmap.active_prep_job_id
              ? (
                <JobLearningPlanPanel
                  roadmap={roadmap}
                  activeJobId={roadmap.active_prep_job_id}
                  activeJobTitle={roadmap.active_prep_job_title ?? undefined}
                  activeCompany={roadmap.active_prep_job_company ?? undefined}
                />
              )
              : (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: '#FFFBEB', border: '1px solid #FDE68A',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                  }}>
                    <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                      <strong>Tip:</strong> Go to <a href="/app/jobs" style={{ color: '#15130F', fontWeight: 700 }}>Jobs</a>, open a job you want to target,
                      and click <strong>"Set as Active Prep Job"</strong> to get a personalised AI roadmap for that role.
                    </span>
                  </div>
                  <LearningPathsPanel roadmap={roadmap} />
                </div>
              )
          )}
          {stage.stage_number === 3 && <ExercisePanel roadmap={roadmap} />}
          {stage.stage_number === 4 && <TicketPanel roadmap={roadmap} />}
          {stage.stage_number === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => navigate('/app/resume')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: '#15130F', border: '1.5px solid #15130F', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <FileText size={14} /> Optimise Resume <ArrowRight size={13} />
              </button>
              <button onClick={() => navigate('/app/interview/structured')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Zap size={14} /> AI-Adaptive Interview <ArrowRight size={13} />
              </button>
              <button onClick={() => navigate('/app/mock-interview')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Mic size={14} /> AI Persona Mock Interview <ArrowRight size={13} />
              </button>
            </div>
          )}
          {stage.stage_number === 6 && (
            <button onClick={() => navigate('/app/jobs')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Browse Matching Jobs <ArrowRight size={13} />
            </button>
          )}

          {/* Gate check button (only for active stage and stage < 6) */}
          {stage.status === 'active' && stage.stage_number < 6 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(226,232,240,0.6)' }}>
              {!gateResult ? (
                <button
                  onClick={handleGateCheck}
                  disabled={checkingGate}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: `1.5px solid ${color}40`, borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color, cursor: checkingGate ? 'not-allowed' : 'pointer' }}
                >
                  {checkingGate ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Checking...</> : <><Star size={13} /> Check Stage Gate</>}
                </button>
              ) : (
                <div style={{ background: gateResult.can_advance ? '#F0FDF4' : '#FFF7ED', borderRadius: 12, padding: '14px 16px', border: `1px solid ${gateResult.can_advance ? '#BBF7D0' : '#FED7AA'}` }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: gateResult.can_advance ? '#166534' : '#92400E', margin: '0 0 10px' }}>
                    {gateResult.can_advance ? '✓ Gate Passed! Ready for next stage.' : gateResult.message}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gateResult.criteria.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.passed ? <CheckCircle2 size={13} color="#16A34A" /> : <Circle size={13} color="#D97706" />}
                        <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{c.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.passed ? '#16A34A' : '#D97706' }}>
                          {c.current_value} / {c.min_value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {gateResult.can_advance && (
                    <button
                      onClick={() => advanceMutation.mutate()}
                      disabled={advanceMutation.isPending}
                      style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {advanceMutation.isPending ? 'Advancing...' : <>Advance to Stage {stage.stage_number + 1} <ArrowRight size={13} /></>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate roadmap prompt
// ─────────────────────────────────────────────────────────────────────────────
function GeneratePrompt() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', padding: 40 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Map size={36} color="white" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 10, fontFamily: 'Hind, sans-serif' }}>Your Roadmap Awaits</h2>
      <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, maxWidth: 400, marginBottom: 28 }}>
        First, select a career track. Your personalised 6-stage job-readiness roadmap will be generated from your KRS profile and live job market data.
      </p>
      <button
        onClick={() => navigate('/app/careers/explore')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(21,19,15,0.22)' }}
      >
        Choose a Career Track <ArrowRight size={16} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const [expandedStage, setExpandedStage] = useState<number | null>(null)

  // useActivePrepJob reads from persisted Zustand store instantly (no network lag)
  const { activePrep, isLoading: prepLoading } = useActivePrepJob()

  const { data: roadmap, isLoading: roadmapLoading } = useQuery({
    queryKey: ['roadmap'],
    queryFn: () => roadmapApi.getMine(),
    retry: false,
    // Don't throw — a 404 just means no roadmap yet, handled below
    throwOnError: false,
  })
  const { data: cohortData } = useQuery({
    queryKey: ['cohort-signals'],
    queryFn: xpApi.getCohortSignals,
    staleTime: 5 * 60 * 1000,
    enabled: !!roadmap,
  })

  // Only block on roadmap loading — activePrep comes from persisted store instantly
  const isLoading = roadmapLoading

  function toggleStage(num: number) {
    setExpandedStage(prev => prev === num ? null : num)
  }

  // Auto-expand the active stage on first load
  if (roadmap && expandedStage === null) {
    setExpandedStage(roadmap.current_stage)
  }

  // Active prep job but no full roadmap → show job-focused plan directly
  const showJobPlanOnly = !roadmapLoading && !roadmap && !!activePrep

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex' }}>
      <AppSidebar activePath="/app/roadmap" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Map size={13} color="white" />
            </div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>My Roadmap</span>
            {roadmap && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>· {roadmap.career_track_name}</span>}
            {showJobPlanOnly && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>· {activePrep.job_title}</span>}
          </div>
          {roadmap && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 20, padding: '6px 14px' }}>
              <TrendingUp size={12} color="#15130F" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#15130F' }}>JRS: {roadmap.job_readiness_score}</span>
            </div>
          )}
        </header>

        <main style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22, alignItems: 'start', flex: 1 }}>

          {/* Left: stages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <Loader2 size={28} color="#15130F" style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}

            {/* Job-focused mode */}
            {showJobPlanOnly && (
              <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid rgba(226,232,240,0.8)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' }}>
                <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase size={18} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 800, color: 'white', margin: 0 }}>{activePrep.job_title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{activePrep.company_name}</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 22px' }}>
                  <JobLearningPlanPanel
                    roadmap={{ gap_skills: [], active_prep_job_id: String(activePrep.job_id), active_prep_job_title: activePrep.job_title, active_prep_job_company: activePrep.company_name } as any}
                    activeJobId={String(activePrep.job_id)}
                    activeJobTitle={activePrep.job_title}
                    activeCompany={activePrep.company_name}
                  />
                </div>
              </div>
            )}

            {!roadmapLoading && !prepLoading && !roadmap && !activePrep && <GeneratePrompt />}

            {roadmap && roadmap.stages.map(stage => (
              <StageCard
                key={stage.stage_number}
                stage={stage}
                roadmap={roadmap}
                isExpanded={expandedStage === stage.stage_number}
                onToggle={() => toggleStage(stage.stage_number)}
              />
            ))}
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 76 }}>

            {/* Top Skills to Build */}
            {roadmap && roadmap.gap_skills.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' }}>
                <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={12} color="white" />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: 'white', margin: 0 }}>Skills to Build</p>
                  </div>
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {roadmap.gap_skills.slice(0, 8).map((skill, i) => (
                    <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: '#FAF7F1', border: '1px solid #F1EAE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#15130F', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, flex: 1 }}>{skill}</span>
                    </div>
                  ))}
                  {roadmap.gap_skills.length > 8 && (
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>+{roadmap.gap_skills.length - 8} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Cohort signals */}
            {cohortData?.signals && cohortData.signals.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, padding: '18px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Users size={12} color="#15130F" />
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', margin: 0 }}>This Week in Your Cohort</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cohortData.signals.map((signal, i) => (
                    <p key={i} style={{
                      fontSize: 11, color: signal.count > 0 ? '#15130F' : '#94A3B8',
                      lineHeight: 1.5, margin: 0, paddingLeft: 10,
                      borderLeft: `2.5px solid ${signal.count > 0 ? '#15130F' : '#E5E7EB'}`,
                    }}>
                      {signal.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Career Coach CTA */}
            <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 4px 16px rgba(15,23,42,0.05)' }}>
              <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', padding: '16px 18px' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'white', margin: 0 }}>Stuck on your job search?</p>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, marginBottom: 12 }}>
                  Get tactical career coaching from DISHA — resume strategy, interview prep, networking plays.
                </p>
                <a href="/app/counsellor" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '9px 14px', borderRadius: 10,
                  background: '#3B82F6', color: 'white',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.28)',
                }}>
                  Start Career Coaching →
                </a>
              </div>
            </div>

          </div>
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
