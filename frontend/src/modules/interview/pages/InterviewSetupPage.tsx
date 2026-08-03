import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import {
  Briefcase, ChevronRight, ChevronLeft, Mic, Wifi,
  CheckCircle, AlertCircle, Clock, Shield, Monitor, User,
  Volume2, Camera, CameraOff, Loader, Sparkles, Target
} from 'lucide-react'

// ── palette ────────────────────────────────────────────────────────────────────
const NAVY     = '#1A2744'
const INK      = '#1E3A5F'
const INK_S    = '#475569'
const MUTED    = '#94A3B8'
const CREAM    = '#F4F5F7'
const CREAM_DK = '#EAECF0'
const BORDER   = 'rgba(0,0,0,0.08)'
const WHITE    = '#fff'

// ── Role catalogue ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'AI Engineer',              icon: '🤖' },
  { value: 'Machine Learning Engineer',icon: '🧠' },
  { value: 'Data Scientist',           icon: '📊' },
  { value: 'Frontend Developer',       icon: '🎨' },
  { value: 'Backend Developer',        icon: '⚙️' },
  { value: 'Full Stack Developer',     icon: '🔧' },
  { value: 'DevOps Engineer',          icon: '🚀' },
  { value: 'Cloud Engineer',           icon: '☁️' },
  { value: 'Product Manager',          icon: '📋' },
  { value: 'UI/UX Designer',           icon: '✏️' },
  { value: 'Cybersecurity Engineer',   icon: '🔒' },
  { value: 'Mobile App Developer',     icon: '📱' },
  { value: 'Business Analyst',         icon: '📈' },
]

const EXPERIENCE_LEVELS = [
  { value: 'Fresher',   label: 'Fresher',   desc: '0–1 year · Student or recent graduate',  icon: '🌱' },
  { value: 'Junior',    label: 'Junior',    desc: '1–3 years · Entry level professional',    icon: '🌿' },
  { value: 'Mid-Level', label: 'Mid-Level', desc: '3–6 years · Independent contributor',     icon: '🌳' },
  { value: 'Senior',    label: 'Senior',    desc: '6+ years · Leads & mentors others',       icon: '🌲' },
]

const SESSION_SIZES = [
  { value: 5,  label: 'Quick Round', desc: '~15 min', icon: '⚡' },
  { value: 8,  label: 'Standard',    desc: '~25 min', icon: '🎯' },
  { value: 12, label: 'Deep Dive',   desc: '~40 min', icon: '🔬' },
]

