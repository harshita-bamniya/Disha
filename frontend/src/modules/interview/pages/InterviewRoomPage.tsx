import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { interviewApi, type InterviewQuestion } from '@/api/interview'
import {
  Mic, MicOff, Video, VideoOff, Send, Clock, CheckCircle,
  AlertCircle, Wifi, WifiOff, ChevronRight, Square,
  Volume2, VolumeX, User, Loader, SkipForward
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: Date
  isFollowUp?: boolean
  questionType?: string | null
  skillAssessed?: string | null
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const animRef = useRef<number>(0)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setActive(true)

        const ctx = new AudioContext()
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
      .catch(() => {})

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted })
    setMuted(m => !m)
  }

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !active })
    setActive(a => !a)
  }

  return { videoRef, active, muted, audioLevel, toggleMic, toggleCam }
}

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('')
      onResult(transcript)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }, [onResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, start, stop }
}

function useAISpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string) => {
    if (!enabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95
    utt.pitch = 1
    utt.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang === 'en-US')
    if (preferred) utt.voice = preferred
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    utteranceRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [enabled])

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  return { speaking, enabled, setEnabled, speak, cancel }
}

// ── Typewriter text ────────────────────────────────────────────────────────────

function TypewriterText({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(id); onDone?.() }
    }, speed)
    return () => clearInterval(id)
  }, [text])
  return <>{displayed}</>
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────

