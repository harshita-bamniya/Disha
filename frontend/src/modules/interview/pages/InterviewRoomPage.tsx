import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { interviewApi, type InterviewQuestion } from '@/api/interview'
import {
  Mic, MicOff, Video, VideoOff, Send, Clock, CheckCircle,
  Wifi, WifiOff, ChevronRight, Square,
  Volume2, VolumeX, User, Loader, SkipForward, PhoneOff, AlertTriangle
} from 'lucide-react'
import TypingIndicator from '@/shared/components/ai/TypingIndicator'

interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: Date
  isFollowUp?: boolean
  questionType?: string | null
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [camOn, setCamOn] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCamOn(true)

        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          setAudioLevel(Math.min(100, avg * 2.5))
          animRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotAllowedError') {
          setError('Camera and microphone access was denied. You can still type your answers below.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. You can still type your answers below.')
        } else {
          setError('Could not access camera/microphone. You can still type your answers below.')
        }
      })

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(animRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  const toggleCam = () => {
    const tracks = streamRef.current?.getVideoTracks() ?? []
    const next = !camOn
    tracks.forEach(t => { t.enabled = next })
    setCamOn(next)
  }

  const toggleMic = (onMicChange?: (on: boolean) => void) => {
    const next = !micOn
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
    onMicChange?.(next)
  }

  return { videoRef, camOn, micOn, audioLevel, error, toggleCam, toggleMic }
}

function useVoiceInput(onResult: (text: string) => void, lang: string = 'en-US') {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const start = useCallback(() => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    shouldListenRef.current = true

    const launch = () => {
      if (!shouldListenRef.current) return
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = lang
      rec.onresult = (e: SpeechRecognitionEvent) => {
        onResultRef.current(Array.from(e.results).map(r => r[0].transcript).join(''))
      }
      rec.onend = () => {
        if (shouldListenRef.current) setTimeout(launch, 200)
        else setListening(false)
      }
      rec.onerror = () => {
        if (shouldListenRef.current) setTimeout(launch, 500)
      }
      rec.start()
      recognitionRef.current = rec
      setListening(true)
    }
    launch()
  }, [lang])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, start, stop }
}

function useAISpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!enabledRef.current || !window.speechSynthesis) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95; utt.pitch = 1; utt.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang === 'en-US')
    if (preferred) utt.voice = preferred
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => { setSpeaking(false); onEnd?.() }
    utt.onerror = () => { setSpeaking(false); onEnd?.() }
    window.speechSynthesis.speak(utt)
  }, [])

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  return { speaking, enabled, setEnabled, speak, cancel }
}

// ── Network status ─────────────────────────────────────────────────────────────

function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function InterviewTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startTime])
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return <span>{m}:{s}</span>
}

// ── AI Video Tile ─────────────────────────────────────────────────────────────

// Bar heights give a natural voice waveform shape rather than uniform bars
const SPEAKING_BARS = [
  { delay: 0,    height: [4, 22] },
  { delay: 0.08, height: [4, 32] },
  { delay: 0.16, height: [4, 18] },
  { delay: 0.24, height: [4, 28] },
  { delay: 0.12, height: [4, 36] },
  { delay: 0.20, height: [4, 24] },
  { delay: 0.04, height: [4, 14] },
  { delay: 0.28, height: [4, 30] },
  { delay: 0.10, height: [4, 20] },
]

