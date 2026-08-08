import { useCallback, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { counsellorApi } from '@/api/counsellor'
import { MessageSquare, X, Send, Loader2, Sparkles } from 'lucide-react'

interface Props {
  jobId: string
  jobTitle?: string
  company?: string
  sector?: string
  skillFocus?: string
}

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export default function JobPlanChatWidget({ jobId, jobTitle, company, sector, skillFocus }: Props) {
  const [open, setOpen] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const ensureConvMutation = useMutation({
    mutationFn: () => counsellorApi.createSkillConversation({
      skillFocus: skillFocus ?? jobTitle ?? 'this role',
      jobId, jobTitle, company, sector,
    }),
    onSuccess: (conv) => setConvId(conv.id),
  })

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    let activeConvId = convId
    if (!activeConvId) {
      const conv = await ensureConvMutation.mutateAsync()
      activeConvId = conv.id
    }
    if (!activeConvId) return

    setInput('')
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
          color: 'white', border: 'none', borderRadius: 30,
          padding: '12px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(21,19,15,0.3)',
        }}
      >
        <Sparkles size={15} /> Ask BeginablAI
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 50,
      width: 360, maxHeight: 480, display: 'flex', flexDirection: 'column',
      background: 'white', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(15,23,42,0.25)', border: '1px solid rgba(226,232,240,0.8)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color="white" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>Ask BeginablAI about this plan</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 220 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 8px', color: '#94A3B8' }}>
            <MessageSquare size={26} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Ask anything about {jobTitle ?? 'this job'} that isn't covered in the plan above.
            </p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? '#15130F' : '#F1F5F9',
            color: m.role === 'user' ? 'white' : '#0F172A',
            borderRadius: 12, padding: '8px 12px', fontSize: 12.5, lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content || (m.streaming ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : '')}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(226,232,240,0.7)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Type your question..."
          disabled={isStreaming}
          style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, outline: 'none' }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: isStreaming || !input.trim() ? '#E2E8F0' : '#15130F',
            color: 'white', border: 'none', cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={14} />
        </button>
      </div>

    </div>
  )
}
