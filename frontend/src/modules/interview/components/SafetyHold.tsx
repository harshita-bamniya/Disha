import { useNavigate } from 'react-router-dom'
import type { Helpline } from '@/api/interview'
import InterviewShell from './InterviewShell'

/** Shown instead of the interview when a crisis signal halts it. Nothing from
 *  the halted session is scored or shared. */
export default function SafetyHold({ message, helplines }: { message: string; helplines: Helpline[] }) {
  const navigate = useNavigate()
  return (
    <InterviewShell narrow>
      <h1 className="iv-h1">We've stopped this interview</h1>
      <p className="iv-sub">{message}</p>
      <section className="iv-panel" aria-label="Support helplines">
        <h2 className="iv-panel-title">You can talk to someone right now</h2>
        <ul className="iv-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {helplines.map(h => (
            <li key={h.name}><strong>{h.name}:</strong> {h.contact}</li>
          ))}
        </ul>
      </section>
      <div className="iv-controls">
        <button className="iv-btn iv-btn-sm" onClick={() => navigate('/app/counsellor')}>Talk to your AI counsellor</button>
        <button className="iv-btn iv-btn-quiet" onClick={() => navigate('/app/dashboard')}>Back to dashboard</button>
      </div>
      <p className="iv-fineprint">This was not scored and nothing from it will be shared.</p>
    </InterviewShell>
  )
}