function AIVideoTile({ state, questionText }: { state: 'idle' | 'thinking' | 'speaking'; questionText: string }) {
  return (
    <div style={{
      flex: 1, borderRadius: 16, overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 60%, #1a1035 100%)',
      border: `2px solid ${
        state === 'speaking' ? 'rgba(99,102,241,0.7)'
        : state === 'thinking' ? 'rgba(245,158,11,0.4)'
        : 'rgba(255,255,255,0.06)'
      }`,
      transition: 'border-color 0.4s, box-shadow 0.4s',
      boxShadow: state === 'speaking'
        ? '0 0 0 3px rgba(99,102,241,0.2), 0 0 40px rgba(99,102,241,0.1)'
        : state === 'thinking'
          ? '0 0 0 2px rgba(245,158,11,0.1)'
          : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 0,
    }}>

      {/* Outer glow ring — speaking only */}
      {state === 'speaking' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          border: '2px solid rgba(99,102,241,0.35)',
          animation: 'ring-pulse 1.6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Subtle background shimmer when thinking */}
      {state === 'thinking' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.04) 0%, transparent 70%)',
          animation: 'bg-breathe 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Idle breathing glow */}
      {state === 'idle' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.03) 0%, transparent 70%)',
          animation: 'bg-breathe 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Avatar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        {/* Speaking ripple rings */}
        {state === 'speaking' && (
          <>
            <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.35)', animation: 'ring-pulse 1.4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', inset: -26, borderRadius: '50%', border: '1.5px solid rgba(99,102,241,0.2)', animation: 'ring-pulse 1.4s ease-in-out 0.25s infinite' }} />
            <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', border: '1px solid rgba(99,102,241,0.1)', animation: 'ring-pulse 1.4s ease-in-out 0.5s infinite' }} />
          </>
        )}
        {/* Thinking orbit dot */}
        {state === 'thinking' && (
          <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', animation: 'orbit 1.8s linear infinite' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px rgba(245,158,11,0.8)' }} />
          </div>
        )}

        <div style={{
          width: 104, height: 104, borderRadius: '50%',
          background: state === 'thinking'
            ? 'linear-gradient(135deg, #1E293B, #334155)'
            : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
          border: `3px solid ${
            state === 'speaking' ? '#818CF8'
            : state === 'thinking' ? 'rgba(245,158,11,0.5)'
            : 'rgba(255,255,255,0.12)'
          }`,
          boxShadow: state === 'speaking'
            ? '0 0 32px rgba(99,102,241,0.5), inset 0 0 20px rgba(99,102,241,0.1)'
            : state === 'thinking'
              ? '0 0 20px rgba(245,158,11,0.2)'
              : '0 6px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.4s',
          animation: state === 'idle' ? 'avatar-breathe 4s ease-in-out infinite' : 'none',
        }}>
          {state === 'thinking' ? '🧠' : '🤖'}
        </div>

        {/* Status dot */}
        <div style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 16, height: 16, borderRadius: '50%',
          background: state === 'idle' ? '#64748B' : state === 'thinking' ? '#F59E0B' : '#10B981',
          border: '2.5px solid #1E1B4B',
          boxShadow: state !== 'idle' ? `0 0 8px ${state === 'thinking' ? 'rgba(245,158,11,0.6)' : 'rgba(16,185,129,0.6)'}` : 'none',
          animation: state !== 'idle' ? 'dot-blink 1.2s ease-in-out infinite' : 'none',
          transition: 'background 0.3s',
        }} />
      </div>

      {/* Voice waveform bars — speaking */}
      {state === 'speaking' && (
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', marginBottom: 10, height: 36 }}>
          {SPEAKING_BARS.map((bar, i) => (
            <div key={i} style={{
              width: 4, borderRadius: 3,
              background: 'linear-gradient(180deg, #A5B4FC, #6366F1)',
              boxShadow: '0 0 4px rgba(99,102,241,0.4)',
              animation: `voice-bar-${i % 3} 0.${6 + (i % 3)}s ease-in-out ${bar.delay}s infinite`,
              minHeight: bar.height[0],
            }} />
          ))}
        </div>
      )}

      {/* Thinking dots */}
      {state === 'thinking' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#F59E0B',
              boxShadow: '0 0 6px rgba(245,158,11,0.5)',
              animation: `dot-bounce 0.9s ease-in-out ${d}s infinite`,
            }} />
          ))}
        </div>
      )}

      {questionText && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
          padding: '32px 16px 14px',
        }}>
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5,
            margin: 0, textAlign: 'center',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {questionText}
          </p>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 10, left: 10,
        background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: state === 'idle' ? '#64748B' : '#10B981', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>Alex · AI Interviewer</span>
      </div>
    </div>
  )
}

// ── User Video Tile ───────────────────────────────────────────────────────────

