import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { interviewApi, OUTCOME_OPTIONS, type JobReadinessReport, type FeedbackItem, type SessionFeedback } from '@/api/interview'
import { verifiedApi } from '@/api/verifiedInterview'
import PageHeader from '@/shared/layouts/PageHeader'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import Tabs from '@/shared/components/navigation/Tabs'
import Spinner from '@/shared/components/feedback/Spinner'
import Button from '@/shared/components/primitives/Button'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import { colors } from '@/design-system/tokens'

const { state, text, surface } = colors

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return state.success
  if (s >= 65) return state.info
  if (s >= 50) return state.warning
  return state.danger
}

function scoreLabel(s: number) {
  if (s >= 80) return 'Strong'
  if (s >= 65) return 'Good'
  if (s >= 50) return 'Average'
  return 'Needs work'
}

function itemScoreColor(s: number | null) {
  if (s == null) return text.muted
  if (s >= 8) return state.success
  if (s >= 6) return state.warning
  return state.danger
}

const REC_BADGE: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
  'Strong Hire': 'green', 'Hire': 'blue', 'Maybe': 'amber', 'No Hire': 'amber',
}

// Hiring decisions are made by people, so a practice report shows a fit label, never "Hire / No Hire".
const FIT_LABEL: Record<string, string> = {
  'Strong Hire': 'Strong fit', 'Hire': 'Good fit', 'Maybe': 'Developing', 'No Hire': 'Not yet a fit',
}
const fitLabel = (rec: string) => FIT_LABEL[rec] ?? rec

const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 14px' }
const smallLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }
const bodyText: CSSProperties = { fontSize: 13, color: text.inkSoft, lineHeight: 1.6, margin: 0 }

function Section({ title, children, full }: { title: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <Card padding={22}>
        <h2 style={sectionTitle}>{title}</h2>
        {children}
      </Card>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((s, i) => <li key={i} style={bodyText}>{s}</li>)}
    </ul>
  )
}