// ── Device check hook ──────────────────────────────────────────────────────────
function useDeviceCheck() {
  const [cam, setCam] = useState<'idle' | 'checking' | 'ok' | 'denied'>('idle')
  const [mic, setMic] = useState<'idle' | 'checking' | 'ok' | 'denied'>('idle')
  const [net, setNet] = useState<'idle' | 'checking' | 'ok' | 'slow'>('idle')
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const checkAll = async () => {
    setNet('checking'); setCam('checking'); setMic('checking')
    const t0 = Date.now()
    try {
      await fetch('/api/healthz', { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
      setNet(Date.now() - t0 < 3000 ? 'ok' : 'slow')
    } catch {
      setNet('ok')
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      setCam('ok'); setMic('ok')
    } catch (err: any) {
      setCam('denied'); setMic('denied')
    }
  }

  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  return { cam, mic, net, videoRef, checkAll, stopStream }
}

// ── Step 1: Role ───────────────────────────────────────────────────────────────
function Step1Role({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 style={S.stepTitle}>What role are you interviewing for?</h2>
      <p style={S.stepSub}>The AI will generate role-specific questions and evaluate you against industry standards for this exact role.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {ROLES.map(role => {
          const sel = value === role.value
          return (
            <button key={role.value} onClick={() => onChange(role.value)}
              style={{
                position: 'relative', padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                border: sel ? `2px solid ${NAVY}` : `1.5px solid ${CREAM_DK}`,
                background: sel ? 'rgba(26,39,68,0.05)' : WHITE,
                transition: 'all .15s',
              }}>
              <span style={{ fontSize: 26, marginBottom: 6 }}>{role.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: sel ? NAVY : INK_S, lineHeight: 1.3 }}>{role.value}</span>
              {sel && <CheckCircle size={13} color={NAVY} style={{ position: 'absolute', top: 7, right: 7 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2: Profile ────────────────────────────────────────────────────────────
function Step2Experience({ level, setLevel, totalQ, setTotalQ, jobDesc, setJobDesc }:
  { level: string; setLevel: (v: string) => void; totalQ: number; setTotalQ: (v: number) => void; jobDesc: string; setJobDesc: (v: string) => void }
) {
  return (
    <div>
      <h2 style={S.stepTitle}>Tell the AI about your experience</h2>
      <p style={S.stepSub}>This shapes the difficulty and depth of your interview.</p>

      <div style={{ marginBottom: 26 }}>
        <label style={S.label}>Experience Level</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {EXPERIENCE_LEVELS.map(l => {
            const sel = level === l.value
            return (
              <button key={l.value} onClick={() => setLevel(l.value)}
                style={{
                  padding: '13px 14px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  border: sel ? `2px solid ${NAVY}` : `1.5px solid ${CREAM_DK}`,
                  background: sel ? 'rgba(26,39,68,0.05)' : WHITE,
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{l.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sel ? NAVY : INK }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{l.desc}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 26 }}>
        <label style={S.label}>Interview Length</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {SESSION_SIZES.map(s => {
            const sel = totalQ === s.value
            return (
              <button key={s.value} onClick={() => setTotalQ(s.value)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 11, cursor: 'pointer', textAlign: 'center',
                  border: sel ? `2px solid ${NAVY}` : `1.5px solid ${CREAM_DK}`,
                  background: sel ? 'rgba(26,39,68,0.05)' : WHITE,
                  transition: 'all .15s',
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: sel ? NAVY : INK }}>{s.label}</div>
                <div style={{ fontSize: 10, color: MUTED }}>{s.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label style={S.label}>Job Description <span style={{ textTransform: 'none', fontWeight: 500, color: MUTED }}>(Optional)</span></label>
        <textarea
          value={jobDesc}
          onChange={e => setJobDesc(e.target.value)}
          placeholder="Paste the job description here for a more targeted interview. The AI will tailor questions to match exactly what the employer is looking for..."
          style={{
            width: '100%', minHeight: 110, padding: '11px 13px', borderRadius: 11,
            border: `1.5px solid ${CREAM_DK}`, fontSize: 13, color: INK_S,
            lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'system-ui, sans-serif', background: CREAM,
          }}
        />
        <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Adding a JD makes the interview 3× more targeted. Skip if not available.</p>
      </div>
    </div>
  )
}

// ── Step 3: System Check ───────────────────────────────────────────────────────
function Step3Device({ cam, mic, net, videoRef, checkAll }: ReturnType<typeof useDeviceCheck>) {
  const statusIcon = (s: string) => {
    if (s === 'idle')     return <div style={{ width: 9, height: 9, borderRadius: '50%', background: CREAM_DK }} />
    if (s === 'checking') return <Loader size={13} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
    if (s === 'ok')       return <CheckCircle size={13} color="#16A34A" />
    return <AlertCircle size={13} color="#DC2626" />
  }

  const statusText = (s: string, name: string) => {
    if (s === 'idle')     return `${name} not checked`
    if (s === 'checking') return `Checking ${name}…`
    if (s === 'ok')       return `${name} ready`
    if (s === 'slow')     return `${name} may be slow`
    return `${name} access denied — allow in browser settings`
  }

  const allOk = cam === 'ok' && mic === 'ok' && (net === 'ok' || net === 'slow')

  return (
    <div>
      <h2 style={S.stepTitle}>System Check</h2>
      <p style={S.stepSub}>We'll verify your camera, microphone, and connection before starting. This takes 5 seconds.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Camera preview */}
        <div style={{ background: WHITE, borderRadius: 13, padding: '14px 16px', border: `1.5px solid ${CREAM_DK}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Camera size={14} color={NAVY} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Camera</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            {statusIcon(cam)}
            <span style={{ fontSize: 11.5, color: cam === 'ok' ? '#16A34A' : cam === 'denied' ? '#DC2626' : MUTED }}>
              {statusText(cam, 'Camera')}
            </span>
          </div>
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 9, overflow: 'hidden', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cam === 'ok'
              ? <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              : <CameraOff size={26} color="#475569" />
            }
          </div>
        </div>

        {/* Right checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: <Mic size={14} color={NAVY} />,     label: 'Microphone', state: mic,    name: 'Mic'     },
            { icon: <Wifi size={14} color={NAVY} />,    label: 'Connection', state: net,    name: 'Network' },
            { icon: <Monitor size={14} color={NAVY} />, label: 'Browser',    state: 'ok',   name: 'Browser' },
          ].map(item => (
            <div key={item.label} style={{ background: WHITE, borderRadius: 11, padding: '12px 14px', border: `1.5px solid ${CREAM_DK}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              {item.icon}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: item.state === 'ok' ? '#16A34A' : item.state === 'denied' ? '#DC2626' : MUTED }}>
                  {statusText(item.state as string, item.name)}
                </div>
              </div>
              {statusIcon(item.state as string)}
            </div>
          ))}
        </div>
      </div>

      <button onClick={checkAll} style={{
        width: '100%', padding: '11px 0', borderRadius: 11,
        background: allOk ? 'rgba(22,163,74,0.08)' : NAVY,
        border: allOk ? '1.5px solid rgba(22,163,74,0.3)' : 'none',
        color: allOk ? '#16A34A' : WHITE,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        {allOk ? <><CheckCircle size={13} /> All systems ready</> : 'Run System Check'}
      </button>

      {(cam === 'denied' || mic === 'denied') && (
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <AlertCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', margin: '0 0 2px' }}>Permission denied</p>
            <p style={{ fontSize: 11, color: '#7F1D1D', margin: 0 }}>
              Click the lock icon in your browser address bar → allow Camera and Microphone → refresh this page.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Instructions ───────────────────────────────────────────────────────
function Step4Instructions({ role, level, totalQ }: { role: string; level: string; totalQ: number }) {
  const rules = [
    'The AI interviewer will ask questions one at a time — answer in full sentences.',
    'You can respond by typing or using your voice.',
    'The AI may ask follow-up questions to probe your answers deeper.',
    'Answer honestly — the AI evaluates depth, clarity, and relevance.',
    'Take a moment to think before answering. There is no rush.',
    'After the interview, you receive a detailed Job Readiness Report.',
  ]

  return (
    <div>
      <h2 style={S.stepTitle}>You're almost ready</h2>

      {/* summary card */}
      <div style={{ background: CREAM, borderRadius: 13, padding: '16px 20px', marginBottom: 22, border: `1px solid ${CREAM_DK}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
          {[
            { Icon: Briefcase, label: 'Role',      value: role },
            { Icon: User,      label: 'Level',     value: level },
            { Icon: Clock,     label: 'Questions', value: `${totalQ} questions` },
            { Icon: Shield,    label: 'Mode',      value: 'AI Interview' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <item.Icon size={12} color={MUTED} />
                <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* guidelines */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 10.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Interview Guidelines
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: NAVY,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 9, color: WHITE, fontWeight: 800,
              }}>{i + 1}</div>
              <p style={{ fontSize: 13, color: INK_S, lineHeight: 1.6, margin: 0 }}>{rule}</p>
            </div>
          ))}
        </div>
      </div>

      {/* speaker note */}
      <div style={{ padding: '12px 14px', borderRadius: 11, background: 'rgba(26,39,68,0.05)', border: `1px solid ${CREAM_DK}`, display: 'flex', gap: 9 }}>
        <Volume2 size={14} color={NAVY} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: INK_S, margin: 0, lineHeight: 1.55 }}>
          The AI interviewer will speak questions aloud. Ensure your speakers are on.
          You can also read the question in the transcript panel.
        </p>
      </div>
    </div>
  )
}

// ── Main Setup Page ────────────────────────────────────────────────────────────
const STEPS_WITH_ROLE    = ['Choose Role', 'Your Profile', 'System Check', 'Instructions']
const STEPS_WITHOUT_ROLE = ['Your Profile', 'System Check', 'Instructions']

interface JobContextOverride {
  job_title: string
  company_name: string
  required_skills: string[]
  skills_to_develop: string[]
}

export default function InterviewSetupPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { activePrep } = useActivePrepJob()
  const cardJobContext = (location.state as { jobContext?: JobContextOverride } | null)?.jobContext ?? null
  const jobContext     = cardJobContext ?? activePrep
  const hasJobContext  = !!jobContext
  const STEPS          = hasJobContext ? STEPS_WITHOUT_ROLE : STEPS_WITH_ROLE

  const [step,   setStep]   = useState(0)
  const [role,   setRole]   = useState('')
  const [level,  setLevel]  = useState('Mid-Level')
  const [totalQ, setTotalQ] = useState(8)
  const [jobDesc, setJobDesc] = useState('')
  const device = useDeviceCheck()

  useEffect(() => {
    if (jobContext) {
      setRole(jobContext.job_title)
      const ctx = `Role: ${jobContext.job_title} at ${jobContext.company_name}. `
        + `Required skills: ${jobContext.required_skills.slice(0, 6).join(', ')}.`
        + (jobContext.skills_to_develop.length
          ? ` Skills to develop: ${jobContext.skills_to_develop.slice(0, 4).join(', ')}.`
          : '')
      setJobDesc(ctx)
    }
  }, [jobContext])

  useEffect(() => { return () => device.stopStream() }, [])

  const createMutation = useMutation({
    mutationFn: () => interviewApi.createSession({
      job_role: role,
      experience_level: level,
      total_questions: totalQ,
      job_description: jobDesc || undefined,
      session_type: totalQ <= 5 ? 'practice' : totalQ <= 8 ? 'timed' : 'full_mock',
    }),
    onSuccess: (session) => { device.stopStream(); navigate(`/app/interview/lobby/${session.id}`) },
  })

  const canNextValues = hasJobContext
    ? [level !== '', true, true]
    : [role !== '', level !== '', true, true]
  const canNext = canNextValues[step] ?? true
  const isLast  = step === STEPS.length - 1

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── navy sidebar ── */}
      <div style={{
        width: 260, flexShrink: 0, background: NAVY,
        display: 'flex', flexDirection: 'column', padding: '32px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: -70, right: -60, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: 80, left: -40, pointerEvents: 'none' }} />

        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, position: 'relative' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={18} color={WHITE} />
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '.5px', textTransform: 'uppercase' }}>DISHA AI</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>AI Mock Interview</div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 36, position: 'relative' }}>
          Configure your session for a targeted, realistic experience.
        </p>

        {/* vertical stepper */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {STEPS.map((label, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'pending'
            const isLast = i === STEPS.length - 1
            return (
              <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: isLast ? 0 : 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: state === 'active' ? WHITE : state === 'done' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800,
                    color: state === 'active' ? NAVY : state === 'done' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
                  }}>
                    {state === 'done' ? <CheckCircle size={12} /> : i + 1}
                  </div>
                  {!isLast && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.12)', marginTop: 4 }} />}
                </div>
                <div style={{
                  fontSize: 12.5, fontWeight: state === 'active' ? 700 : 500, paddingTop: 3,
                  color: state === 'active' ? WHITE : state === 'done' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)',
                }}>
                  {label}
                </div>
              </div>
            )
          })}
        </div>

        {/* job context */}
        {jobContext && (
          <div style={{ marginTop: 'auto', paddingTop: 24, position: 'relative' }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>
                {cardJobContext ? 'Interviewing for' : 'Active prep job'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 2 }}>{jobContext.job_title}</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{jobContext.company_name}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── right panel ── */}
      <div style={{ flex: 1, background: CREAM, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* inner centering column */}
        <div style={{ flex: 1, minHeight: 0, padding: '24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 720, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

            {/* step eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, background: 'rgba(26,39,68,0.08)', borderRadius: 20, padding: '3px 10px', letterSpacing: '.3px' }}>
                Step {step + 1} of {STEPS.length}
              </span>
              <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{STEPS[step]}</span>
            </div>

            {/* card — flex:1 so it fills remaining height; buttons pinned inside at bottom */}
            <div style={{ flex: 1, minHeight: 0, background: WHITE, borderRadius: 18, border: `1px solid ${CREAM_DK}`, boxShadow: '0 2px 12px rgba(26,39,68,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* step content — scrolls only if truly needed */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 20px' }}>
                {hasJobContext ? (
                  <>
                    {step === 0 && <Step2Experience level={level} setLevel={setLevel} totalQ={totalQ} setTotalQ={setTotalQ} jobDesc={jobDesc} setJobDesc={setJobDesc} />}
                    {step === 1 && <Step3Device {...device} />}
                    {step === 2 && <Step4Instructions role={role} level={level} totalQ={totalQ} />}
                  </>
                ) : (
                  <>
                    {step === 0 && <Step1Role value={role} onChange={setRole} />}
                    {step === 1 && <Step2Experience level={level} setLevel={setLevel} totalQ={totalQ} setTotalQ={setTotalQ} jobDesc={jobDesc} setJobDesc={setJobDesc} />}
                    {step === 2 && <Step3Device {...device} />}
                    {step === 3 && <Step4Instructions role={role} level={level} totalQ={totalQ} />}
                  </>
                )}
              </div>

              {/* nav buttons — always pinned to bottom of card */}
              <div style={{ flexShrink: 0, borderTop: `1px solid ${CREAM_DK}`, padding: '16px 32px 24px', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${CREAM_DK}`, background: WHITE,
                    fontSize: 13, fontWeight: 700, color: INK_S,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                  <ChevronLeft size={14} /> Back
                </button>
                <button
                  onClick={() => {
                    if (isLast) {
                      createMutation.mutate()
                    } else {
                      setStep(s => s + 1)
                      const deviceStep = hasJobContext ? 1 : 2
                      if (step === deviceStep - 1) setTimeout(() => device.checkAll(), 100)
                    }
                  }}
                  disabled={!canNext || createMutation.isPending}
                  style={{
                    flex: 3, padding: '12px 0', borderRadius: 10,
                    cursor: canNext ? 'pointer' : 'not-allowed',
                    border: 'none',
                    background: canNext ? NAVY : CREAM_DK,
                    color: canNext ? WHITE : MUTED,
                    fontSize: 14, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    opacity: createMutation.isPending ? 0.85 : 1,
                  }}>
                  {createMutation.isPending
                    ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating your interview…</>
                    : isLast
                    ? <>Start Interview <ChevronRight size={14} /></>
                    : <>Continue <ChevronRight size={14} /></>
                  }
                </button>
              </div>

              {createMutation.isPending && (
                <p style={{ textAlign: 'center', fontSize: 12, color: NAVY, padding: '0 32px 14px', fontWeight: 600 }}>
                  AI is building your personalized {role} interview… ~5 seconds
                </p>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── shared style tokens ────────────────────────────────────────────────────────
const S = {
  stepTitle: {
    fontSize: 19, fontWeight: 900, color: INK, marginBottom: 5,
  } as React.CSSProperties,
  stepSub: {
    fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 22,
  } as React.CSSProperties,
  label: {
    fontSize: 11, fontWeight: 700, color: INK_S,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    marginBottom: 10, display: 'block',
  } as React.CSSProperties,
}
