import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import {
  Briefcase, ChevronRight, ChevronLeft, Mic, Video, Wifi,
  CheckCircle, AlertCircle, Clock, Shield, Monitor, User,
  Volume2, Camera, CameraOff, Loader, Sparkles
} from 'lucide-react'

// ── Role catalogue ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'AI Engineer', icon: '🤖', color: '#6366F1' },
  { value: 'Machine Learning Engineer', icon: '🧠', color: '#8B5CF6' },
  { value: 'Data Scientist', icon: '📊', color: '#0EA5E9' },
  { value: 'Frontend Developer', icon: '🎨', color: '#EC4899' },
  { value: 'Backend Developer', icon: '⚙️', color: '#14B8A6' },
  { value: 'Full Stack Developer', icon: '🔧', color: '#F97316' },
  { value: 'DevOps Engineer', icon: '🚀', color: '#EF4444' },
  { value: 'Cloud Engineer', icon: '☁️', color: '#3B82F6' },
  { value: 'Product Manager', icon: '📋', color: '#10B981' },
  { value: 'UI/UX Designer', icon: '✏️', color: '#F59E0B' },
  { value: 'Cybersecurity Engineer', icon: '🔒', color: '#DC2626' },
  { value: 'Mobile App Developer', icon: '📱', color: '#7C3AED' },
  { value: 'Business Analyst', icon: '📈', color: '#059669' },
]

const EXPERIENCE_LEVELS = [
  { value: 'Fresher', label: 'Fresher', desc: '0–1 year · Student or recent graduate', icon: '🌱' },
  { value: 'Junior', label: 'Junior', desc: '1–3 years · Entry level professional', icon: '🌿' },
  { value: 'Mid-Level', label: 'Mid-Level', desc: '3–6 years · Independent contributor', icon: '🌳' },
  { value: 'Senior', label: 'Senior', desc: '6+ years · Leads & mentors others', icon: '🌲' },
]

const SESSION_SIZES = [
  { value: 5, label: 'Quick Round', desc: '~15 min', icon: '⚡' },
  { value: 8, label: 'Standard', desc: '~25 min', icon: '🎯' },
  { value: 12, label: 'Deep Dive', desc: '~40 min', icon: '🔬' },
]

