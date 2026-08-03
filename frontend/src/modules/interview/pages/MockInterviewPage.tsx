import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { counsellorApi } from '@/api/counsellor'
import { krsApi, type LiveJob } from '@/api/krs'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import AppSidebar from '@/components/layout/AppSidebar'
import { Mic, MicOff, Send, ChevronRight, User, BarChart2, CheckCircle, ArrowLeft, Loader } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type InterviewType = 'hr' | 'technical' | 'stress'
type Phase = 'setup' | 'interview' | 'report'

interface Persona {
  id: InterviewType
  name: string
  role: string
  avatar: string
  color: string
  description: string
}

const PERSONAS: Persona[] = [
  {
    id: 'hr',
    name: 'Priya Sharma',
    role: 'Senior HR Manager',
    avatar: '👩‍💼',
    color: '#2D6A4F',
    description: 'Friendly screening — cultural fit, motivation, background, salary discussion.',
  },
  {
    id: 'technical',
    name: 'Arjun Mehta',
    role: 'Senior Technical Lead',
    avatar: '👨‍💻',
    color: '#3B82F6',
    description: 'Deep dive — domain knowledge, past projects, problem-solving ability.',
  },
  {
    id: 'stress',
    name: 'Meera Iyer',
    role: 'Director of Operations',
    avatar: '🎯',
    color: '#DC2626',
    description: 'High pressure — pushes back on every answer to test resilience and clarity.',
  },
]

