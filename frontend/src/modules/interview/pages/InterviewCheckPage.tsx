import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Volume2 } from 'lucide-react'
import { interviewApi } from '@/api/interview'
import { verifiedApi, type StartConsent } from '@/api/verifiedInterview'
import InterviewShell from '../components/InterviewShell'
import { DURATIONS, clearDraft, loadDraft } from '../lib/draft'

type Status = 'pending' | 'ok' | 'warn' | 'fail'

function StatusIcon({ status }: { status: Status }) {
  if (status === 'ok') return <CheckCircle2 className="iv-check-icon" color="var(--iv-success)" aria-label="Done" />
  if (status === 'fail') return <AlertCircle className="iv-check-icon" color="var(--iv-danger)" aria-label="Problem" />
  if (status === 'warn') return <AlertCircle className="iv-check-icon" color="var(--iv-text-muted)" aria-label="Warning" />
  return <Loader2 className="iv-check-icon iv-spin" color="var(--iv-text-muted)" aria-label="Checking" />
}

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Could not start your interview. Please try again.'
}

export default function InterviewCheckPage() {
  const navigate = useNavigate()
  const draft = loadDraft()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)

  const [net, setNet] = useState<Status>('pending')
  const [access, setAccess] = useState<Status>('pending')
  const [hasCamera, setHasCamera] = useState(false)
  const [mic, setMic] = useState<Status>('pending')
  const [level, setLevel] = useState(0)
  const [speaker, setSpeaker] = useState<'idle' | 'asking' | 'confirmed'>('idle')

  const stopMedia = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
  }, [])

  const checkNetwork = useCallback(async () => {
    setNet('pending')
    const t0 = Date.now()
    try {
      // Any HTTP response proves we can reach the server; only timing matters.
      await fetch('/api/healthz', { cache: 'no-store' })
      setNet(Date.now() - t0 < 3000 ? 'ok' : 'warn')
    } catch {
      setNet('fail')
    }
  }, [])

  const checkMedia = useCallback(async () => {
    stopMedia()
    setAccess('pending'); setMic('pending'); setLevel(0)
    let stream: MediaStream
    let withVideo = true
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      // Camera missing or refused: try audio only so the interview can still run.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        withVideo = false
      } catch {
        setAccess('fail'); setMic('fail')
        return
      }
    }
    streamRef.current = stream
    setHasCamera(withVideo)
    setAccess('ok')

    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    let last = 0
    const tick = () => {
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      const now = performance.now()
      if (now - last > 100) {
        last = now
        const lvl = Math.min(100, avg * 2.5)
        setLevel(lvl)
        if (lvl > 12) setMic('ok')
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [stopMedia])

  // The <video> only exists once hasCamera is true, so the stream is attached here, after it mounts.
  useEffect(() => {
    const el = videoRef.current
    if (hasCamera && el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current
      el.play().catch(() => {})
    }
  }, [hasCamera, access])

  const testSpeaker = useCallback(() => {
    setSpeaker('asking')
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Hello, can you hear me?'))
  }, [])

  useEffect(() => {
    if (!draft) { navigate('/app/interview/setup', { replace: true }); return }
    if (!draft.consent) { navigate('/app/interview/instructions', { replace: true }); return }
    checkNetwork()
    checkMedia().then(testSpeaker)
    return () => { stopMedia(); window.speechSynthesis?.cancel() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: () => {
      if (draft!.invitationId) {
        // An employer's Verified Interview: the questions and language come from their template.
        const consents: StartConsent[] = ['ai_processing', 'own_effort', 'employer_share']
        if (draft!.saveAudio) consents.push('media')
        return verifiedApi.startInvitation(draft!.invitationId, consents)
      }
      const d = DURATIONS[draft!.duration]
      return interviewApi.createSession({
        job_role: draft!.role,
        experience_level: draft!.level,
        total_questions: d.questions,
        job_description: draft!.jobDesc || undefined,
        session_type: d.sessionType,
        // Ticked on the instructions page: own effort + answers processed by an AI service.
        consents: draft!.saveAudio ? ['ai_processing', 'own_effort', 'media'] : ['ai_processing', 'own_effort'],
        language: draft!.language ?? 'en',
      })
    },
    onSuccess: (session) => {
      stopMedia()
      clearDraft()
      navigate(`/app/interview/room/${session.id}`)
    },
  })

  if (!draft) return null

  const canStart = access === 'ok' && speaker === 'confirmed' && net !== 'fail' && !createMutation.isPending
  const micStatus: Status = access === 'fail' ? 'fail' : mic

  return (
    <InterviewShell narrow>
      <button className="iv-back" onClick={() => { stopMedia(); navigate('/app/interview/instructions') }}>
        <ArrowLeft size={18} aria-hidden /> Go back
      </button>

      <h1 className="iv-h1">Before we begin</h1>
      <p className="iv-sub">We'll run a short system check to make sure everything works smoothly.</p>

      <div className="iv-check-grid">
        <section className="iv-panel" style={{ margin: 0 }}>
          <div className="iv-check-list">
            <div className="iv-check-row">
              <StatusIcon status={net} />
              <div>
                Internet speed
                {net === 'warn' && <div className="iv-check-sub">Your connection looks slow. The interview may lag.</div>}
                {net === 'fail' && (
                  <div className="iv-check-sub">
                    Can't reach the server. <button className="iv-link-btn" onClick={checkNetwork}>Retry</button>
                  </div>
                )}
              </div>
            </div>

            <div className="iv-check-row">
              <StatusIcon status={access} />
              <div>
                Camera and microphone access
                <div className="iv-check-sub">This interview is voice only: you answer by speaking, so the microphone is required.</div>
                {access === 'ok' && !hasCamera && <div className="iv-check-sub">No camera found. You can continue with audio only.</div>}
                {access === 'fail' && (
                  <div className="iv-check-sub">
                    Allow microphone access from the lock icon in your address bar, then{' '}
                    <button className="iv-link-btn" onClick={() => checkMedia().then(testSpeaker)}>retry</button>.
                  </div>
                )}
              </div>
            </div>

            <div className="iv-check-row">
              <StatusIcon status={micStatus} />
              <div style={{ flex: 1 }}>
                Microphone
                {micStatus === 'pending' && access === 'ok' && <div className="iv-check-sub">Say something to test your microphone.</div>}
                {access === 'ok' && <div className="iv-meter" aria-hidden><div style={{ width: `${level}%` }} /></div>}
              </div>
            </div>

            <div className="iv-check-row">
              {speaker === 'confirmed'
                ? <CheckCircle2 className="iv-check-icon" color="var(--iv-success)" aria-label="Done" />
                : <Volume2 className="iv-check-icon" color="var(--iv-text-muted)" aria-hidden />}
              <div>
                {speaker === 'confirmed' ? 'Speaker audio' : 'Testing speaker audio'}
                {speaker === 'asking' && (
                  <>
                    <div className="iv-check-sub">Did you hear the speaker audio?</div>
                    <div className="iv-pill-row">
                      <button className="iv-btn iv-btn-sm" onClick={() => setSpeaker('confirmed')}>Yes</button>
                      <button className="iv-btn iv-btn-quiet" onClick={testSpeaker}>Retry</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="iv-preview">
          {hasCamera
            ? <video ref={videoRef} muted playsInline autoPlay aria-label="Your camera preview" />
            : <div className="iv-preview-empty">{access === 'pending' ? 'Starting camera…' : 'Camera preview unavailable'}</div>}
        </div>
      </div>

      <div className="iv-actions" style={{ marginTop: 28 }}>
        <button className="iv-btn" disabled={!canStart} onClick={() => createMutation.mutate()}>
          {createMutation.isPending
            ? <><Loader2 size={18} className="iv-spin" aria-hidden /> Preparing your interview…</>
            : 'Start interview'}
        </button>
      </div>
      {createMutation.isError && <p className="iv-error" role="alert" style={{ textAlign: 'right' }}>{errorMessage(createMutation.error)}</p>}
    </InterviewShell>
  )
}