function AIAvatar({ state }: { state: 'idle' | 'thinking' | 'speaking' }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {state === 'speaking' && (
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: '2px solid rgba(99,102,241,0.5)',
          animation: 'ring-pulse 1.2s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: state === 'thinking'
          ? 'linear-gradient(135deg, #1E293B, #334155)'
          : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        border: `3px solid ${state === 'speaking' ? '#818CF8' : 'rgba(255,255,255,0.1)'}`,
        transition: 'border-color 0.3s, background 0.5s',
      }}>
        {state === 'thinking' ? '💭' : '🤖'}
      </div>
      <div style={{
        position: 'absolute', bottom: 3, right: 3,
        width: 14, height: 14, borderRadius: '50%',
        background: state === 'idle' ? '#64748B' : state === 'thinking' ? '#F59E0B' : '#10B981',
        border: '2px solid #0F172A',
        animation: state !== 'idle' ? 'dot-blink 1s ease-in-out infinite' : 'none',
      }} />
    </div>
  )
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

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
  const [pendingResponseId, setPendingResponseId] = useState<string | null>(null)
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [networkOk] = useState(true)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const lastResponseIdRef = useRef<string | null>(null)
  const initDoneRef = useRef(false)

  const camera = useCamera()
  const aiSpeech = useAISpeech()

  const onVoiceResult = useCallback((text: string) => {
    setAnswer(text)
  }, [])
  const voice = useVoiceInput(onVoiceResult)

  const { data: session, isLoading } = useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: () => interviewApi.getSession(sessionId!),
    enabled: !!sessionId,
  })

  // Start session + present first question (fires exactly once)
  useEffect(() => {
    if (!session || initDoneRef.current) return
    initDoneRef.current = true

    interviewApi.startSession(sessionId!).catch(() => {})

    const greeting = session.blueprint?.opening_greeting
      || `Welcome! I'm Alex, your AI interviewer for the ${session.job_role || 'interview'} today. Let's get started.`
    const iceBreaker = session.blueprint?.ice_breaker_question

    const firstQ = iceBreaker || session.questions[0]?.question_text || "Tell me about yourself and your background."
    const firstQData = !iceBreaker ? session.questions[0] : null

    setAiState('speaking')
    const greetEntry: TranscriptEntry = { role: 'ai', text: greeting, timestamp: new Date() }
    setTranscript([greetEntry])
    aiSpeech.speak(greeting)

    setTimeout(() => {
      const qEntry: TranscriptEntry = {
        role: 'ai', text: firstQ, timestamp: new Date(),
        questionType: firstQData?.question_type,
        skillAssessed: firstQData?.skill_assessed,
      }
      setTranscript(t => {
        const alreadyAdded = t.some(e => e.role === 'ai' && e.text === firstQ)
        return alreadyAdded ? t : [...t, qEntry]
      })
      setQuestionText(firstQ)
      setCurrentQuestion(firstQData)
      aiSpeech.speak(firstQ)
      setResponseStartTime(Date.now())
      setTimeout(() => setAiState('idle'), 3000)
    }, 2500)
  }, [session])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const submitMutation = useMutation({
    mutationFn: async () => {
      const elapsed = Math.round((Date.now() - responseStartTime) / 1000)
      return interviewApi.submitResponse(sessionId!, {
        question_id: currentQuestion?.is_dynamic ? currentQuestion.id : (currentQuestion?.id ?? undefined),
        question_text: questionText,
        question_type: currentQuestion?.question_type ?? undefined,
        response_text: answer.trim(),
        response_time_sec: elapsed,
      })
    },
    onSuccess: async (result) => {
      const userEntry: TranscriptEntry = { role: 'candidate', text: answer.trim(), timestamp: new Date() }
      setTranscript(t => [...t, userEntry])
      setAnswer('')
      voice.stop()

      const respId = result.response_id
      lastResponseIdRef.current = respId
      setAnsweredCount(c => c + 1)
      setWaitingForNext(true)
      setAiState('thinking')

      setTimeout(async () => {
        try {
          const next = await interviewApi.getNextQuestion(sessionId!, respId)
          setWaitingForNext(false)

          if (next.session_complete || !next.question) {
            setSessionDone(true)
            const doneText = "That concludes our interview. Thank you for your time and thoughtful answers. I'll now compile your results and generate your detailed report."
            setTranscript(t => [...t, { role: 'ai', text: doneText, timestamp: new Date() }])
            setAiState('speaking')
            aiSpeech.speak(doneText)
            setTimeout(() => setAiState('idle'), 4000)
            return
          }

          const nextText = next.question.text
          const nextQData: InterviewQuestion | null = next.question.id
            ? {
                id: next.question.id,
                question_text: nextText,
                question_type: next.question.question_type ?? null,
                difficulty: next.question.difficulty ?? null,
                language: 'en',
                career_track_id: null,
                is_dynamic: true,
              }
            : null

          if (next.coaching_note) {
            setTimeout(() => {
              const coachEntry: TranscriptEntry = {
                role: 'ai',
                text: nextText,
                timestamp: new Date(),
                isFollowUp: next.action !== 'next_question',
                questionType: nextQData?.question_type,
              }
              setTranscript(t => [...t, coachEntry])
              setQuestionText(nextText)
              setCurrentQuestion(nextQData)
              setQuestionIdx(i => i + 1)
              setResponseStartTime(Date.now())
              setAiState('speaking')
              aiSpeech.speak(nextText)
              setTimeout(() => setAiState('idle'), nextText.length * 80)
            }, 800)
          }
        } catch {
          setWaitingForNext(false)
          setAiState('idle')
        }
      }, 1200)
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
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Starting interview...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (completing) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🧠</div>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 8 }}>Analyzing your performance...</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>AI is generating your Job Readiness Report. This takes ~10 seconds.</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {['Evaluating answers', 'Scoring competencies', 'Building roadmap'].map((t, i) => (
            <div key={t} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11,
              background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)',
              animation: `fade-in 0.4s ease ${i * 0.3}s both`,
            }}>{t}</div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )

  const totalQ = session.total_questions
  const progress = Math.round((answeredCount / totalQ) * 100)
  const canSubmit = answer.trim().length > 10 && !submitMutation.isPending && !waitingForNext && !sessionDone

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div style={{
        height: 54, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16,
        borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0B1120', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>
            {session.job_role || 'Interview'}
          </div>
          {session.experience_level && (
            <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontWeight: 700 }}>
              {session.experience_level}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ flex: 2, maxWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Question {Math.min(questionIdx + 1, totalQ)} of {totalQ}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{progress}% complete</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #10B981)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
          <Clock size={13} />
          <InterviewTimer startTime={startTime} />
        </div>

        {/* Status indicators */}
        <div style={{ display: 'flex', gap: 8 }}>
          {networkOk
            ? <Wifi size={14} color="#10B981" />
            : <WifiOff size={14} color="#EF4444" />
          }
          {aiSpeech.speaking && <Volume2 size={14} color="#818CF8" />}
        </div>

        {/* Voice toggle */}
        <button
          onClick={() => { aiSpeech.setEnabled(e => !e); if (aiSpeech.speaking) aiSpeech.cancel() }}
          title={aiSpeech.enabled ? 'Mute AI voice' : 'Unmute AI voice'}
          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: aiSpeech.enabled ? '#818CF8' : '#475569', padding: '6px 8px', borderRadius: 8 }}
        >
          {aiSpeech.enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>

        {/* End interview */}
        {(sessionDone || answeredCount > 0) && (
          <button
            onClick={() => completeMutation.mutate()}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: sessionDone ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : 'rgba(239,68,68,0.15)',
              color: sessionDone ? 'white' : '#F87171', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {sessionDone ? <><CheckCircle size={12} /> Get Report</> : <><Square size={12} /> End</>}
          </button>
        )}
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Left: interview content */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* AI + Candidate video row */}
          <div style={{ display: 'flex', gap: 16, padding: '16px 20px', flexShrink: 0 }}>
            {/* AI Interviewer */}
            <div style={{
              flex: 1, background: 'linear-gradient(135deg, #1E1B4B, #1E293B)', borderRadius: 16, padding: '20px',
              display: 'flex', gap: 16, alignItems: 'center', border: '1px solid rgba(99,102,241,0.2)',
              minHeight: 120,
            }}>
              <AIAvatar state={aiState} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>Alex</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 600 }}>
                    {aiState === 'thinking' ? 'Thinking...' : aiState === 'speaking' ? 'Speaking' : 'AI Interviewer'}
                  </span>
                  {aiState === 'speaking' && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 3, background: '#818CF8', borderRadius: 2, animation: `bar-bounce 0.6s ease-in-out ${i * 0.12}s infinite` }} className="audio-bar" />
                      ))}
                    </div>
                  )}
                </div>
                {questionText && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>
                    {questionText}
                  </p>
                )}
              </div>
            </div>

            {/* Candidate camera */}
            <div style={{
              width: 200, borderRadius: 16, overflow: 'hidden', background: '#1E293B',
              position: 'relative', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
            }}>
              <video
                ref={camera.videoRef}
                muted
                playsInline
                autoPlay
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  transform: 'scaleX(-1)',
                  filter: camera.active ? 'none' : 'brightness(0)',
                }}
              />
              {!camera.active && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VideoOff size={24} color="rgba(255,255,255,0.3)" />
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                <button
                  onClick={camera.toggleMic}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: camera.muted ? '#EF4444' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {camera.muted ? <MicOff size={13} color="white" /> : <Mic size={13} color="white" />}
                </button>
                <button
                  onClick={camera.toggleCam}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: !camera.active ? '#EF4444' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {!camera.active ? <VideoOff size={13} color="white" /> : <Video size={13} color="white" />}
                </button>
              </div>
              <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px' }}>
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>You</span>
              </div>
              {!camera.muted && (
                <div style={{ position: 'absolute', bottom: 44, left: 8, right: 8 }}>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                    <div style={{ width: `${camera.audioLevel}%`, height: '100%', background: '#10B981', borderRadius: 3, transition: 'width 0.1s' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
            {transcript.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', gap: 10, marginBottom: 14,
                  justifyContent: entry.role === 'candidate' ? 'flex-end' : 'flex-start',
                }}
              >
                {entry.role === 'ai' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>🤖</div>
                )}
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: entry.role === 'ai' ? '#818CF8' : '#34D399' }}>
                      {entry.role === 'ai' ? 'Alex' : 'You'}
                    </span>
                    {entry.isFollowUp && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'rgba(251,191,36,0.15)', color: '#FBBF24', fontWeight: 700 }}>
                        Follow-up
                      </span>
                    )}
                    {entry.questionType && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#818CF8', fontWeight: 700, textTransform: 'capitalize' }}>
                        {entry.questionType}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{
                    padding: '10px 14px', borderRadius: entry.role === 'ai' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                    background: entry.role === 'ai' ? 'rgba(99,102,241,0.1)' : 'rgba(52,211,153,0.08)',
                    border: `1px solid ${entry.role === 'ai' ? 'rgba(99,102,241,0.15)' : 'rgba(52,211,153,0.12)'}`,
                    fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7,
                  }}>
                    {idx === transcript.length - 1 && entry.role === 'ai'
                      ? <TypewriterText text={entry.text} />
                      : entry.text
                    }
                  </div>
                </div>
                {entry.role === 'candidate' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <User size={14} color="#34D399" />
                  </div>
                )}
              </div>
            ))}

            {waitingForNext && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
                <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#818CF8', animation: `dot-bounce 0.8s ease-in-out ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Answer input */}
          {!sessionDone && (
            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <button
                  onClick={() => voice.listening ? voice.stop() : voice.start()}
                  style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: voice.listening ? '#EF4444' : 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: voice.listening ? 'ring-pulse 1.2s ease-in-out infinite' : 'none',
                    transition: 'background 0.2s',
                  }}
                  title={voice.listening ? 'Stop voice input' : 'Start voice input'}
                >
                  {voice.listening ? <MicOff size={16} color="white" /> : <Mic size={16} color="#818CF8" />}
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    ref={answerRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
                        e.preventDefault()
                        submitMutation.mutate()
                      }
                    }}
                    placeholder={waitingForNext ? 'Alex is thinking...' : 'Type your answer or use voice input... (Enter to send, Shift+Enter for new line)'}
                    disabled={waitingForNext || submitMutation.isPending || sessionDone}
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.6,
                      outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                  {voice.listening && (
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 2, alignItems: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', animation: 'dot-blink 1s infinite' }} />
                      <span style={{ fontSize: 10, color: '#F87171' }}>Listening</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => canSubmit && submitMutation.mutate()}
                  disabled={!canSubmit}
                  style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', flexShrink: 0,
                    background: canSubmit ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
                  }}
                >
                  {submitMutation.isPending
                    ? <Loader size={15} color="white" style={{ animation: 'spin 0.8s linear infinite' }} />
                    : <Send size={15} color={canSubmit ? 'white' : '#475569'} />
                  }
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {answer.length > 0 ? `${answer.length} chars` : 'Minimum ~2 sentences for best evaluation'}
                </span>
                {answeredCount > 0 && !sessionDone && (
                  <button
                    onClick={() => setSessionDone(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <SkipForward size={11} /> Skip to results
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Session done CTA */}
          {sessionDone && (
            <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
                Interview complete. Ready to see your results?
              </p>
              <button
                onClick={() => completeMutation.mutate()}
                style={{
                  padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #2D6A4F, #40916C)', color: 'white',
                  fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(45,106,79,0.4)',
                }}
              >
                <CheckCircle size={16} /> View My Report
              </button>
            </div>
          )}
        </div>

        {/* Right: Skills sidebar */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '16px' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Skills Being Assessed
          </h3>
          {(session.blueprint?.skills_to_assess || []).map((skill, i) => (
            <div key={i} style={{
              padding: '8px 12px', borderRadius: 10, marginBottom: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{skill}</span>
            </div>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Tips
          </h3>
          {[
            'Use the STAR method for behavioral questions',
            'Quantify your impact with numbers',
            'Be concise — 2-3 minutes per answer',
            "Ask for clarification if needed",
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <ChevronRight size={12} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}

          {answeredCount > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Progress
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: 'white' }}>{answeredCount}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>/ {totalQ} answered</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #10B981)', borderRadius: 6, transition: 'width 0.6s' }} />
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6 }
          50% { transform: scale(1.08); opacity: 1 }
        }
        @keyframes dot-blink {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.2 }
        }
        @keyframes dot-bounce {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-4px) }
        }
        @keyframes bar-bounce {
          0%, 100% { height: 6px }
          50% { height: 14px }
        }
        .audio-bar { min-height: 6px; }
      `}</style>
    </div>
  )
}
