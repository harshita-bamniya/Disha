import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import InterviewShell from '../components/InterviewShell'
import { DURATIONS, loadDraft, saveDraft } from '../lib/draft'

const GUIDELINES = [
  'Find a quiet, well-lit space with stable internet',
  'Use earphones for better audio quality',
  'Sit upright with your face clearly visible',
  'Give detailed responses for a better evaluation',
]

export default function InterviewInstructionsPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const [agreed, setAgreed] = useState(draft?.consent ?? false)
  const [saveAudio, setSaveAudio] = useState(draft?.saveAudio ?? false)
  const [shareAgreed, setShareAgreed] = useState(draft?.shareWithEmployer ?? false)
  const verifiedMode = !!draft?.invitationId

  useEffect(() => {
    if (!draft) navigate('/app/interview/setup', { replace: true })
  }, [draft, navigate])

  if (!draft) return null
  const duration = DURATIONS[draft.duration]
  const minutes = draft.verifiedMinutes ?? duration.minutes

  const next = () => {
    saveDraft({ ...draft, consent: true, saveAudio, shareWithEmployer: verifiedMode ? shareAgreed : false })
    navigate('/app/interview/check')
  }

  return (
    <InterviewShell narrow>
      <button className="iv-back" onClick={() => navigate('/app/interview/setup')}>
        <ArrowLeft size={18} aria-hidden /> Go back
      </button>

      <h1 className="iv-h1">Welcome to your AI Mock Interview</h1>
      <p className="iv-sub">
        This is just like a standard interview where the interviewer will ask you a few questions about {draft.role}.
      </p>

      <section className="iv-panel">
        <p style={{ margin: '0 0 20px', fontSize: 16 }}>
          <strong>Duration:</strong> about {minutes} minutes{verifiedMode ? '' : ` (${duration.questionRange})`}
        </p>
        <h2 className="iv-panel-title">Guidelines:</h2>
        <ul className="iv-list">
          {GUIDELINES.map(g => <li key={g}>{g}</li>)}
        </ul>
      </section>

      <label className="iv-checkbox">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        <span>I will attempt this interview on my own, without reading answers or getting help from others.</span>
      </label>

      {verifiedMode && (
        <label className="iv-checkbox" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={shareAgreed} onChange={e => setShareAgreed(e.target.checked)} />
          <span>
            I agree that {draft.employerName ?? 'the employer'} can see my answers, transcript and scorecard for 180 days.
            I can withdraw this at any time, and I can ask for a human review of my score.
          </span>
        </label>
      )}

      <label className="iv-checkbox" style={{ marginTop: 0 }}>
        <input type="checkbox" checked={saveAudio} onChange={e => setSaveAudio(e.target.checked)} />
        <span>
          {verifiedMode
            ? `Optional: let ${draft.employerName ?? 'the employer'} replay a recording of my spoken answers. I can withdraw access any time.`
            : 'Optional: keep a recording of my spoken answers for 30 days so I can replay them. It is private to me, and I can delete it any time by deleting the interview.'}
        </span>
      </label>

      <button className="iv-btn iv-btn-sm" disabled={!agreed || (verifiedMode && !shareAgreed)} onClick={next}>I'm ready to continue</button>

      <p className="iv-fineprint">
        {verifiedMode
          ? 'This interview is one attempt. By continuing, you agree that your answers are processed by an AI service to score them. A person makes every hiring decision.'
          : 'This is practice and stays in your account. By continuing, you agree that your answers are processed by an AI service to generate your feedback and report.'}
      </p>
    </InterviewShell>
  )
}
