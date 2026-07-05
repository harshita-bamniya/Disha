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
  const [streamError, setStreamError] = useState<string | null>(null)
  const lastUserMsgRef = useRef<string>('')
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
    if (convDetail) {
      setMessages(convDetail.messages.filter((m): m is typeof m & { role: 'user' | 'assistant' } => m.role !== 'system'))
    }
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
    setStreamError(null)
    lastUserMsgRef.current = text
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
        setMessages(prev => prev.filter(m => m.id !== assistantId))
        setStreamError('Response failed. Check your connection and retry.')
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
      width: '38%', flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'white', borderLeft: '1px solid #F1F5F9',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        borderBottom: '1px solid #F1F5F9',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, #818CF8, #6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Ask BeginablAI</p>
          <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>
            About {jobTitle ?? 'this role'} only
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loadingHistory && messages.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={18} color="#9CA3AF" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div style={{ padding: '8px 0 24px' }}>
            <MessageSquare size={22} color="#CBD5E1" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#6B7280', margin: '0 0 18px', maxWidth: 320 }}>
              Ask me anything about your roadmap for <strong style={{ color: '#374151' }}>{jobTitle ?? 'this job'}</strong> — skills, modules, interview prep, or what to focus on next.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {SUGGESTIONS(jobTitle).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '11px 0', textAlign: 'left',
                    background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                    cursor: 'pointer', fontSize: 13, color: '#4B5563', lineHeight: 1.5,
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#6366F1' }}
                  onMouseOut={e => { e.currentTarget.style.color = '#4B5563' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id} style={{
            display: 'flex', gap: 10,
            padding: '14px 0',
            borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: m.role === 'user' ? '#F97316' : 'linear-gradient(135deg, #818CF8, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white',
            }}>
              {m.role === 'user' ? 'Y' : 'D'}
            </div>
            <p style={{
              flex: 1, margin: 0, fontSize: 13.5, lineHeight: 1.65, color: '#1F2937',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: 2,
            }}>
              {m.content}
              {m.streaming && !m.content && (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#CBD5E1', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </span>
              )}
            </p>
          </div>
        ))}
        {streamError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '10px 14px', margin: '4px 0 8px', fontSize: 13, color: '#DC2626',
          }}>
            <span style={{ flex: 1 }}>{streamError}</span>
            <button
              onClick={() => sendMessage(lastUserMsgRef.current)}
              style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 7,
                border: '1px solid #FECACA', background: 'white',
                color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Retry</button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 24px 20px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F3F4F6', borderRadius: 24, padding: '6px 6px 6px 18px',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type your message..."
            disabled={isStreaming}
            style={{ flex: 1, border: 'none', background: 'none', padding: '8px 0', fontSize: 13.5, outline: 'none', color: '#111827' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: isStreaming || !input.trim() ? '#E5E7EB' : '#6366F1',
              color: 'white', border: 'none', cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0) } 30% { transform: translateY(-4px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