// ── Device check hook ─────────────────────────────────────────────────────────
function useDeviceCheck() {
  const [cam, setCam] = useState<'idle' | 'checking' | 'ok' | 'denied'>('idle')
  const [mic, setMic] = useState<'idle' | 'checking' | 'ok' | 'denied'>('idle')
  const [net, setNet] = useState<'idle' | 'checking' | 'ok' | 'slow'>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const checkAll = async () => {
    setNet('checking')
    setCam('checking')
    setMic('checking')

    // Network check
    const t0 = Date.now()
    try {
      await fetch('/api/healthz', { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
      setNet(Date.now() - t0 < 3000 ? 'ok' : 'slow')
    } catch {
      setNet('ok') // assume ok if fetch blocked by CORS
    }

    // Camera + Mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setCam('ok')
      setMic('ok')
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError'
      setCam(isDenied ? 'denied' : 'denied')
      setMic(isDenied ? 'denied' : 'denied')
    }
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  return { cam, mic, net, videoRef, checkAll, stopStream }
}

// ── Step components ───────────────────────────────────────────────────────────

function Step1Role({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 style={styles.stepTitle}>What role are you interviewing for?</h2>
      <p style={styles.stepSubtitle}>The AI will generate role-specific questions and evaluate you against industry standards for this exact role.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {ROLES.map(role => (
          <button
            key={role.value}
            onClick={() => onChange(role.value)}
            style={{
              ...styles.roleCard,
              border: value === role.value ? `2px solid ${role.color}` : '2px solid rgba(226,232,240,0.8)',
              background: value === role.value ? `${role.color}08` : 'white',
            }}
          >
            <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>{role.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: value === role.value ? role.color : '#374151', lineHeight: 1.3 }}>
              {role.value}
            </span>
            {value === role.value && (
              <CheckCircle size={14} color={role.color} style={{ position: 'absolute', top: 8, right: 8 }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Step2Experience({ level, setLevel, totalQ, setTotalQ, jobDesc, setJobDesc }:
  { level: string; setLevel: (v: string) => void; totalQ: number; setTotalQ: (v: number) => void; jobDesc: string; setJobDesc: (v: string) => void }
) {
  return (
    <div>
      <h2 style={styles.stepTitle}>Tell the AI about your experience</h2>
      <p style={styles.stepSubtitle}>This shapes the difficulty and depth of your interview.</p>

      <div style={{ marginBottom: 28 }}>
        <label style={styles.label}>Experience Level</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {EXPERIENCE_LEVELS.map(l => (
            <button
              key={l.value}
              onClick={() => setLevel(l.value)}
              style={{
                ...styles.optionCard,
                border: level === l.value ? '2px solid #3B82F6' : '2px solid rgba(226,232,240,0.8)',
                background: level === l.value ? 'rgba(59,130,246,0.06)' : 'white',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{l.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{l.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={styles.label}>Interview Length</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {SESSION_SIZES.map(s => (
            <button
              key={s.value}
              onClick={() => setTotalQ(s.value)}
              style={{
                flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: totalQ === s.value ? '2px solid #3B82F6' : '2px solid rgba(226,232,240,0.8)',
                background: totalQ === s.value ? 'rgba(59,130,246,0.06)' : 'white',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={styles.label}>Job Description (Optional)</label>
        <textarea
          value={jobDesc}
          onChange={e => setJobDesc(e.target.value)}
          placeholder="Paste the job description here for a more targeted interview. The AI will tailor questions to match exactly what the employer is looking for..."
          style={{
            width: '100%', minHeight: 120, padding: '12px 14px', borderRadius: 12,
            border: '1.5px solid rgba(226,232,240,0.8)', fontSize: 13, color: '#374151',
            lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'system-ui, sans-serif',
          }}
        />
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
          Adding a JD makes the interview 3x more targeted. Skip if not available.
        </p>
      </div>
    </div>
  )
}

function Step3Device({ cam, mic, net, videoRef, checkAll }: ReturnType<typeof useDeviceCheck>) {
  const statusIcon = (s: string) => {
    if (s === 'idle') return <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#CBD5E1' }} />
    if (s === 'checking') return <Loader size={14} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
    if (s === 'ok') return <CheckCircle size={14} color="#16A34A" />
    return <AlertCircle size={14} color="#DC2626" />
  }

  const statusText = (s: string, name: string) => {
    if (s === 'idle') return `${name} not checked`
    if (s === 'checking') return `Checking ${name}...`
    if (s === 'ok') return `${name} ready`
    if (s === 'slow') return `${name} may be slow`
    return `${name} access denied — please allow in browser settings`
  }

  const allOk = cam === 'ok' && mic === 'ok' && (net === 'ok' || net === 'slow')

  return (
    <div>
      <h2 style={styles.stepTitle}>System Check</h2>
      <p style={styles.stepSubtitle}>We'll verify your camera, microphone, and connection before starting. This takes 5 seconds.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 14, padding: '16px 20px', border: '1.5px solid rgba(226,232,240,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Video size={16} color="#15130F" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Camera</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {statusIcon(cam)}
            <span style={{ fontSize: 12, color: cam === 'ok' ? '#16A34A' : cam === 'denied' ? '#DC2626' : '#64748B' }}>
              {statusText(cam, 'Camera')}
            </span>
          </div>
          <div style={{
            width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden',
            background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {cam === 'ok' ? (
              <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            ) : (
              <CameraOff size={28} color="#475569" />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: <Mic size={16} color="#15130F" />, label: 'Microphone', state: mic, name: 'Mic' },
            { icon: <Wifi size={16} color="#15130F" />, label: 'Connection', state: net, name: 'Network' },
            { icon: <Monitor size={16} color="#15130F" />, label: 'Browser', state: 'ok' as const, name: 'Browser' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'white', borderRadius: 12, padding: '14px 16px',
              border: '1.5px solid rgba(226,232,240,0.8)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {item.icon}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: item.state === 'ok' ? '#16A34A' : item.state === 'denied' ? '#DC2626' : '#64748B' }}>
                  {statusText(item.state, item.name)}
                </div>
              </div>
              {statusIcon(item.state)}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={checkAll}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 12,
          background: allOk ? 'rgba(59,130,246,0.06)' : '#3B82F6',
          border: allOk ? '1.5px solid rgba(59,130,246,0.3)' : 'none',
          color: allOk ? '#1D4ED8' : 'white',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {allOk ? <><CheckCircle size={14} /> All systems ready</> : <>Run System Check</>}
      </button>

      {(cam === 'denied' || mic === 'denied') && (
        <div style={{
          marginTop: 14, padding: '12px 16px', borderRadius: 10,
          background: '#FEF2F2', border: '1px solid #FECACA',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 3 }}>Permission denied</p>
            <p style={{ fontSize: 11, color: '#7F1D1D' }}>
              Click the lock icon in your browser address bar → allow Camera and Microphone → refresh this page.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

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
      <h2 style={styles.stepTitle}>You're almost ready</h2>

      <div style={{
        background: '#FAF7F1',
        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
        border: '1.5px solid #F1EAE0',
      }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { icon: <Briefcase size={16} color="#15130F" />, label: 'Role', value: role },
            { icon: <User size={16} color="#15130F" />, label: 'Level', value: level },
            { icon: <Clock size={16} color="#15130F" />, label: 'Questions', value: `${totalQ} questions` },
            { icon: <Shield size={16} color="#15130F" />, label: 'Mode', value: 'AI Interview' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                {item.icon}
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Interview Guidelines
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#15130F',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 9, color: 'white', fontWeight: 800,
              }}>{i + 1}</div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{rule}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: '#FAF7F1', border: '1px solid #F1EAE0',
        display: 'flex', gap: 10,
      }}>
        <Volume2 size={16} color="#15130F" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#4A453D', margin: 0 }}>
          The AI interviewer will speak questions aloud. Ensure your speakers are on.
          You can also read the question in the transcript panel.
        </p>
      </div>
    </div>
  )
}

// ── Main Setup Page ───────────────────────────────────────────────────────────

const STEPS_WITH_ROLE    = ['Choose Role', 'Your Profile', 'System Check', 'Instructions']
const STEPS_WITHOUT_ROLE = ['Your Profile', 'System Check', 'Instructions']

export default function InterviewSetupPage() {
  const navigate = useNavigate()
  const { activePrep, isLoading: prepLoading } = useActivePrepJob()

  // If active prep job exists we skip the role-selection step
  const hasActivePrep = !!activePrep
  const STEPS = hasActivePrep ? STEPS_WITHOUT_ROLE : STEPS_WITH_ROLE

  const [step, setStep] = useState(0)
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('Mid-Level')
  const [totalQ, setTotalQ] = useState(8)
  const [jobDesc, setJobDesc] = useState('')
  const device = useDeviceCheck()

  // Pre-fill from active prep once loaded
  useEffect(() => {
    if (activePrep) {
      setRole(activePrep.job_title)
      const ctx = `Role: ${activePrep.job_title} at ${activePrep.company_name}. `
        + `Required skills: ${activePrep.required_skills.slice(0, 6).join(', ')}.`
        + (activePrep.skills_to_develop.length
          ? ` Skills to develop: ${activePrep.skills_to_develop.slice(0, 4).join(', ')}.`
          : '')
      setJobDesc(ctx)
    }
  }, [activePrep])

  useEffect(() => {
    return () => device.stopStream()
  }, [])

  const createMutation = useMutation({
    mutationFn: () => interviewApi.createSession({
      job_role: role,
      experience_level: level,
      total_questions: totalQ,
      job_description: jobDesc || undefined,
      session_type: totalQ <= 5 ? 'practice' : totalQ <= 8 ? 'timed' : 'full_mock',
    }),
    onSuccess: (session) => {
      device.stopStream()
      navigate(`/app/interview/lobby/${session.id}`)
    },
  })

  // canNext per step index depends on whether we have the role step
  const canNextValues = hasActivePrep
    ? [level !== '', true, true]   // profile / device / instructions
    : [role !== '', level !== '', true, true]  // role / profile / device / instructions

  const canNext = canNextValues[step] ?? true
  const isLast = step === STEPS.length - 1

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'white', border: '1.5px solid rgba(226,232,240,0.8)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 24,
            fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)', transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.color = '#15130F'; e.currentTarget.style.borderColor = '#15130F' }}
          onMouseOut={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = 'rgba(226,232,240,0.8)' }}
        >
          <ChevronLeft size={15} /> Back
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', marginBottom: 6 }}>
            AI Interview Setup
          </h1>
          <p style={{ fontSize: 14, color: '#64748B' }}>
            Configure your interview for a personalized, realistic experience
          </p>
        </div>

        {/* Active prep banner */}
        {activePrep && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderRadius: 14, marginBottom: 24,
            background: '#FAF7F1',
            border: '1.5px solid #F1EAE0',
          }}>
            <Sparkles size={16} color="#15130F" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#15130F' }}>Interviewing for your active prep job — </span>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 700 }}>{activePrep.job_title}</span>
              <span style={{ fontSize: 12, color: '#64748B' }}> at {activePrep.company_name}</span>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', marginBottom: 6,
                  background: i < step ? '#3B82F6' : i === step ? '#3B82F6' : '#E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                  color: i <= step ? 'white' : '#94A3B8',
                }}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, color: i === step ? '#1D4ED8' : '#94A3B8', fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ height: 2, flex: 1, background: i < step ? '#3B82F6' : '#E2E8F0', margin: '0 4px', marginBottom: 24 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={{ background: 'white', borderRadius: 20, padding: '28px 32px', border: '1.5px solid rgba(226,232,240,0.8)', marginBottom: 20 }}>
          {hasActivePrep ? (
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

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 12, cursor: 'pointer',
                border: '1.5px solid rgba(226,232,240,0.8)', background: 'white',
                fontSize: 13, fontWeight: 700, color: '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <ChevronLeft size={15} /> Back
            </button>
          )}
          <button
            onClick={() => {
              if (isLast) {
                createMutation.mutate()
              } else {
                setStep(s => s + 1)
                // trigger device check when entering the system-check step
              const deviceStep = hasActivePrep ? 1 : 2
              if (step === deviceStep - 1) {
                  setTimeout(() => device.checkAll(), 100)
                }
              }
            }}
            disabled={!canNext || createMutation.isPending}
            style={{
              flex: 3, padding: '13px 0', borderRadius: 12, cursor: canNext ? 'pointer' : 'not-allowed',
              border: 'none',
              background: canNext ? '#3B82F6' : '#E2E8F0',
              color: canNext ? 'white' : '#94A3B8',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: createMutation.isPending ? 0.8 : 1,
            }}
          >
            {createMutation.isPending
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating your interview...</>
              : isLast
              ? <>Start Interview <ChevronRight size={15} /></>
              : <>Continue <ChevronRight size={15} /></>
            }
          </button>
        </div>

        {createMutation.isPending && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#3B82F6', marginTop: 12, fontWeight: 600 }}>
            AI is building your personalized {role} interview... This takes ~5 seconds.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const styles = {
  stepTitle: {
    fontSize: 20, fontWeight: 900, color: '#0F172A',
    fontFamily: 'Hind, sans-serif', marginBottom: 6,
  } as React.CSSProperties,
  stepSubtitle: {
    fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 24,
  } as React.CSSProperties,
  label: {
    fontSize: 12, fontWeight: 700, color: '#374151',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10, display: 'block',
  } as React.CSSProperties,
  roleCard: {
    position: 'relative' as const, padding: '16px 12px', borderRadius: 14,
    cursor: 'pointer', textAlign: 'center' as const,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  optionCard: {
    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left' as const,
    transition: 'all 0.15s',
  } as React.CSSProperties,
}