function UserVideoTile({
  videoRef, camOn, micOn, audioLevel, toggleCam, onToggleMic, cameraError
}: Pick<ReturnType<typeof useCamera>, 'videoRef' | 'camOn' | 'micOn' | 'audioLevel' | 'toggleCam'> & {
  onToggleMic: () => void
  cameraError: string | null
}) {
  return (
    <div style={{
      flex: 1, borderRadius: 16, overflow: 'hidden', position: 'relative',
      background: '#0F172A',
      border: `2px solid ${audioLevel > 15 && micOn ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.06)'}`,
      transition: 'border-color 0.2s',
      boxShadow: audioLevel > 15 && micOn ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
      minHeight: 0,
    }}>
      {cameraError ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
          <AlertTriangle size={28} color="#F59E0B" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 }}>{cameraError}</span>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            muted playsInline autoPlay
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: 'scaleX(-1)',
              filter: camOn ? 'none' : 'brightness(0)',
            }}
          />
          {!camOn && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={32} color="rgba(255,255,255,0.4)" />
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Camera off</span>
            </div>
          )}
          {audioLevel > 15 && micOn && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: '2px solid rgba(16,185,129,0.5)', pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
            <button
              onClick={onToggleMic}
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: !micOn ? '#EF4444' : 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              {micOn ? <Mic size={14} color="white" /> : <MicOff size={14} color="white" />}
            </button>
            <button
              onClick={toggleCam}
              aria-label={camOn ? 'Turn off camera' : 'Turn on camera'}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: !camOn ? '#EF4444' : 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              {camOn ? <Video size={14} color="white" /> : <VideoOff size={14} color="white" />}
            </button>
          </div>
        </>
      )}

      <div style={{
        position: 'absolute', top: 10, left: 10,
        background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: micOn && !cameraError ? '#10B981' : '#EF4444', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>You · Candidate</span>
      </div>

      {!micOn && !cameraError && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239,68,68,0.85)', borderRadius: 6, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MicOff size={10} color="white" />
          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>Muted</span>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const MIN_ANSWER_CHARS = 30

export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [answer, setAnswer] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'speaking'>('idle')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [startTime] = useState(Date.now())
  const [responseStartTime, setResponseStartTime] = useState(Date.now())
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [showTextarea, setShowTextarea] = useState(false)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const initDoneRef = useRef(false)
  const networkOk = useNetworkStatus()

  const camera = useCamera()
  const aiSpeech = useAISpeech()

  // Use a ref so the voice input callback always sees the latest setter
  const setAnswerRef = useRef(setAnswer)
  setAnswerRef.current = setAnswer
  const onVoiceResult = useCallback((text: string) => setAnswerRef.current(text), [])

  const userLang = 'en-US' // TODO: derive from user.preferred_language once exposed
  const voice = useVoiceInput(onVoiceResult, userLang)

  // Keep latest voice/aiSpeech methods in refs so the session-init effect
  // never captures stale closures even if hook identities change
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  const aiSpeechRef = useRef(aiSpeech)
  aiSpeechRef.current = aiSpeech

  const { data: session, isLoading } = useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: () => interviewApi.getSession(sessionId!),
    enabled: !!sessionId,
  })

  // Runs once when session data first arrives. Uses refs for speak/voice so it
  // never depends on hook identity — avoids stale-closure ESLint trap.
  useEffect(() => {
    if (!session || initDoneRef.current) return
    initDoneRef.current = true

    interviewApi.startSession(sessionId!).catch(() => {})

    const greeting = session.blueprint?.opening_greeting
      || `Welcome! I'm Alex, your AI interviewer for the ${session.job_role || 'interview'} today. Let's get started.`
    const iceBreaker = session.blueprint?.ice_breaker_question
    const firstQText = iceBreaker || session.questions?.[0]?.question_text || 'Tell me about yourself and your background.'
    const firstQData = !iceBreaker ? (session.questions?.[0] ?? null) : null

    setAiState('speaking')
    setTranscript([{ role: 'ai', text: greeting, timestamp: new Date() }])

    // Chain greeting → first question using speech onEnd events, not magic timeouts
    aiSpeechRef.current.speak(greeting, () => {
      setTranscript(t => {
        if (t.some(e => e.role === 'ai' && e.text === firstQText)) return t
        return [...t, { role: 'ai', text: firstQText, timestamp: new Date(), questionType: firstQData?.question_type }]
      })
      setQuestionText(firstQText)
      setCurrentQuestion(firstQData)
      setResponseStartTime(Date.now())

      aiSpeechRef.current.speak(firstQText, () => {
        setAiState('idle')
        voiceRef.current.start()
      })
    })
  }, [session, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const submitMutation = useMutation({
    mutationFn: async () => {
      const elapsed = Math.round((Date.now() - responseStartTime) / 1000)
      return interviewApi.submitResponse(sessionId!, {
        question_id: currentQuestion?.id ?? undefined,
        question_text: questionText,
        question_type: currentQuestion?.question_type ?? undefined,
        response_text: answer.trim(),
        response_time_sec: elapsed,
      })
    },
    onSuccess: async (result) => {
      setTranscript(t => [...t, { role: 'candidate', text: answer.trim(), timestamp: new Date() }])
      setAnswer('')
      voice.stop()

      const respId = result.response_id
      setAnsweredCount(c => c + 1)
      setWaitingForNext(true)
      setAiState('thinking')

      // Small pause so the thinking indicator is visible before the API call resolves
      await new Promise(r => setTimeout(r, 800))

      try {
        const next = await interviewApi.getNextQuestion(sessionId!, respId)
        setWaitingForNext(false)

        if (next.session_complete || !next.question) {
          setSessionDone(true)
          const doneText = "That concludes our interview. Thank you for your time and thoughtful answers. I'll now generate your detailed Job Readiness Report."
          setTranscript(t => [...t, { role: 'ai', text: doneText, timestamp: new Date() }])
          setQuestionText(doneText)
          setAiState('speaking')
          aiSpeech.speak(doneText, () => setAiState('idle'))
          return
        }

        const nextText = next.question.text
        const nextQData: InterviewQuestion | null = next.question.id
          ? { id: next.question.id, question_text: nextText, question_type: next.question.question_type ?? null, difficulty: next.question.difficulty ?? null, language: 'en', career_track_id: null, is_dynamic: true }
          : null

        setTranscript(t => [...t, {
          role: 'ai', text: nextText, timestamp: new Date(),
          isFollowUp: next.action !== 'next_question',
          questionType: nextQData?.question_type,
        }])
        setQuestionText(nextText)
        setCurrentQuestion(nextQData)
        setQuestionIdx(i => i + 1)
        setResponseStartTime(Date.now())
        setAiState('speaking')

        aiSpeech.speak(nextText, () => {
          setAiState('idle')
          if (camera.micOn && !camera.error) voice.start()
        })
      } catch {
        setWaitingForNext(false)
        setAiState('idle')
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      setCompleting(true)
      aiSpeech.cancel()
      voice.stop()
      return interviewApi.completeSession(sessionId!)
    },
    onSuccess: () => navigate(`/app/interview/report/${sessionId}`),
    onSettled: () => setCompleting(false),
  })

  if (isLoading || !session) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#818CF8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Joining interview...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (completing) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🧠</div>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 8 }}>Analyzing your performance...</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>Generating your Job Readiness Report. ~10 seconds.</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {['Evaluating answers', 'Scoring competencies', 'Building roadmap'].map((t, i) => (
            <div key={t} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)', animation: `fade-in 0.4s ease ${i * 0.3}s both` }}>{t}</div>
          ))}
        </div>
      </div>
      <style>{`@keyframes fade-in { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }`}</style>
    </div>
  )

  const totalQ = session.total_questions
  const progress = Math.round((answeredCount / totalQ) * 100)
  const canSubmit = answer.trim().length >= MIN_ANSWER_CHARS && !submitMutation.isPending && !waitingForNext && !sessionDone

  return (
    <div style={{ height: '100vh', background: '#080D1A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{
        height: 52, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16,
        background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'dot-blink 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{session.job_role || 'Interview'}</span>
          {session.experience_level && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontWeight: 700 }}>
              {session.experience_level}
            </span>
          )}
        </div>

        <div style={{ flex: 2, maxWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Q {Math.min(questionIdx + 1, totalQ)} of {totalQ}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{progress}%</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #10B981)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
          <Clock size={13} />
          <InterviewTimer startTime={startTime} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {networkOk ? <Wifi size={14} color="#10B981" aria-label="Network connected" /> : <WifiOff size={14} color="#EF4444" aria-label="Network disconnected" />}
          {aiSpeech.speaking && <Volume2 size={14} color="#818CF8" aria-label="AI is speaking" />}
        </div>

        <button
          onClick={() => { aiSpeech.setEnabled(e => !e); if (aiSpeech.speaking) aiSpeech.cancel() }}
          aria-label={aiSpeech.enabled ? 'Mute AI voice' : 'Unmute AI voice'}
          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: aiSpeech.enabled ? '#818CF8' : '#475569', padding: '6px 8px', borderRadius: 8 }}
        >
          {aiSpeech.enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      {/* ── Offline banner ── */}
      {!networkOk && (
        <div role="alert" style={{ background: '#7F1D1D', padding: '6px 20px', fontSize: 12, color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <WifiOff size={12} />
          You're offline. Your answer won't submit until the connection is restored.
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 272px', overflow: 'hidden', minHeight: 0 }}>

        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 14px 14px 16px', gap: 12 }}>

          {/* ── Video tiles ── */}
          <div style={{ display: 'flex', gap: 12, height: '42%', flexShrink: 0 }}>
            <AIVideoTile state={aiState} questionText={questionText} />
            <UserVideoTile
              videoRef={camera.videoRef}
              camOn={camera.camOn}
              micOn={camera.micOn}
              audioLevel={camera.audioLevel}
              cameraError={camera.error}
              toggleCam={camera.toggleCam}
              onToggleMic={() => camera.toggleMic(micNowOn => micNowOn ? voice.start() : voice.stop())}
            />
          </div>

          {/* ── Transcript ── */}
          <div
            ref={transcriptRef}
            role="log"
            aria-label="Interview transcript"
            aria-live="polite"
            style={{
              flex: 1, overflowY: 'auto', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 14px',
            }}
          >
            {transcript.map((entry, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 8, marginBottom: 10,
                justifyContent: entry.role === 'candidate' ? 'flex-end' : 'flex-start',
              }}>
                {entry.role === 'ai' && (
                  <div aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 2 }}>🤖</div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: entry.role === 'ai' ? '#818CF8' : '#34D399' }}>
                      {entry.role === 'ai' ? 'Alex' : 'You'}
                    </span>
                    {entry.isFollowUp && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', color: '#FBBF24', fontWeight: 700 }}>Follow-up</span>
                    )}
                    {entry.questionType && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818CF8', fontWeight: 700, textTransform: 'capitalize' }}>{entry.questionType}</span>
                    )}
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: entry.role === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                    background: entry.role === 'ai' ? 'rgba(99,102,241,0.1)' : 'rgba(52,211,153,0.08)',
                    border: `1px solid ${entry.role === 'ai' ? 'rgba(99,102,241,0.15)' : 'rgba(52,211,153,0.12)'}`,
                    fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6,
                  }}>
                    {entry.text}
                  </div>
                </div>
                {entry.role === 'candidate' && (
                  <div aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <User size={12} color="#34D399" />
                  </div>
                )}
              </div>
            ))}

            {waitingForNext && (
              <div role="status" aria-label="Alex is thinking">
                <TypingIndicator
                  avatarContent="🤖"
                  avatarBg="linear-gradient(135deg,#6366F1,#8B5CF6)"
                  dotColor="#818CF8"
                  bubbleBg="rgba(99,102,241,0.08)"
                />
              </div>
            )}
          </div>

          {/* ── Answer input ── */}
          {!sessionDone ? (
            <div style={{ flexShrink: 0 }}>

              {/* Live transcript preview — shows voice input in real time */}
              {voice.listening && answer.length > 0 && (
                <div style={{
                  marginBottom: 10, padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)',
                  animation: 'fade-slide-up 0.2s ease',
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{answer}"
                  </p>
                </div>
              )}

              {/* Mic-first row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 4 }}>

                {/* Big mic button — primary action */}
                {!waitingForNext && !submitMutation.isPending && (
                  <button
                    onClick={() => voice.listening ? voice.stop() : voice.start()}
                    aria-label={voice.listening ? 'Stop recording' : 'Start recording your answer'}
                    style={{
                      width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: voice.listening
                        ? 'linear-gradient(135deg, #065F46, #10B981)'
                        : 'linear-gradient(135deg, #3730A3, #6366F1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.25s',
                      animation: voice.listening ? 'mic-live 1.4s ease-in-out infinite' : 'mic-idle 3s ease-in-out infinite',
                      flexShrink: 0,
                    }}
                  >
                    {voice.listening
                      ? <Square size={22} color="white" fill="white" />
                      : <Mic size={24} color="white" />
                    }
                  </button>
                )}

                {/* Waiting / submitting state replaces mic */}
                {(waitingForNext || submitMutation.isPending) && (
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Loader size={22} color="#818CF8" style={{ animation: 'spin 0.9s linear infinite' }} />
                  </div>
                )}

                {/* Send button — appears once there's enough text */}
                {canSubmit && (
                  <button
                    onClick={() => submitMutation.mutate()}
                    aria-label="Send answer"
                    style={{
                      height: 44, padding: '0 20px', borderRadius: 22, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                      color: 'white', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 7,
                      boxShadow: '0 4px 16px rgba(45,106,79,0.4)',
                      animation: 'fade-slide-up 0.2s ease',
                    }}
                  >
                    <Send size={14} /> Send answer
                  </button>
                )}

                {/* End call button */}
                {answeredCount > 0 && (
                  <button
                    onClick={() => completeMutation.mutate()}
                    aria-label="End interview"
                    title="End interview and generate report"
                    style={{
                      width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    } as React.CSSProperties}
                  >
                    <PhoneOff size={15} color="#F87171" />
                  </button>
                )}
              </div>

              {/* Status label under mic */}
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                {waitingForNext || submitMutation.isPending ? (
                  <span style={{ fontSize: 11, color: '#818CF8' }}>Alex is thinking...</span>
                ) : voice.listening ? (
                  <span style={{ fontSize: 11, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'dot-blink 1s infinite' }} />
                    Listening — tap to stop
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                    Tap mic to answer
                  </span>
                )}
              </div>

              {/* Fallback: type instead toggle */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  onClick={() => setShowTextarea(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.22)', textDecoration: 'underline', padding: 0 }}
                >
                  {showTextarea ? 'Hide keyboard' : 'Type instead'}
                </button>
                {answeredCount > 0 && !sessionDone && (
                  <button
                    onClick={() => completeMutation.mutate()}
                    aria-label="Skip to results"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.22)', display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 16 }}
                  >
                    <SkipForward size={10} /> Skip to results
                  </button>
                )}
              </div>

              {/* Textarea — hidden by default, revealed on demand */}
              {showTextarea && (
                <div style={{ marginTop: 10, animation: 'fade-slide-up 0.2s ease' }}>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && canSubmit) { e.preventDefault(); submitMutation.mutate() }
                      }}
                      placeholder="Type your answer here... (Enter to send)"
                      disabled={waitingForNext || submitMutation.isPending}
                      rows={3}
                      maxLength={5000}
                      aria-label="Type your answer"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.5,
                        outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, padding: '0 2px' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                      {answer.length < MIN_ANSWER_CHARS
                        ? `${MIN_ANSWER_CHARS - answer.length} more characters needed`
                        : `${answer.length} / 5000`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flexShrink: 0, textAlign: 'center', padding: '12px 0' }}>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                aria-label="View my interview report"
                style={{
                  padding: '12px 32px', borderRadius: 12, border: 'none', cursor: completeMutation.isPending ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg,#2D6A4F,#40916C)', color: 'white',
                  fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(45,106,79,0.4)',
                  opacity: completeMutation.isPending ? 0.7 : 1,
                }}
              >
                {completeMutation.isPending
                  ? <><Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating report...</>
                  : <><CheckCircle size={16} /> View My Report</>
                }
              </button>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '16px 14px', background: 'rgba(15,23,42,0.6)' }}>
          <h3 style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Skills Being Assessed
          </h3>
          {(session.blueprint?.skills_to_assess ?? []).map((skill: string, i: number) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 8, marginBottom: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <div aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{skill}</span>
            </div>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />

          <h3 style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Tips
          </h3>
          {[
            'Use STAR method for behavioural questions',
            'Quantify impact with numbers',
            'Be concise — 2–3 minutes per answer',
            'Ask for clarification if needed',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
              <ChevronRight size={11} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}

          {answeredCount > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
              <h3 style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Progress</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: 'white' }}>{answeredCount}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>/ {totalQ} answered</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#6366F1,#10B981)', borderRadius: 5, transition: 'width 0.6s' }} />
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes ring-pulse { 0%,100% { transform:scale(1);opacity:0.5 } 50% { transform:scale(1.07);opacity:1 } }
        @keyframes dot-blink { 0%,100% { opacity:1 } 50% { opacity:0.15 } }
        @keyframes dot-bounce { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
        @keyframes avatar-breathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.03) } }
        @keyframes bg-breathe { 0%,100% { opacity:0.5 } 50% { opacity:1 } }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(36px) rotate(0deg) }
          to   { transform: rotate(360deg) translateX(36px) rotate(-360deg) }
        }
        @keyframes voice-bar-0 { 0%,100% { height:4px } 50% { height:22px } }
        @keyframes voice-bar-1 { 0%,100% { height:4px } 50% { height:34px } }
        @keyframes voice-bar-2 { 0%,100% { height:4px } 50% { height:16px } }
        @keyframes mic-idle { 0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,0.4) } 50% { box-shadow:0 0 0 10px rgba(99,102,241,0) } }
        @keyframes mic-live { 0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,0.6),0 0 0 8px rgba(16,185,129,0) } 50% { box-shadow:0 0 0 8px rgba(16,185,129,0.2),0 0 0 16px rgba(16,185,129,0) } }
        @keyframes fade-slide-up { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }
      `}</style>
    </div>
  )
}
