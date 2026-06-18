import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import {
  CheckCircle, Video, Mic, Wifi, Play, Clock, User,
  Briefcase, Target, ChevronRight, AlertCircle, Volume2
} from 'lucide-react'

function DevicePill({ icon, label, ok }: { icon: React.ReactNode; label: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 20,
      background: ok ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`,
    }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color: ok ? '#16A34A' : '#DC2626' }}>{label}</span>
      {ok
        ? <CheckCircle size={11} color="#16A34A" />
        : <AlertCircle size={11} color="#DC2626" />
      }
    </div>
  )
}

export default function InterviewLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camOk, setCamOk] = useState(false)
  const [micOk, setMicOk] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)

  const { data: session, isLoading } = useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: () => interviewApi.getSession(sessionId!),
    enabled: !!sessionId,
  })

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCamOk(true)
        setMicOk(true)

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
          animFrameRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const blueprint = session?.blueprint

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Preparing your interview...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>AI Interview Platform</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <DevicePill icon={<Video size={11} color={camOk ? '#16A34A' : '#DC2626'} />} label="Camera" ok={camOk} />
          <DevicePill icon={<Mic size={11} color={micOk ? '#16A34A' : '#DC2626'} />} label="Microphone" ok={micOk} />
          <DevicePill icon={<Wifi size={11} color="#16A34A" />} label="Connected" ok={true} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0 }}>
        {/* Left: Camera preview + info */}
        <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Camera */}
          <div style={{
            borderRadius: 20, overflow: 'hidden', background: '#1E293B',
            position: 'relative', aspectRatio: '16/9', maxWidth: 600,
          }}>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
            />
            {!camOk && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <Video size={40} color="rgba(255,255,255,0.3)" />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                  Camera access required<br />
                  <span style={{ fontSize: 11 }}>Allow camera in your browser settings</span>
                </p>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <User size={12} color="white" />
              <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>You (Candidate)</span>
            </div>
          </div>

          {/* Audio level meter */}
          <div style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Mic size={13} color={micOk ? '#10B981' : '#64748B'} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Microphone Level</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${audioLevel}%`, height: '100%', borderRadius: 6,
                background: audioLevel > 60 ? '#10B981' : audioLevel > 20 ? '#F59E0B' : '#64748B',
                transition: 'width 0.1s ease, background 0.3s ease',
              }} />
            </div>
            {micOk && audioLevel < 5 && (
              <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 6 }}>Speak now to test your microphone...</p>
            )}
          </div>

          {/* Interview summary */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px 20px', maxWidth: 600, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: <Briefcase size={14} color="#818CF8" />, label: 'Role', value: session?.job_role || 'General' },
                { icon: <User size={14} color="#34D399" />, label: 'Level', value: session?.experience_level || 'Mid-Level' },
                { icon: <Target size={14} color="#F472B6" />, label: 'Questions', value: `${session?.total_questions || 0}` },
                { icon: <Clock size={14} color="#FBBF24" />, label: 'Est. Duration', value: `~${Math.round((session?.total_questions || 8) * 3)} min` },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    {item.icon}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Blueprint + start */}
        <div style={{
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          padding: '32px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {/* AI Interviewer intro */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 14px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              boxShadow: '0 0 0 4px rgba(99,102,241,0.2)',
            }}>🤖</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 6 }}>Meet Alex</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Your AI interviewer for today's session. Alex has conducted thousands of interviews for
              {session?.job_role ? ` ${session.job_role}` : ' tech'} roles and will evaluate you
              against real industry benchmarks.
            </p>
          </div>

          {/* Blueprint / skills */}
          {blueprint && (
            <div>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Skills Being Assessed
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blueprint.skills_to_assess.map((skill, i) => (
                  <div key={i} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}>{skill}</div>
                ))}
              </div>
            </div>
          )}

          {/* Opening greeting */}
          {blueprint?.opening_greeting && (
            <div style={{
              background: 'rgba(99,102,241,0.08)', borderRadius: 14, padding: '14px 16px',
              border: '1px solid rgba(99,102,241,0.15)',
            }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Volume2 size={13} color="#818CF8" />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alex will say</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
                "{blueprint.opening_greeting}"
              </p>
            </div>
          )}

          {/* Tips */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Quick Tips
            </h3>
            {[
              'Speak clearly and at a natural pace',
              'Use specific examples and numbers',
              'Structure answers: Situation → Task → Action → Result',
              "It's okay to take 5 seconds to think",
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <ChevronRight size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
          </div>

          {/* Start button */}
          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={() => {
                streamRef.current?.getTracks().forEach(t => t.stop())
                navigate(`/app/interview/room/${sessionId}`)
              }}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 14, cursor: 'pointer',
                background: 'white',
                border: 'none', color: '#15130F', fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 24px rgba(255,255,255,0.2)',
              }}
            >
              <Play size={16} fill="#15130F" />
              Begin Interview
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>
              The interview will start immediately. Make sure you're ready.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}
