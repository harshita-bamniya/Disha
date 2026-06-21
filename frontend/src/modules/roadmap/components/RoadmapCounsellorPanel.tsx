import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { counsellorApi } from '@/api/counsellor'
import { Send, Sparkles, MessageSquare, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  jobTitle?: string
  company?: string
  sector?: string
  /** Set by a parent (e.g. an "Ask AI" button on a roadmap topic) to inject and auto-send a question */
  pendingQuestion?: string | null
  /** Called right after the pending question has been sent, so the parent can clear it */
  onPendingQuestionHandled?: () => void
}

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const SUGGESTIONS = (jobTitle?: string) => [
  `What should I focus on first for ${jobTitle ?? 'this role'}?`,
  'How does my current skill gap look for this job?',
  'What kind of interview questions should I expect?',
]

/**
 * AI Counsellor docked permanently into the Roadmap page, scoped to a single job.
 * Uses a dedicated "job_roadmap" conversation type — one continuous thread per
 * job (reused across visits), with a system prompt that only talks about this
 * specific job's prep instead of drifting into generic career advice.
 */
export default function RoadmapCounsellorPanel({ jobId, jobTitle, company, sector, pendingQuestion, onPendingQuestionHandled }: Props) {
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastJobIdRef = useRef<string | null>(null)

  // Reset the thread when the active job changes, so context never bleeds across jobs
  useEffect(() => {
    if (lastJobIdRef.current !== jobId) {
      lastJobIdRef.current = jobId
      setConvId(null)
      setMessages([])
    }
  }, [jobId])

  const ensureConvMutation = useMutation({
    mutationFn: () => counsellorApi.createJobRoadmapConversation({ jobId, jobTitle, company, sector }),
    onSuccess: (conv) => setConvId(conv.id),
  })

  // Eagerly get-or-create the thread for this job on mount, so we can also
  // load any prior history for it (the backend reuses one thread per job).
  useEffect(() => {
    if (!convId && !ensureConvMutation.isPending) {
      ensureConvMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const { data: convDetail, isLoading: loadingHistory } = useQuery({
    queryKey: ['job-roadmap-conv', convId],
    queryFn: () => counsellorApi.getConversation(convId!),
    enabled: !!convId,
  })

  useEffect(() => {
    if (convDetail) setMessages(convDetail.messages)
  }, [convDetail])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input.trim()
    if (!text || isStreaming) return

    let activeConvId = convId
    if (!activeConvId) {
      const conv = await ensureConvMutation.mutateAsync()
      activeConvId = conv.id
    }
    if (!activeConvId) return

    if (!overrideText) setInput('')
    const userId = `u-${Date.now()}`
    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '', streaming: true }])
    setIsStreaming(true)

    let full = ''
    await counsellorApi.sendMessage(
      activeConvId, text,
      (chunk) => {
        full += chunk
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m))
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      () => {
        setIsStreaming(false)
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
      },
      () => {
        setIsStreaming(false)
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false } : m))
      },
    )
  }, [input, isStreaming, convId, ensureConvMutation])

  // Auto-send a question injected from outside (e.g. the "Ask AI" button on a roadmap topic)
  const lastHandledQuestionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingQuestion || isStreaming || lastHandledQuestionRef.current === pendingQuestion) return
    lastHandledQuestionRef.current = pendingQuestion
    sendMessage(pendingQuestion)
    onPendingQuestionHandled?.()
  }, [pendingQuestion, isStreaming, sendMessage, onPendingQuestionHandled])

  return (
    <div style={{
      width: '42%', flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid rgba(226,232,240,0.8)', background: 'white',
      position: 'sticky', top: 60, height: 'calc(100vh - 60px)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={15} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 800, color: 'white', margin: 0 }}>Ask DISHA</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            About {jobTitle ?? 'this role'} only
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loadingHistory && messages.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={20} color="#94A3B8" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 12px', color: '#94A3B8' }}>
            <MessageSquare size={28} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 18px', maxWidth: 280 }}>
              Ask me anything about your roadmap for <strong style={{ color: '#475569' }}>{jobTitle ?? 'this job'}</strong> — skills, modules, interview prep, or what to focus on next.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {SUGGESTIONS(jobTitle).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                    background: '#F8FAFC', border: '1px solid rgba(226,232,240,0.9)',
                    cursor: 'pointer', fontSize: 12.5, color: '#374151', lineHeight: 1.5,
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(226,232,240,0.9)'; e.currentTarget.style.color = '#374151' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
            background: m.role === 'user' ? '#15130F' : '#F1F5F9',
            color: m.role === 'user' ? 'white' : '#0F172A',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {m.content}
            {m.streaming && !m.content && (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#94A3B8', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(226,232,240,0.8)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={`Ask about ${jobTitle ?? 'this job'}...`}
          disabled={isStreaming}
          style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={isStreaming || !input.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: isStreaming || !input.trim() ? '#E2E8F0' : '#15130F',
            color: 'white', border: 'none', cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={15} />
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0) } 30% { transform: translateY(-4px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