// ── Message bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg, persona }: { msg: any; persona: Persona }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16, animation: 'fadeIn 0.3s ease' }}>
      {!isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `${persona.color}18`, border: `2px solid ${persona.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, marginRight: 10, marginTop: 2,
        }}>{persona.avatar}</div>
      )}
      <div style={{
        maxWidth: '75%',
        background: isUser ? '#2563EB' : 'white',
        color: isUser ? 'white' : '#1e293b',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 14, lineHeight: 1.7,
        boxShadow: isUser ? '0 4px 14px rgba(59,130,246,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
        border: isUser ? 'none' : '1px solid rgba(226,232,240,0.8)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
        {msg.streaming && (
          <span style={{ display: 'inline-block', width: 8, height: 8, background: '#94A3B8', borderRadius: '50%', marginLeft: 4, animation: 'blink 1s infinite' }} />
        )}
      </div>
      {isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: '#2563EB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 10, marginTop: 2,
        }}>
          <User size={16} color="white" />
        </div>
      )}
    </div>
  )
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 70 ? '#10B981' : score >= 45 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={size * 0.22} fontWeight={800} fill={color}>{score}</text>
    </svg>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MockInterviewPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('setup')
  const [selectedType, setSelectedType] = useState<InterviewType>('hr')
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [interviewDone, setInterviewDone] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const autoStartedRef = useRef(false)
  const hiddenTrigger = useRef<string>('')
  const lastSpokenId = useRef<string>('')

  // Fetch specific job if jobId in URL, else fall back to active prep job
  const { data: jobs } = useQuery({
    queryKey: ['krs-live-jobs'],
    queryFn: krsApi.getLiveJobs,
    enabled: !!jobId,
  })
  const { activePrep } = useActivePrepJob()

  const job: any = jobId
    ? jobs?.find((j: any) => j.id === jobId)
    : activePrep
      ? { id: activePrep.job_id, title: activePrep.job_title, company_name: activePrep.company_name, sector: activePrep.sector, required_skills: activePrep.required_skills }
      : null

  const persona = PERSONAS.find(p => p.id === selectedType)!

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Text-to-Speech ────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-IN'
    utter.rate = 0.92
    utter.pitch = 1.05

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
        || voices.find(v => v.lang === 'en-IN')
        || voices.find(v => v.lang.startsWith('en-'))
        || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.onstart = () => setIsSpeaking(true)
      utter.onend = () => setIsSpeaking(false)
      utter.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utter)
    }

    // Voices may not be loaded yet on first call
    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => { doSpeak(); window.speechSynthesis.onvoiceschanged = null }
    }
  }, [])

  // Auto-speak new AI messages when they finish streaming
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || last.streaming) return
    if (last.id === lastSpokenId.current) return
    lastSpokenId.current = last.id
    speak(last.content)

    // Detect interview end signal from AI
    const lower = last.content.toLowerCase()
    if (
      lower.includes("that's all from my side") ||
      lower.includes("that is all from my side") ||
      lower.includes("do you have any questions for me") ||
      lower.includes("this concludes our interview") ||
      lower.includes("thank you for your time today") ||
      lower.includes("it was great speaking with you")
    ) {
      setInterviewDone(true)
    }
  }, [messages, speak])

  // Stop speech when leaving interview
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  // ── Speech-to-Text ────────────────────────────────────────────────────────
  const sendMsgRef = useRef<((text: string) => void) | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef('')
  const [liveTranscript, setLiveTranscript] = useState('')

  const stopVoice = useCallback((submit: boolean) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
    setIsListening(false)
    setLiveTranscript('')
    if (submit && finalTranscriptRef.current.trim()) {
      sendMsgRef.current?.(finalTranscriptRef.current.trim())
      finalTranscriptRef.current = ''
    }
  }, [])

  const startVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Speech recognition is not supported in this browser. Please use Chrome.'); return }
    window.speechSynthesis?.cancel()
    finalTranscriptRef.current = ''
    setLiveTranscript('')

    const rec = new SR()
    rec.lang = 'en-IN'
    rec.continuous = true       // keep listening until user stops
    rec.interimResults = true   // show live text as user speaks

    rec.onresult = (e: any) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (final) finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + final.trim()
      setLiveTranscript((finalTranscriptRef.current + (interim ? ' ' + interim : '')).trim())

      // Auto-send only after 1 minute of no speech (safety fallback)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => stopVoice(true), 60000)
    }

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.error('SpeechRecognition error:', e.error)
      setIsListening(false)
      setLiveTranscript('')
    }

    // Chrome stops continuous recognition after ~60s — restart transparently
    rec.onend = () => {
      if (recognitionRef.current === rec && isListeningRef.current) {
        try { rec.start() } catch {}
      }
    }

    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [stopVoice])

  const isListeningRef = useRef(false)
  useEffect(() => { isListeningRef.current = isListening }, [isListening])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopVoice(true) // stop and send whatever was spoken
    } else {
      startVoice()
    }
  }, [isListening, startVoice, stopVoice])

  // Send a message
  const sendMsg = useCallback(async (text: string, hidden = false, alreadyAdded = false) => {
    if (!text.trim() || isStreaming || !convId) return
    const userText = text.trim()
    setInput('')

    if (!hidden && !alreadyAdded) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: userText }])
    }

    const aid = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '', streaming: true }])
    setIsStreaming(true)
    let full = ''

    await counsellorApi.sendMessage(
      convId, userText,
      chunk => {
        full += chunk
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: full } : m))
      },
      () => {
        setIsStreaming(false)
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, streaming: false } : m))
      },
      () => {
        setIsStreaming(false)
        setMessages(prev => prev.filter(m => m.id !== aid))
      }
    )
  }, [convId, isStreaming])

  // Keep ref in sync so startVoice (captured early) can call latest sendMsg
  useEffect(() => {
    sendMsgRef.current = (text: string) => sendMsg(text, false, true)
  }, [sendMsg])

  // Start interview
  const startInterview = async () => {
    setIsStarting(true)
    try {
      const conv = await counsellorApi.createInterviewConversation({
        interviewType: selectedType,
        jobId: job?.id,
        jobTitle: job?.title,
        company: job?.company_name,
        sector: job?.sector,
        keySkills: job?.required_skills?.slice(0, 6) ?? [],
      })
      setConvId(conv.id)
      setPhase('interview')
    } catch (e) {
      console.error(e)
    } finally {
      setIsStarting(false)
    }
  }

  // Auto-start: AI speaks first
  useEffect(() => {
    if (phase === 'interview' && convId && !autoStartedRef.current && !isStreaming) {
      autoStartedRef.current = true
      const trigger = `Please conduct this mock interview. Introduce yourself and ask your first question.`
      hiddenTrigger.current = trigger
      sendMsg(trigger, true)
    }
  }, [phase, convId, isStreaming])

  // Get report
  const getReport = async () => {
    if (!convId) return
    setLoadingReport(true)
    try {
      const r = await counsellorApi.getInterviewReport(convId)
      setReport(r)
      setPhase('report')
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingReport(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input) }
  }

  const verdictColor = (v: string) => {
    if (v?.includes('Strong Hire')) return '#10B981'
    if (v?.includes('Hire')) return '#3B82F6'
    if (v?.includes('Maybe')) return '#F59E0B'
    return '#EF4444'
  }

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div style={{ minHeight: '100vh', background: '#F0F7FF', display: 'flex' }}>
        <AppSidebar activePath="/app/jobs" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: '100%', maxWidth: 560 }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13, marginBottom: 24 }}>
              <ArrowLeft size={14} /> Back
            </button>

            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
              Mock Interview
            </h1>
            {job ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '8px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', width: 'fit-content' }}>
                <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>🎯 {job.title} at {job.company_name}</span>
              </div>
            ) : (
              <div style={{ marginBottom: 28, padding: '8px 14px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA' }}>
                <span style={{ fontSize: 13, color: '#C2410C' }}>⚠️ No active prep job — this will be a general interview.{' '}
                  <a href="/app/jobs" style={{ color: '#1D4ED8', textDecoration: 'underline' }}>Set one from Jobs page</a>
                </span>
              </div>
            )}

            <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>
              Choose your interviewer
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {PERSONAS.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelectedType(p.id)}
                  style={{
                    padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                    background: selectedType === p.id ? `${p.color}08` : 'white',
                    border: selectedType === p.id ? `2px solid ${p.color}` : '2px solid rgba(226,232,240,0.8)',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'all 0.15s',
                    boxShadow: selectedType === p.id ? `0 4px 16px ${p.color}18` : '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ fontSize: 32 }}>{p.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: p.color, fontWeight: 600, background: `${p.color}12`, padding: '2px 8px', borderRadius: 20 }}>{p.role}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{p.description}</p>
                  </div>
                  {selectedType === p.id && <CheckCircle size={18} color={p.color} />}
                </div>
              ))}
            </div>

            <button
              onClick={startInterview}
              disabled={isStarting}
              style={{
                width: '100%', height: 48, borderRadius: 14,
                background: isStarting ? '#E2E8F0' : `linear-gradient(135deg, ${persona.color}, ${persona.color}CC)`,
                color: isStarting ? '#94A3B8' : 'white',
                border: 'none', cursor: isStarting ? 'not-allowed' : 'pointer',
                fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: isStarting ? 'none' : `0 6px 20px ${persona.color}35`,
              }}
            >
              {isStarting ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Starting...</> : <>Start Interview <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── INTERVIEW SCREEN ──────────────────────────────────────────────────────────
  if (phase === 'interview') {
    return (
      <div style={{ minHeight: '100vh', background: '#F0F7FF', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          background: 'white', borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26 }}>{persona.avatar}</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{persona.name}</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>{persona.role}{job ? ` · ${job.title} at ${job.company_name}` : ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {interviewDone ? (
              <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700, background: '#EDE9FE', padding: '3px 10px', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' }}>
                Interview complete!
              </span>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>Live Interview</span>
              </>
            )}
            <button
              onClick={getReport}
              disabled={loadingReport}
              style={{
                marginLeft: 8, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: interviewDone
                  ? 'linear-gradient(135deg, #7C3AED, #8B5CF6)'
                  : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white',
                border: interviewDone ? '2px solid #7C3AED' : 'none',
                cursor: loadingReport ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: interviewDone ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
                opacity: loadingReport ? 0.7 : 1,
              }}
            >
              {loadingReport ? <><Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating...</> : <><BarChart2 size={12} /> {interviewDone ? 'Get My Report' : 'End & Get Report'}</>}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 780, width: '100%', margin: '0 auto' }}>
          {messages.map(m => (
            <Bubble key={m.id} msg={m} persona={persona} />
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 26 }}>{persona.avatar}</div>
              <div style={{ background: 'white', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', border: '1px solid rgba(226,232,240,0.8)', display: 'flex', gap: 5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Interview done banner */}
        {interviewDone && (
          <div style={{
            background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
            borderTop: '1px solid #C4B5FD', padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#5B21B6', margin: 0 }}>Interview complete 🎉</p>
              <p style={{ fontSize: 11, color: '#7C3AED', margin: 0 }}>All questions asked. Click "Get My Report" to see your scorecard.</p>
            </div>
            <button
              onClick={getReport}
              disabled={loadingReport}
              style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                color: 'white', fontSize: 13, fontWeight: 800, flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
              }}
            >
              {loadingReport ? <><Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating...</> : <><BarChart2 size={13} /> Get My Report</>}
            </button>
          </div>
        )}

        {/* Input */}
        <div style={{ background: 'white', borderTop: '1px solid rgba(226,232,240,0.8)', padding: '12px 24px 20px' }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            background: '#F8FAFC', borderRadius: 16,
            border: `1.5px solid ${isListening ? persona.color : isSpeaking ? `${persona.color}50` : 'rgba(226,232,240,0.9)'}`,
            padding: '10px 14px', maxWidth: 780, margin: '0 auto',
            transition: 'border-color 0.2s',
          }}>
            <textarea
              ref={inputRef}
              value={isListening ? liveTranscript : input}
              onChange={e => { if (!isListening) setInput(e.target.value) }}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening... speak now' : 'Type your answer... (Enter to send)'}
              disabled={isStreaming || isListening}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: '#0F172A', lineHeight: 1.6, resize: 'none',
                maxHeight: 120, minHeight: 20, overflowY: 'auto', fontFamily: 'inherit',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            {/* Voice button */}
            <button
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : isSpeaking ? 'Interrupt and speak' : 'Speak your answer'}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: isListening ? persona.color : isSpeaking ? `${persona.color}60` : '#E2E8F0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
                animation: isListening ? 'pulse 1s ease-in-out infinite' : 'none',
                boxShadow: isListening ? `0 0 0 4px ${persona.color}30` : 'none',
              }}
            >
              {isListening
                ? <MicOff size={15} color="white" />
                : <Mic size={15} color={isSpeaking ? persona.color : '#64748B'} />}
            </button>
            <button
              onClick={() => {
                if (isListening) {
                  stopVoice(true)  // stop mic and send spoken text
                } else {
                  sendMsg(input)
                }
              }}
              disabled={isStreaming || (!isListening && !input.trim())}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: (isListening || input.trim()) && !isStreaming
                  ? `linear-gradient(135deg, ${persona.color}, ${persona.color}CC)`
                  : '#E2E8F0',
                border: 'none',
                cursor: (isListening || input.trim()) && !isStreaming ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              }}
            >
              <Send size={14} color={(isListening || input.trim()) && !isStreaming ? 'white' : '#94A3B8'} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 8 }}>
            {isSpeaking
              ? `🔊 ${persona.name} is speaking — click 🎤 to interrupt`
              : isListening
              ? '🎙️ Listening — speak freely, auto-sends after 3s pause · or click 🎤 to send now'
              : '🎤 Click the mic to speak · or type and press Enter'}
          </p>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
          @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
          @keyframes bounce { 0%,60%,100% { transform:translateY(0) } 30% { transform:translateY(-5px) } }
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.7; transform:scale(1.15) } }
        `}</style>
      </div>
    )
  }

  // ── REPORT SCREEN ─────────────────────────────────────────────────────────────
  if (phase === 'report' && report) {
    const vc = verdictColor(report.verdict)
    return (
      <div style={{ minHeight: '100vh', background: '#F0F7FF', display: 'flex' }}>
        <AppSidebar activePath="/app/jobs" />
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <div style={{ fontSize: 40 }}>{persona.avatar}</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>Interview Report</h1>
                <p style={{ fontSize: 13, color: '#64748B' }}>{persona.name} · {job?.title ?? 'Mock Interview'}{job ? ` at ${job.company_name}` : ''}</p>
              </div>
            </div>

            {/* Overall score */}
            <div style={{
              background: 'white', borderRadius: 20, padding: '28px 32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 28,
              border: `2px solid ${vc}20`,
            }}>
              <ScoreRing score={report.overall_score} size={90} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: vc, background: `${vc}12`, padding: '4px 14px', borderRadius: 20, border: `1px solid ${vc}25` }}>
                  {report.verdict}
                </span>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginTop: 10, maxWidth: 460 }}>{report.summary}</p>
              </div>
            </div>

            {/* Competencies */}
            {report.competencies?.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Competency Scores</h3>
                {report.competencies.map((c: any) => {
                  const cc = c.score >= 70 ? '#10B981' : c.score >= 45 ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={c.name} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{c.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cc }}>{c.score}/100</span>
                      </div>
                      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${c.score}%`, height: '100%', background: `linear-gradient(90deg, ${cc}, ${cc}CC)`, borderRadius: 6, transition: 'width 1s ease' }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{c.comment}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Strengths + Improvements */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'white', borderRadius: 20, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #D1FAE5' }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#065F46', marginBottom: 12 }}>✅ Strengths</h3>
                {report.strengths?.map((s: string, i: number) => (
                  <p key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #10B981' }}>{s}</p>
                ))}
              </div>
              <div style={{ background: 'white', borderRadius: 20, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #FEE2E2' }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#991B1B', marginBottom: 12 }}>⚠️ Improve</h3>
                {report.improvements?.map((s: string, i: number) => (
                  <p key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #EF4444' }}>{s}</p>
                ))}
              </div>
            </div>

            {/* Best / Weakest answer */}
            {report.best_answer && (
              <div style={{ background: '#F0FDF4', borderRadius: 16, padding: '16px 20px', marginBottom: 12, border: '1px solid #BBF7D0' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>BEST ANSWER</p>
                <p style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>"{report.best_answer}"</p>
              </div>
            )}
            {report.weakest_answer && (
              <div style={{ background: '#FFF7ED', borderRadius: 16, padding: '16px 20px', marginBottom: 24, border: '1px solid #FED7AA' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', marginBottom: 6 }}>NEEDS WORK</p>
                <p style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>"{report.weakest_answer}"</p>
              </div>
            )}

            {/* Answer-by-answer before / after comparison */}
            {report.answer_analysis?.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Answer-by-Answer Breakdown</h3>
                <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Your original answer vs. a stronger version — study the difference.</p>
                {report.answer_analysis.map((a: any, i: number) => {
                  const sc = a.score >= 70 ? '#10B981' : a.score >= 45 ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={i} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: i < report.answer_analysis.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#64748B', flexShrink: 0 }}>{i + 1}</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flex: 1 }}>{a.question}</p>
                        <span style={{ fontSize: 12, fontWeight: 800, color: sc, background: `${sc}12`, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>{a.score}/100</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#FFF7ED', borderRadius: 12, padding: '12px 14px', border: '1px solid #FED7AA' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Answer</p>
                          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>"{a.original_answer}"</p>
                          {a.what_missed && <p style={{ fontSize: 11, color: '#C2410C', marginTop: 8, borderTop: '1px solid #FED7AA', paddingTop: 8 }}>⚠ {a.what_missed}</p>}
                        </div>
                        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px', border: '1px solid #BBF7D0' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#15803D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stronger Version</p>
                          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{a.rewritten_answer}</p>
                          {a.what_worked && <p style={{ fontSize: 11, color: '#15803D', marginTop: 8, borderTop: '1px solid #BBF7D0', paddingTop: 8 }}>✓ {a.what_worked}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setPhase('setup'); setConvId(null); setMessages([]); autoStartedRef.current = false }}
                style={{ flex: 1, height: 44, borderRadius: 12, background: 'white', border: '1.5px solid rgba(226,232,240,0.9)', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>
                Try Again
              </button>
              <button onClick={() => navigate('/app/jobs')}
                style={{ flex: 1, height: 44, borderRadius: 12, background: '#2563EB', border: 'none', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                Back to Jobs
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
