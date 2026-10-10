import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { DECISION_REASONS, employerVerifiedApi, type Scorecard, type ScorecardAnswer } from '@/api/verifiedInterview'
import PageHeader from '@/shared/layouts/PageHeader'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { colors } from '@/design-system/tokens'

const { text, surface, state, border } = colors

const BAND_BADGE: Record<string, 'green' | 'blue' | 'amber' | 'gray'> = {
  'Strong fit': 'green', 'Good fit': 'blue', 'Developing': 'amber', 'Not yet a fit': 'gray', 'Needs human review': 'amber', 'Incomplete': 'amber',
}

const body: React.CSSProperties = { fontSize: 13, color: text.inkSoft, lineHeight: 1.6, margin: 0 }
const heading: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 12px' }
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><Card padding={20}><h2 style={heading}>{title}</h2>{children}</Card></div>
}

function List({ items }: { items: string[] }) {
  return <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((s, i) => <li key={i} style={body}>{s}</li>)}</ul>
}

function ms(t: number) {
  return `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}`
}

function AnswerRow({ a, index }: { a: ScorecardAnswer; index: number }) {
  const [open, setOpen] = useState(false)
  const score = a.overall_score
  return (
    <div style={{ borderTop: index === 0 ? 'none' : `1px solid ${border.default}` }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '12px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: text.ink }}>{index + 1}. {a.question}</span>
        {a.skill && <Badge color="gray">{a.skill}</Badge>}
        {a.scoring_passes_disagreed && <Badge color="amber">Scoring passes differed</Badge>}
        <span style={{ fontSize: 14, fontWeight: 700, color: a.is_unscored ? text.muted : text.ink }}>{a.is_unscored ? 'Not scored' : `${score ?? '–'}/10`}</span>
        {open ? <ChevronUp size={14} color={text.muted} aria-hidden /> : <ChevronDown size={14} color={text.muted} aria-hidden />}
      </button>
      {open && (
        <div style={{ paddingBottom: 14 }}>
          <div style={eyebrow}>Candidate's answer</div>
          <p style={{ ...body, background: surface.bg, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>{a.answer}</p>
          {a.evidence_quote && (<><div style={eyebrow}>Evidence for the score</div><p style={{ ...body, fontStyle: 'italic', marginBottom: 10 }}>"{a.evidence_quote}"</p></>)}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {Object.entries(a.scores).map(([k, v]) => (
              <div key={k}><div style={{ fontSize: 16, fontWeight: 700, color: text.ink }}>{v ?? '–'}</div><div style={{ fontSize: 11, color: text.muted, textTransform: 'capitalize' }}>{k}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Recording({ invitationId }: { invitationId: string }) {
  const { data: files } = useQuery({ queryKey: ['verified-audio', invitationId], queryFn: () => employerVerifiedApi.listAudio(invitationId) })
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls])
  if (!files || files.length === 0) return null

  const load = async (name: string) => {
    const blob = await employerVerifiedApi.getAudioBlob(invitationId, name)
    setUrls(u => ({ ...u, [name]: URL.createObjectURL(blob) }))
  }
  return (
    <Block title="Recording">
      <p style={{ ...body, marginBottom: 10 }}>The candidate agreed to let you replay their spoken answers.</p>
      {files.map((name, i) => (
        <div key={name} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: text.muted, width: 70 }}>Answer {i + 1}</span>
          {urls[name] ? <audio controls src={urls[name]} /> : <Button size="sm" variant="outline" onClick={() => void load(name)}>Load</Button>}
        </div>
      ))}
    </Block>
  )
}

function DecisionForm({ invitationId, current }: { invitationId: string; current: Scorecard['decision'] }) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'shortlist' | 'hold' | 'decline' | ''>(current?.decision ?? '')
  const [reason, setReason] = useState(current?.reason_code ?? '')
  const [note, setNote] = useState(current?.note ?? '')
  const save = useMutation({
    mutationFn: () => employerVerifiedApi.decide(invitationId, { decision: decision as 'shortlist', reason_code: reason, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verified-result', invitationId] })
      queryClient.invalidateQueries({ queryKey: ['verified-invitations'] })
    },
  })
  return (
    <Block title="Your decision">
      <p style={{ ...body, marginBottom: 12 }}>The scorecard supports your judgement. The decision is yours.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }} role="radiogroup" aria-label="Decision">
        {(['shortlist', 'hold', 'decline'] as const).map(d => (
          <Button key={d} size="sm" variant={decision === d ? 'primary' : 'outline'} onClick={() => setDecision(d)}>
            {d === 'shortlist' ? 'Shortlist' : d === 'hold' ? 'Hold' : 'Decline'}
          </Button>
        ))}
      </div>
      <label htmlFor="d-reason" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text.inkSoft, marginBottom: 6 }}>Reason</label>
      <select id="d-reason" value={reason} onChange={e => setReason(e.target.value)}
        style={{ width: '100%', maxWidth: 340, padding: '8px 10px', border: `1px solid ${border.medium}`, borderRadius: 7, fontSize: 13, marginBottom: 12 }}>
        <option value="" disabled>Choose a reason</option>
        {DECISION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea aria-label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Note (optional)"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 60, padding: 10, border: `1px solid ${border.medium}`, borderRadius: 7, fontSize: 13, fontFamily: 'inherit', marginBottom: 12 }} />
      <Button size="sm" disabled={!decision || !reason || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save decision'}</Button>
      {save.isSuccess && <span role="status" style={{ marginLeft: 10, fontSize: 12, color: state.success }}>Saved</span>}
      {save.isError && <span role="alert" style={{ marginLeft: 10, fontSize: 12, color: state.danger }}>Couldn't save. Please try again.</span>}
    </Block>
  )
}

export default function VerifiedInterviewResultPage() {
  const { invitationId } = useParams<{ invitationId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['verified-result', invitationId],
    queryFn: () => employerVerifiedApi.getResult(invitationId!),
    enabled: !!invitationId,
    retry: false,
  })

  if (isLoading) return <Spinner centered />
  if (error || !data) {
    const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail
    return (
      <div style={{ padding: 28 }}>
        <ErrorState title="This result isn't available" description={typeof detail === 'string' ? detail : 'This result could not be loaded.'} onRetry={() => void refetch()} />
        <div style={{ marginTop: 12 }}><Button size="sm" variant="outline" onClick={() => navigate('/app/employer/verified-interviews')}>Back to AI interviews</Button></div>
      </div>
    )
  }

  const skills = data.competencies.filter(c => data.skill_scores[c.skill] !== undefined)
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title={data.candidate_name}
        subtitle={`${data.role} · interviewed in ${data.language}`}
        back={<button onClick={() => navigate('/app/employer/verified-interviews')} aria-label="Back to AI interviews"
          style={{ width: 30, height: 30, borderRadius: '50%', background: surface.elevated, border: 'none', cursor: 'pointer', color: text.inkSoft }}>←</button>}
      />
      <div style={{ padding: '20px 28px 40px', maxWidth: 900 }}>
        <Block title="Overview">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 800, color: text.ink, lineHeight: 1 }}>{data.overall_score !== null ? Math.round(data.overall_score) : '–'}<span style={{ fontSize: 16, color: text.muted }}>/100</span></div>
              <div style={{ fontSize: 12, color: text.muted, marginTop: 4 }}>Overall, computed from the individual answers</div>
            </div>
            {data.fit_band && <Badge color={BAND_BADGE[data.fit_band] ?? 'gray'}>{data.fit_band}</Badge>}
            {data.questions_planned != null && (
              <span style={{ fontSize: 12, color: text.muted }}>Answered {data.questions_answered ?? 0} of {data.questions_planned} planned questions</span>
            )}
          </div>
          {data.needs_human_review && (
            <p style={{ ...body, background: colors.state.warningBg, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <strong>Needs human review.</strong> {data.review_reasons.join(' ')} Please treat the band as an estimate and read the answers below.
            </p>
          )}
          {data.summary && <p style={body}>{data.summary}</p>}
          <p style={{ ...body, fontSize: 12, color: text.muted, marginTop: 10 }}>
            Shared with you until {new Date(data.shared_until).toLocaleDateString()}. The candidate can withdraw access at any time.
          </p>
        </Block>

        {skills.length > 0 && (
          <Block title="By competency">
            {skills.map(c => {
              const score = data.skill_scores[c.skill]
              return (
                <div key={c.skill} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: text.ink, fontWeight: 600 }}>{c.skill}</span><span style={{ color: text.inkSoft }}>{Math.round(score)}/100</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: surface.elevated }} role="img" aria-label={`${c.skill}: ${Math.round(score)} out of 100`}>
                    <div style={{ width: `${score}%`, height: '100%', borderRadius: 6, background: colors.state.info }} />
                  </div>
                </div>
              )
            })}
          </Block>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {data.strengths.length > 0 && <Block title="Strengths"><List items={data.strengths} /></Block>}
          {data.areas_to_probe.length > 0 && <Block title="Worth probing in a follow-up"><List items={data.areas_to_probe} /></Block>}
        </div>

        <Block title="Answers and evidence">
          {data.answers.map((a, i) => <AnswerRow key={i} a={a} index={i} />)}
        </Block>

        <Block title="Integrity observations">
          {data.integrity_observations.length === 0 ? (
            <p style={body}>Nothing was noted.</p>
          ) : (
            <>
              <p style={{ ...body, marginBottom: 8 }}>Observations only. They are not scored and say nothing about intent. The candidate can see this list too.</p>
              <List items={data.integrity_observations.map(o => `${o.observation} at ${ms(o.from_ms)}${o.to_ms !== null ? ` for ${Math.max(1, Math.round((o.to_ms - o.from_ms) / 1000))}s` : ''}`)} />
            </>
          )}
        </Block>

        {data.recording_available && <Recording invitationId={data.invitation_id} />}
        <DecisionForm invitationId={data.invitation_id} current={data.decision} />
      </div>
    </div>
  )
}
