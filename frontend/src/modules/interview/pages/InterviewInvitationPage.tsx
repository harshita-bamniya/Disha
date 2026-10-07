import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { interviewApi } from '@/api/interview'
import { verifiedApi } from '@/api/verifiedInterview'
import InterviewShell from '../components/InterviewShell'
import { saveDraft } from '../lib/draft'

const LANGUAGE_LABEL: Record<string, string> = { en: 'English', hi: 'Hindi', hinglish: 'Hinglish' }
const SUGGESTED_PRACTICE = 3

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InterviewInvitationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: inv, isLoading, isError } = useQuery({
    queryKey: ['interview-invitation', id],
    queryFn: () => verifiedApi.getMyInvitation(id!),
    enabled: !!id,
  })
  const { data: performance } = useQuery({ queryKey: ['interview-performance'], queryFn: interviewApi.getPerformance })

  const declineMutation = useMutation({
    mutationFn: () => verifiedApi.declineInvitation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-invitation', id] })
      queryClient.invalidateQueries({ queryKey: ['interview-invitations'] })
    },
  })

  if (isLoading) {
    return <InterviewShell narrow><p className="iv-muted" role="status">Loading your invitation…</p></InterviewShell>
  }
  if (isError || !inv) {
    return (
      <InterviewShell narrow>
        <h1 className="iv-h1">Invitation not found</h1>
        <p className="iv-sub">This link may be wrong, or the invitation may have been withdrawn.</p>
        <button className="iv-btn iv-btn-quiet" onClick={() => navigate('/app/interview/history')}>Back to my interviews</button>
      </InterviewShell>
    )
  }

  const practiced = performance?.completed_sessions ?? 0
  const canStart = inv.status === 'invited' || inv.status === 'started'

  const begin = () => {
    saveDraft({
      role: inv.role,
      level: 'Experienced',
      duration: inv.duration_minutes <= 10 ? 'quick' : 'indepth',
      jobDesc: '',
      consent: false,
      language: inv.language,
      saveAudio: false,
      invitationId: inv.id,
      employerName: inv.employer_name,
      verifiedMinutes: inv.duration_minutes,
    })
    navigate('/app/interview/instructions')
  }

  return (
    <InterviewShell narrow>
      <button className="iv-back" onClick={() => navigate('/app/interview/history')}>
        <ArrowLeft size={18} aria-hidden /> My interviews
      </button>

      <p className="iv-eyebrow">{inv.employer_name}</p>
      <h1 className="iv-h1">{inv.title}</h1>
      <p className="iv-sub">{inv.role} · about {inv.duration_minutes} minutes · in {LANGUAGE_LABEL[inv.language] ?? inv.language}</p>

      {inv.status === 'expired' && <div className="iv-banner" role="status">This invitation expired on {formatDate(inv.expires_at)}.</div>}
      {inv.status === 'declined' && <div className="iv-banner" role="status">You declined this invitation.</div>}
      {inv.status === 'completed' && (
        <div className="iv-banner" role="status">
          <span style={{ flex: 1 }}>You've completed this interview. Each invitation is one attempt.</span>
          {inv.session_id && <Link className="iv-link-btn" to={`/app/interview/report/${inv.session_id}`}>View your scorecard</Link>}
        </div>
      )}

      <section className="iv-panel">
        <h2 className="iv-panel-title">What you'll be assessed on</h2>
        <ul className="iv-list">
          {inv.competencies.map(c => <li key={c}>{c}</li>)}
          <li>How you tell your own career story</li>
          {inv.has_employer_questions && <li>A few questions written by {inv.employer_name}</li>}
        </ul>
        <p className="iv-fineprint">The questions themselves aren't shown in advance.</p>
      </section>

      <section className="iv-panel">
        <h2 className="iv-panel-title">Who sees your result, and for how long</h2>
        <ul className="iv-list">
          <li>Only {inv.employer_name} can see your scorecard, answers and transcript, and only if you agree on the next screen.</li>
          <li>They can see it for {inv.retention_days} days. After that the interview is deleted.</li>
          <li>You get the same scorecard they do, and you can withdraw access or ask for a human review at any time.</li>
          <li>Scores come from what you say, never your accent or language. A person makes every hiring decision.</li>
        </ul>
      </section>

      {canStart && practiced < SUGGESTED_PRACTICE && (
        <section className="iv-panel">
          <h2 className="iv-panel-title">Practise first?</h2>
          <p className="iv-body">
            You've completed {practiced} practice interview{practiced === 1 ? '' : 's'}. Most people feel calmer after {SUGGESTED_PRACTICE}.
            This one counts, so there's no harm in warming up. You can still start whenever you're ready.
          </p>
          <p style={{ margin: '12px 0 0' }}><Link className="iv-link-btn" to="/app/interview/setup">Start a practice interview</Link></p>
        </section>
      )}

      {canStart && (
        <>
          <p className="iv-fineprint" style={{ marginBottom: 16 }}>
            This is a single attempt. Open until {formatDate(inv.expires_at)}.{' '}
            {inv.status === 'started' ? 'You already started, so you will pick up where you left off.' : ''}
          </p>
          <div className="iv-controls">
            <button className="iv-btn" onClick={begin}>{inv.status === 'started' ? 'Continue your interview' : 'Continue'}</button>
            {inv.status === 'invited' && (
              <button
                className="iv-btn iv-btn-quiet"
                disabled={declineMutation.isPending}
                onClick={() => { if (window.confirm('Decline this invitation? The employer will see that you declined.')) declineMutation.mutate() }}
              >
                {declineMutation.isPending ? <Loader2 size={16} className="iv-spin" aria-hidden /> : 'Decline'}
              </button>
            )}
          </div>
        </>
      )}
    </InterviewShell>
  )
}
