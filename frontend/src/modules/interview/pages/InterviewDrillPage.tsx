import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Mic, Square } from 'lucide-react'
import {
  interviewApi, type FeedbackItem, type Helpline, type InterviewLanguage, type SessionDetail,
} from '@/api/interview'
import InterviewShell from '../components/InterviewShell'
import SafetyHold from '../components/SafetyHold'
import { useAnswerVoice } from '../hooks/useAnswerVoice'
import { LANGUAGE_OPTIONS } from '../lib/draft'
import { INTERVIEW_ROLES, OTHER_ROLE } from '../lib/roles'

const MIN_ANSWER_CHARS = 30
const LEVELS = ['Internship', 'Fresher', 'Experienced']
const DIMENSIONS: { key: keyof FeedbackItem; label: string }[] = [
  { key: 'clarity_score', label: 'Clarity' },
  { key: 'conciseness_score', label: 'Concise' },
  { key: 'impact_score', label: 'Impact' },
  { key: 'relevance_score', label: 'Relevance' },
  { key: 'star_adherence', label: 'Structure' },
]

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'
}

export default function InterviewDrillPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [roleChoice, setRoleChoice] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [level, setLevel] = useState('Fresher')
  const [language, setLanguage] = useState<InterviewLanguage>('en')
  const [agreed, setAgreed] = useState(false)

  const [drill, setDrill] = useState<SessionDetail | null>(null)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<FeedbackItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [halt, setHalt] = useState<{ message: string; helplines: Helpline[] } | null>(null)
  const startedAt = useRef(Date.now())

  const role = roleChoice === OTHER_ROLE ? customRole.trim() : roleChoice

  const { data: caps } = useQuery({
    queryKey: ['interview-capabilities'], queryFn: interviewApi.getCapabilities, staleTime: Infinity, retry: false,
  })
  const { data: eligibility } = useQuery({
    queryKey: ['interview-eligibility'], queryFn: interviewApi.getEligibility,
  })
  const remaining = eligibility?.drills.remaining

  const voice = useAnswerVoice({
    sessionId: drill?.id ?? '',
    language: drill?.language ?? language,
    serverStt: !!caps?.server_stt,
    setAnswer,
    onError: setNotice,
  })

  const startMutation = useMutation({
    mutationFn: (repeatOf?: string) => interviewApi.createDrill({
      job_role: role || drill?.job_role || '',
      experience_level: level,
      language,
      repeat_of: repeatOf,
      consents: ['ai_processing', 'own_effort'],
    }),
    onSuccess: (created) => {
      setDrill(created)
      setAnswer('')
      setFeedback(null)
      setNotice(null)
      startedAt.current = Date.now()
      queryClient.invalidateQueries({ queryKey: ['interview-eligibility'] })
      queryClient.invalidateQueries({ queryKey: ['interview-sessions'] })
    },
  })

  const answerMutation = useMutation({
    mutationFn: () => interviewApi.answerDrill(drill!.id, {
      response_text: answer.trim(),
      response_time_sec: Math.round((Date.now() - startedAt.current) / 1000),
    }),
    onSuccess: (result) => {
      voice.stop()
      if (result.safety_hold) {
        setHalt({ message: result.message ?? '', helplines: result.helplines ?? [] })
        return
      }
      setNotice(result.distress ? (result.message ?? null) : null)
      setFeedback(result.feedback?.feedback_items?.[0] ?? null)
      queryClient.invalidateQueries({ queryKey: ['interview-performance'] })
    },
  })

  if (halt) return <SafetyHold message={halt.message} helplines={halt.helplines} />

  const question = drill?.questions?.[0]
  const canStart = role.length >= 2 && agreed && !startMutation.isPending
  const canSubmit = answer.trim().length >= MIN_ANSWER_CHARS && !answerMutation.isPending && !voice.transcribing

  // ── 1. Setup ────────────────────────────────────────────────────────────────
  if (!drill) {
    return (
      <InterviewShell narrow>
        <button className="iv-back" onClick={() => navigate(-1)}><ArrowLeft size={18} aria-hidden /> Go back</button>
        <h1 className="iv-h1">Quick drill</h1>
        <p className="iv-sub">
          One question, one answer, instant feedback, then try again. A fast way to sharpen a single answer.
          {remaining !== undefined && <> You have {remaining} drill{remaining === 1 ? '' : 's'} left today.</>}
        </p>

        <section className="iv-panel">
          <label className="iv-eyebrow" htmlFor="drill-role">Role</label>
          <select id="drill-role" className="iv-field" value={roleChoice} onChange={e => setRoleChoice(e.target.value)}>
            <option value="" disabled>Select a role</option>
            {INTERVIEW_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            <option value={OTHER_ROLE}>Other (type your own)</option>
          </select>
          {roleChoice === OTHER_ROLE && (
            <input className="iv-field" style={{ marginTop: 12 }} value={customRole} maxLength={120}
              onChange={e => setCustomRole(e.target.value)} placeholder="e.g. NGO Programme Officer" aria-label="Your role" />
          )}

          <div className="iv-grid-2" style={{ marginTop: 20 }}>
            <div>
              <label className="iv-eyebrow" htmlFor="drill-level">Experience level</label>
              <select id="drill-level" className="iv-field" value={level} onChange={e => setLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="iv-eyebrow" htmlFor="drill-language">Language</label>
              <select id="drill-language" className="iv-field" value={language} onChange={e => setLanguage(e.target.value as InterviewLanguage)}>
                {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        <label className="iv-checkbox" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>I agree that my answer is processed by an AI service to give me feedback.</span>
        </label>

        <button className="iv-btn" disabled={!canStart} onClick={() => startMutation.mutate(undefined)}>
          {startMutation.isPending ? <><Loader2 size={18} className="iv-spin" aria-hidden /> Preparing your question…</> : 'Start drill'}
        </button>
        {startMutation.isError && <p className="iv-error" role="alert">{errorMessage(startMutation.error)}</p>}
      </InterviewShell>
    )
  }

  // ── 3. Feedback ─────────────────────────────────────────────────────────────
  if (feedback || answerMutation.isSuccess) {
    return (
      <InterviewShell narrow>
        <h1 className="iv-h1">Your feedback</h1>
        <p className="iv-sub">{question?.question_text}</p>
        {notice && <div className="iv-banner" role="status">{notice}</div>}

        {!feedback || feedback.is_fallback ? (
          <section className="iv-panel">
            <p className="iv-body">We couldn't score this answer right now. That is a technical problem, not a reflection on your answer. Please try the drill again.</p>
          </section>
        ) : (
          <>
            <section className="iv-panel">
              <div style={{ fontSize: 40, fontWeight: 800 }}>{feedback.overall_score ?? '–'}<span className="iv-muted" style={{ fontSize: 18 }}>/10</span></div>
              <div className="iv-grid-3" style={{ marginTop: 16 }}>
                {DIMENSIONS.map(d => (
                  <div key={d.key}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{(feedback[d.key] as number | null) ?? '–'}</div>
                    <div className="iv-option-line">{d.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {feedback.strengths.length > 0 && (
              <section className="iv-panel">
                <h2 className="iv-panel-title">What worked</h2>
                <ul className="iv-list">{feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </section>
            )}
            {feedback.improvements.length > 0 && (
              <section className="iv-panel">
                <h2 className="iv-panel-title">To build next</h2>
                <ul className="iv-list">{feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </section>
            )}
            {feedback.rewritten_answer && (
              <section className="iv-panel">
                <h2 className="iv-panel-title">A stronger version of your answer</h2>
                <p className="iv-body" style={{ color: 'var(--iv-text)' }}>{feedback.rewritten_answer}</p>
              </section>
            )}
          </>
        )}

        <div className="iv-controls">
          <button className="iv-btn iv-btn-sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate(drill.id)}>
            {startMutation.isPending ? <Loader2 size={16} className="iv-spin" aria-hidden /> : 'Try this question again'}
          </button>
          <button className="iv-btn iv-btn-quiet" disabled={startMutation.isPending} onClick={() => startMutation.mutate(undefined)}>New question</button>
          <span className="iv-spacer" />
          <button className="iv-link-btn" onClick={() => navigate('/app/interview/history')}>Back to my interviews</button>
        </div>
        {startMutation.isError && <p className="iv-error" role="alert">{errorMessage(startMutation.error)}</p>}
      </InterviewShell>
    )
  }

  // ── 2. Answering ────────────────────────────────────────────────────────────
  return (
    <InterviewShell narrow>
      <button className="iv-back" onClick={() => { voice.stop(); setDrill(null) }}><ArrowLeft size={18} aria-hidden /> Back</button>
      <p className="iv-eyebrow">
        {drill.job_role}{(drill.blueprint as { _drill_skill?: string } | null)?._drill_skill ? ` · ${(drill.blueprint as { _drill_skill?: string })._drill_skill}` : ''}
      </p>
      <section className="iv-transcript" aria-live="polite" style={{ marginTop: 0 }}>
        <span className="iv-tag">Question</span>
        <p className="iv-transcript-text">{question?.question_text}</p>
      </section>
      {notice && <div className="iv-banner" role="status" style={{ marginTop: 16 }}>{notice}</div>}

      <section className="iv-transcript" aria-live="polite" style={{ marginTop: 16 }}>
        <span className="iv-tag">Your answer</span>
        <p className="iv-transcript-text">
          {voice.transcribing ? 'Transcribing your answer…'
            : answer.trim() ? answer.trim()
            : voice.supported ? 'Tap the microphone and speak your answer.' : ''}
        </p>
      </section>
      {!voice.supported && (
        <p className="iv-fineprint" role="alert">This is voice only, and voice input isn't supported in this browser. Please open it in Chrome or Edge.</p>
      )}
      {answer.trim() && !voice.listening && !voice.transcribing && !answerMutation.isPending && (
        <button className="iv-link-btn" style={{ marginTop: 8 }} onClick={() => setAnswer('')}>Clear and record again</button>
      )}

      <div className="iv-controls">
        {voice.supported && (
          <button
            className="iv-icon-btn"
            aria-pressed={voice.listening}
            aria-label={voice.listening ? 'Stop recording' : 'Start recording your answer'}
            disabled={answerMutation.isPending || voice.transcribing}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
          >
            {voice.listening ? <Square size={16} fill="currentColor" aria-hidden /> : <Mic size={18} aria-hidden />}
          </button>
        )}
        <button className="iv-btn iv-btn-sm" disabled={!canSubmit} onClick={() => answerMutation.mutate()}>
          {answerMutation.isPending ? <><Loader2 size={16} className="iv-spin" aria-hidden /> Scoring…</> : 'Get feedback'}
        </button>
        <span className="iv-spacer" />
        <button className="iv-link-btn" disabled={startMutation.isPending} onClick={() => startMutation.mutate(undefined)}>Skip to a new question</button>
      </div>
      {answerMutation.isError && <p className="iv-error" role="alert">{errorMessage(answerMutation.error)}</p>}
    </InterviewShell>
  )
}