function SkillBar({ skill, score, weight }: { skill: string; score: number; weight?: number }) {
  const c = scoreColor(score)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
        <span style={{ fontSize: 13, color: text.ink, fontWeight: 600 }}>
          {skill}{weight ? <span style={{ fontSize: 11, color: text.muted, fontWeight: 500 }}> · {weight}% weight</span> : null}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{scoreLabel(score)} · {score}%</span>
      </div>
      <div style={{ height: 6, background: surface.elevated, borderRadius: 6 }} role="img" aria-label={`${skill}: ${score} percent`}>
        <div style={{ width: `${score}%`, height: '100%', background: c, borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ── Per-question feedback ─────────────────────────────────────────────────────

// The career-transition story is scored on its own five criteria, returned
// through the same fields as an ordinary answer, so it is relabelled here.
const TRANSITION_SKILL = 'Career transition story'

const ORDINARY_DIMS = [
  { key: 'clarity_score', label: 'Clarity' },
  { key: 'conciseness_score', label: 'Concise' },
  { key: 'impact_score', label: 'Impact' },
  { key: 'relevance_score', label: 'Relevance' },
  { key: 'star_adherence', label: 'Structure' },
] as const

const TRANSITION_DIMS = [
  { key: 'clarity_score', label: 'Ownership' },
  { key: 'impact_score', label: 'Evidence' },
  { key: 'relevance_score', label: 'Bridge to role' },
  { key: 'star_adherence', label: 'Commitment' },
  { key: 'conciseness_score', label: 'Brevity' },
] as const

function FeedbackCard({ item, index }: { item: FeedbackItem; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const dims = item.skill_assessed === TRANSITION_SKILL ? TRANSITION_DIMS : ORDINARY_DIMS

  return (
    <div style={{ marginBottom: 10 }}>
      <Card padding={0}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: text.muted, width: 20 }}>{index + 1}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, color: text.ink, fontWeight: 600, lineHeight: 1.4 }}>{item.question_text ?? `Question ${index + 1}`}</span>
            <span style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {item.question_type && <Badge color="gray">{item.question_type}</Badge>}
              {item.skill_assessed && <Badge color="gray">{item.skill_assessed}</Badge>}
              {item.is_fallback && <Badge color="amber">AI scoring unavailable</Badge>}
            </span>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: itemScoreColor(item.overall_score) }}>
            {item.overall_score?.toFixed(1) ?? '—'}<span style={{ fontSize: 11, fontWeight: 400, color: text.muted }}>/10</span>
          </span>
          {open ? <ChevronUp size={14} color={text.muted} aria-hidden /> : <ChevronDown size={14} color={text.muted} aria-hidden />}
        </button>

        {open && (
          <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${colors.border.default}` }}>
            <div style={{ display: 'flex', gap: 16, padding: '14px 0', flexWrap: 'wrap' }}>
              {dims.map(({ key, label }) => {
                const val = item[key] as number | null | undefined
                return (
                  <div key={key} style={{ minWidth: 56 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: itemScoreColor(val ?? null) }}>{val ?? '—'}</div>
                    <div style={{ fontSize: 11, color: text.muted }}>{label}</div>
                  </div>
                )
              })}
            </div>

            {item.judge_disagreement_note && (
              <div style={{ background: state.warningBg, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={smallLabel}>Scoring confidence</div>
                <p style={bodyText}>{item.judge_disagreement_note}</p>
              </div>
            )}

            {item.evidence_quote && (
              <div style={{ marginBottom: 12 }}>
                <div style={smallLabel}>What earned this score</div>
                <p style={{ ...bodyText, fontStyle: 'italic' }}>"{item.evidence_quote}"</p>
              </div>
            )}

            {item.original_response && (
              <div style={{ background: surface.bg, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={smallLabel}>Your answer</div>
                <p style={bodyText}>{item.original_response}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: item.rewritten_answer ? 14 : 0 }}>
              {item.strengths?.length > 0 && (<div><div style={smallLabel}>Strengths</div><BulletList items={item.strengths} /></div>)}
              {item.improvements?.length > 0 && (<div><div style={smallLabel}>To improve</div><BulletList items={item.improvements} /></div>)}
            </div>

            {item.rewritten_answer && (
              <div style={{ background: surface.bg, borderRadius: 8, padding: '12px 14px' }}>
                <div style={smallLabel}>Model answer</div>
                <p style={{ ...bodyText, color: text.ink }}>{item.rewritten_answer}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

function RoadmapList({ steps }: { steps: JobReadinessReport['roadmap'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((step, i) => (
        <Card key={i} padding={16}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: text.muted, fontWeight: 600 }}>{step.week_range}</span>
            <Badge color="gray">{step.resource_type}</Badge>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: text.ink, marginBottom: 4 }}>{step.focus}</div>
          <p style={bodyText}>{step.action}</p>
        </Card>
      ))}
    </div>
  )
}

function PracticeNextCard({ skills, navigate }: { skills: string[]; navigate: (path: string) => void }) {
  return (
    <Section title="Practice before your next interview" full>
      <p style={{ ...bodyText, marginBottom: 12 }}>
        These came up weakest across your interviews so far. Your next mock interview will lean into them.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {skills.map(skill => <Badge key={skill} color="gray">{skill}</Badge>)}
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/app/roadmap')}>View your learning plan</Button>
    </Section>
  )
}

// ── Outcome survey ────────────────────────────────────────────────────────────

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
      <Card padding={16}>
        <span style={{ fontSize: 13, color: text.inkSoft }}>Thanks for letting us know. You reported: <strong>{label}</strong></span>
      </Card>
    )
  }

  return (
    <Card padding={20}>
      <h2 style={sectionTitle}>How did the real interview go?</h2>
      <p style={{ ...bodyText, marginBottom: 12 }}>
        If you've applied for this role, tell us what happened. It helps us check that this score predicts real outcomes.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {OUTCOME_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            size="sm"
            variant={selected === opt.value ? 'primary' : 'outline'}
            disabled={submitMutation.isPending}
            onClick={() => { setSelected(opt.value); submitMutation.mutate(opt.value) }}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </Card>
  )
}

// ── Verified interview: who can see this, what was observed, appeals ────────────

function VerifiedPanel({ sessionId, band }: { sessionId: string; band: string | null | undefined }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const { data: observations } = useQuery({
    queryKey: ['integrity-events', sessionId], queryFn: () => verifiedApi.getIntegrityEvents(sessionId),
  })
  const { data: appeals } = useQuery({
    queryKey: ['interview-appeals', sessionId], queryFn: () => verifiedApi.getAppeals(sessionId),
  })
  const revokeMutation = useMutation({ mutationFn: () => verifiedApi.revokeShare(sessionId) })
  const appealMutation = useMutation({
    mutationFn: () => verifiedApi.fileAppeal(sessionId, reason.trim()),
    onSuccess: () => { setReason(''); queryClient.invalidateQueries({ queryKey: ['interview-appeals', sessionId] }) },
  })
  const hasOpenAppeal = (appeals ?? []).some(a => a.status === 'open')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
      <Section title="Your employer scorecard" full>
        <p style={{ ...bodyText, marginBottom: 10 }}>
          This is the same scorecard the employer sees{band ? <>: <strong>{band}</strong></> : ''}. Only the employer who invited you can
          open it, and a person makes every hiring decision.
        </p>
        {revokeMutation.isSuccess ? (
          <p style={{ ...bodyText, color: text.ink }}>You've withdrawn access. The employer can no longer open this result.</p>
        ) : (
          <Button size="sm" variant="outline" disabled={revokeMutation.isPending}
            onClick={() => { if (window.confirm('Withdraw access? The employer will no longer be able to open your result.')) revokeMutation.mutate() }}>
            {revokeMutation.isPending ? 'Withdrawing…' : 'Withdraw employer access'}
          </Button>
        )}
      </Section>

      <Section title="What was observed during the interview" full>
        {observations && observations.length > 0 ? (
          <>
            <p style={{ ...bodyText, marginBottom: 10 }}>These are observations only. They never change your score.</p>
            <BulletList items={observations.map(o => `${o.observation} (${Math.floor(o.from_ms / 60000)}:${String(Math.floor((o.from_ms % 60000) / 1000)).padStart(2, '0')})`)} />
          </>
        ) : (
          <p style={bodyText}>Nothing was noted.</p>
        )}
      </Section>

      <Section title="Think a score is wrong?" full>
        {(appeals ?? []).map(a => (
          <div key={a.id} style={{ marginBottom: 12 }}>
            <Badge color={a.status === 'open' ? 'amber' : 'green'}>{a.status === 'open' ? 'Under review' : 'Reviewed'}</Badge>
            <p style={{ ...bodyText, margin: '6px 0 0' }}>{a.reason}</p>
            {a.resolution_note && <p style={{ ...bodyText, margin: '6px 0 0', color: text.ink }}>Outcome: {a.resolution_note}</p>}
          </div>
        ))}
        {!hasOpenAppeal && (
          <>
            <p style={{ ...bodyText, marginBottom: 10 }}>You can ask a person to review your result. Tell us what you think was missed.</p>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000}
              placeholder="What would you like reviewed?" aria-label="Reason for your appeal"
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: `1px solid ${colors.border.medium}`, fontFamily: 'inherit', fontSize: 13 }}
            />
            <div style={{ marginTop: 10 }}>
              <Button size="sm" disabled={reason.trim().length < 10 || appealMutation.isPending} onClick={() => appealMutation.mutate()}>
                {appealMutation.isPending ? 'Sending…' : 'Request a human review'}
              </Button>
            </div>
            {appealMutation.isError && <p style={{ ...bodyText, color: state.danger, marginTop: 8 }}>Couldn't send that. Please try again.</p>}
          </>
        )}
      </Section>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'report' | 'answers' | 'roadmap'

const TABS = [
  { key: 'report',  label: 'Job Readiness Report' },
  { key: 'answers', label: 'Answer Feedback' },
  { key: 'roadmap', label: 'Learning Roadmap' },
]

function headline(rec: string) {
  if (rec === 'Strong Hire') return 'Outstanding performance'
  if (rec === 'Hire') return 'Solid interview performance'
  if (rec === 'Maybe') return 'Good progress. Keep building'
  return 'More practice needed. Here is your plan'
}

export default function InterviewReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('report')

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['session-feedback', sessionId],
    queryFn: () => interviewApi.getFeedback(sessionId!),
    enabled: !!sessionId,
    // Grading runs in the background after the interview ends; keep checking
    // until it finishes (or fails).
    refetchInterval: (query) => {
      const status = (query.state.data as SessionFeedback | undefined)?.grading_status
      return status === 'pending' || status === 'running' ? 3000 : false
    },
  })

  const regradeMutation = useMutation({
    mutationFn: () => interviewApi.regradeSession(sessionId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session-feedback', sessionId] }),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => interviewApi.regenerateReport(sessionId!),
    onSuccess: (updated) => queryClient.setQueryData(['session-feedback', sessionId], updated),
  })

  // A drill has answer feedback but no readiness report: open straight to it.
  useEffect(() => {
    if (feedback && feedback.grading_status === 'done' && !feedback.job_readiness_report && feedback.feedback_items.length > 0) {
      setActiveTab('answers')
    }
  }, [feedback])

  if (isLoading) return <Spinner centered />
  if (!feedback) return null

  if (feedback.grading_status === 'pending' || feedback.grading_status === 'running') {
    return (
      <div style={{ maxWidth: 520, margin: '96px auto', padding: '0 28px', textAlign: 'center' }} role="status">
        <Spinner centered />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: text.ink, margin: '16px 0 8px' }}>Preparing your report</h1>
        <p style={bodyText}>We're scoring your answers. This usually takes under a minute, and this page updates by itself.</p>
      </div>
    )
  }

  if (feedback.grading_status === 'failed') {
    return (
      <div style={{ maxWidth: 520, margin: '96px auto', padding: '0 28px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: text.ink, margin: '0 0 8px' }}>We couldn't prepare your report</h1>
        <p style={{ ...bodyText, marginBottom: 16 }}>
          Your answers are saved. This is a technical problem, not a reflection of your performance. Please try again.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button size="sm" onClick={() => regradeMutation.mutate()} disabled={regradeMutation.isPending}>
            {regradeMutation.isPending ? 'Retrying…' : 'Try again'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/interview/history')}>Back to history</Button>
        </div>
        {regradeMutation.isError && <p style={{ ...bodyText, color: state.danger, marginTop: 10 }}>Couldn't restart grading. Please try again in a moment.</p>}
      </div>
    )
  }

  const report = feedback.job_readiness_report
  // A degraded report (the AI call failed after retry) must not render as the
  // candidate's real assessment, so treat report.error the same as "no report".
  const reportErrored = !!report?.error
  const hasReport = !!report && !reportErrored
  const overallAvg = feedback.overall_avg
  const verified = feedback.mode === 'verified'
  const startNew = () => navigate('/app/interview/setup')

  return (
    <>
      <PageHeader
        title={report?.job_role ? `Interview report: ${report.job_role}` : 'Interview report'}
        back={
          <button
            onClick={() => navigate('/app/interview/history')}
            aria-label="Back to interview history"
            style={{ width: 30, height: 30, borderRadius: '50%', background: surface.elevated, border: 'none', cursor: 'pointer', color: text.inkSoft, fontSize: 16, flexShrink: 0 }}
          >←</button>
        }
        below={<Breadcrumb items={[{ label: 'AI Interview', href: '/app/interview/history' }, { label: 'Report' }]} />}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/interview/history')}>All interviews</Button>
            <Button variant="outline" size="sm" onClick={startNew}><RotateCcw size={12} style={{ marginRight: 4 }} aria-hidden /> New interview</Button>
          </div>
        }
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 0' }}>
        <Card padding={24}>
          {hasReport ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 28, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 44, fontWeight: 800, color: scoreColor(report.overall_readiness_score), lineHeight: 1 }}>
                  {Math.round(report.overall_readiness_score)}<span style={{ fontSize: 20 }}>%</span>
                </div>
                <div style={{ fontSize: 13, color: text.muted, margin: '6px 0 10px' }}>Job readiness</div>
                {verified && report.fit_band
                  ? <Badge color="blue">{report.fit_band}</Badge>
                  : <Badge color={REC_BADGE[report.hiring_recommendation] ?? 'gray'}>{fitLabel(report.hiring_recommendation)}</Badge>}
                {report.confidence_note && <p style={{ ...bodyText, fontSize: 12, marginTop: 10 }}>{report.confidence_note}</p>}
                {report.needs_human_review && (
                  <p style={{ ...bodyText, fontSize: 12, marginTop: 10 }}>
                    <strong>Needs human review.</strong> {(report.review_reasons ?? []).join(' ')} Treat this score as an estimate.
                  </p>
                )}
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: text.ink, margin: '0 0 8px' }}>{headline(report.hiring_recommendation)}</h1>
                <p style={{ ...bodyText, marginBottom: 16 }}>{report.readiness_message}</p>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Technical', score: Math.round(report.technical_readiness_score) },
                    { label: 'Communication', score: Math.round(report.communication_score) },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(item.score) }}>{item.score}%</div>
                      <div style={{ fontSize: 12, color: text.muted }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: itemScoreColor(overallAvg), lineHeight: 1 }}>
                {overallAvg.toFixed(1)}<span style={{ fontSize: 18 }}>/10</span>
              </div>
              <p style={{ ...bodyText, marginTop: 8 }}>Average score across {feedback.feedback_items.length} questions.</p>
            </div>
          )}
        </Card>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 28px 0' }}>
        <Tabs tabs={TABS} active={activeTab} onChange={k => setActiveTab(k as TabKey)} />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 28px 40px' }}>
        {verified && <VerifiedPanel sessionId={sessionId!} band={report?.fit_band} />}
        {hasReport && !verified && <div style={{ marginBottom: 20 }}><OutcomeSurveyCard sessionId={sessionId!} reportedOutcome={feedback.reported_outcome} /></div>}

        {activeTab === 'report' && hasReport && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <Section title="Skill breakdown" full>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 32px' }}>
                {report.competencies.map(comp => (
                  <SkillBar key={comp.skill} skill={comp.skill} score={Math.round(report.skill_scores?.[comp.skill] ?? 60)} weight={comp.weight} />
                ))}
              </div>
            </Section>

            <Section title="Key strengths"><BulletList items={report.strengths} /></Section>
            <Section title="Areas to work on"><BulletList items={report.critical_gaps} /></Section>

            {report.delivery && report.delivery.answers > 0 && (
              <Section title="Delivery (for practice only, not scored)" full>
                <p style={{ ...bodyText, marginBottom: 12 }}>
                  Simple signals from the words you used. They never affect your score and say nothing about accent or pronunciation.
                </p>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Average answer length', value: `${report.delivery.avg_words_per_answer} words` },
                    { label: 'Filler words', value: `${report.delivery.filler_per_100_words} per 100 words` },
                    { label: 'Hedging phrases', value: `${report.delivery.hedging_per_100_words} per 100 words` },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: text.ink }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: text.muted }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {report.consistency_notes?.length > 0 && <Section title="Consistency check" full><BulletList items={report.consistency_notes} /></Section>}
            {report.pacing_notes?.length > 0 && <Section title="Pacing" full><BulletList items={report.pacing_notes} /></Section>}
            {report.integrity_notes?.length > 0 && <Section title="Integrity flags" full><BulletList items={report.integrity_notes} /></Section>}

            <Section title="Summary" full>
              <p style={{ ...bodyText, fontSize: 14, fontStyle: 'italic' }}>"{report.candidate_summary}"</p>
            </Section>

            {!verified && (
            <Section title="Overall fit" full>
              <div style={{ marginBottom: 10 }}><Badge color={REC_BADGE[report.hiring_recommendation] ?? 'gray'}>{fitLabel(report.hiring_recommendation)}</Badge></div>
              <p style={bodyText}>{report.hiring_recommendation_reason}</p>
            </Section>
            )}

            {feedback.weak_skills.length > 0 && <PracticeNextCard skills={feedback.weak_skills} navigate={navigate} />}
          </div>
        )}

        {activeTab === 'report' && !hasReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card padding={28}>
              {reportErrored ? (
                <>
                  <h2 style={sectionTitle}>We couldn't generate your Job Readiness Report</h2>
                  <p style={{ ...bodyText, marginBottom: 14 }}>
                    This is a technical failure, not your actual score. The average per-answer score above is real. It is usually temporary, so try again or start a new interview.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button size="sm" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                      {regenerateMutation.isPending ? 'Retrying…' : 'Try again'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={startNew}>Start a new interview</Button>
                  </div>
                  {regenerateMutation.isError && <p style={{ ...bodyText, color: state.danger, marginTop: 10 }}>Still couldn't generate it. Give it a bit longer and try again.</p>}
                </>
              ) : (
                <>
                  <p style={{ ...bodyText, marginBottom: 12 }}>The full Job Readiness Report is only available for role-specific interviews.</p>
                  <Button size="sm" variant="outline" onClick={startNew}>Start a targeted interview</Button>
                </>
              )}
            </Card>
            {feedback.weak_skills.length > 0 && <PracticeNextCard skills={feedback.weak_skills} navigate={navigate} />}
          </div>
        )}

        {activeTab === 'answers' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Card padding={18}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: itemScoreColor(overallAvg) }}>{overallAvg.toFixed(1)}/10</div>
                    <div style={{ fontSize: 12, color: text.muted }}>Overall average</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 120, height: 6, background: surface.elevated, borderRadius: 6 }}>
                    <div style={{ width: `${(overallAvg / 10) * 100}%`, height: '100%', background: itemScoreColor(overallAvg), borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 13, color: text.inkSoft }}>{feedback.feedback_items.length} questions</div>
                </div>
              </Card>
            </div>
            {feedback.feedback_items.map((item, idx) => <FeedbackCard key={item.id} item={item} index={idx} />)}
          </div>
        )}

        {activeTab === 'roadmap' && (
          hasReport && report.roadmap?.length > 0 ? (
            <div>
              <p style={{ ...bodyText, marginBottom: 16 }}>
                Based on the gaps identified in your interview, here is a targeted plan to reach {report.job_role} readiness. Current readiness:{' '}
                <strong style={{ color: scoreColor(report.overall_readiness_score) }}>{Math.round(report.overall_readiness_score)}%</strong>
              </p>
              <RoadmapList steps={report.roadmap} />
            </div>
          ) : (
            <Card padding={28}>
              <p style={{ ...bodyText, marginBottom: 12 }}>A personalised roadmap is generated for role-specific interviews.</p>
              <Button size="sm" variant="outline" onClick={startNew}>Start a targeted interview</Button>
            </Card>
          )
        )}
      </div>
    </>
  )
}
