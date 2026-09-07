import { useRef, useState } from 'react'
import { resumeApi, type ResumeCopilotEvent } from '@/api/resume'
import { Check, Loader2, Sparkles, X } from 'lucide-react'

interface Props {
  resumeId: string
  jobContext: {
    job_title?: string
    company_name?: string
    required_skills?: string[]
    job_description?: string
  }
  onClose: () => void
  onComplete: () => void
}

interface StepLog {
  id: string
  label: string
  done: boolean
}

const SECTION_LABELS: Record<string, string> = {
  summary: 'Professional Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  achievements: 'Achievements',
  projects: 'Projects',
}

export default function ResumeCopilotPanel({ resumeId, jobContext, onClose, onComplete }: Props) {
  const [steps, setSteps] = useState<StepLog[]>([])
  const [question, setQuestion] = useState<{ id: string; question: string } | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answersRef = useRef<Record<string, string>>({})

  const run = async (answers: Record<string, string>) => {
    setRunning(true)
    setQuestion(null)
    setError(null)

    await resumeApi.aiGenerateResumeStream(
      resumeId,
      jobContext,
      answers,
      (event: ResumeCopilotEvent) => {
        if (event.type === 'step') {
          setSteps(prev => [...prev.map(s => ({ ...s, done: true })), { id: `${Date.now()}`, label: event.label, done: false }])
        } else if (event.type === 'question') {
          setSteps(prev => prev.map(s => ({ ...s, done: true })))
          setQuestion({ id: event.id, question: event.question })
        } else if (event.type === 'section_done') {
          setSteps(prev => [
            ...prev.map(s => ({ ...s, done: true })),
            { id: event.section_type, label: `Generated ${SECTION_LABELS[event.section_type] ?? event.label}`, done: true },
          ])
        } else if (event.type === 'complete') {
          setSteps(prev => prev.map(s => ({ ...s, done: true })))
          setFinished(true)
        } else if (event.type === 'error') {
          setError(event.message)
        }
      },
      () => setRunning(false),
      (err) => { setRunning(false); setError(err.message) },
    )
  }

  const submitAnswer = () => {
    if (!question) return
    const text = answerText.trim() || 'skip'
    const key = question.id === 'project_detail' && text.toLowerCase() === 'skip' ? 'project_detail_skip' : question.id
    answersRef.current = { ...answersRef.current, [key]: text }
    setAnswerText('')
    run(answersRef.current)
  }

  if (!running && steps.length === 0 && !question && !finished && !error) {
    // initial kick-off
    run({})
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: 'white', borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
          padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} color="white" />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'white' }}>Resume Co-pilot</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: s.done ? '#0F172A' : '#1A2744', fontWeight: s.done ? 500 : 700 }}>
              {s.done
                ? <Check size={14} color="#16A34A" style={{ flexShrink: 0 }} />
                : <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
              {s.label}
            </div>
          ))}

          {question && (
            <div style={{ marginTop: 6, background: '#F4F5F7', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#0F172A', fontWeight: 600, lineHeight: 1.5 }}>
                {question.question}
              </p>
              <textarea
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }}
                placeholder="Type your answer... (or 'skip')"
                rows={3}
                autoFocus
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={submitAnswer} style={{
                  padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                  color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: 12.5, color: '#DC2626' }}>
              {error}
            </div>
          )}

          {finished && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 12, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
              Resume generated. Review the sections and refine anything that needs a human touch.
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(226,232,240,0.7)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={finished ? onComplete : onClose}
            style={{
              padding: '8px 18px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: finished ? 'none' : '1.5px solid #E2E8F0',
              background: finished ? 'linear-gradient(135deg, #15130F, #1E3A5F)' : 'white',
              color: finished ? 'white' : '#64748B',
            }}
          >
            {finished ? 'View resume' : 'Close'}
          </button>
        </div>
      </div>

    </div>
  )
}
