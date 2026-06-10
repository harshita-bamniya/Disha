import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { counsellorApi, type ConversationSummary, type MessageOut } from '@/api/counsellor'
import AppSidebar from '@/components/layout/AppSidebar'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { Send, Plus, Archive, MessageCircle, AlertTriangle, Briefcase, BrainCircuit, Zap } from 'lucide-react'

const CRISIS_NUMBERS = [
  { name: 'iCall (TISS)', number: '9152987821' },
  { name: 'Vandrevala Foundation (24×7)', number: '1860-2662-345' },
]

const SUGGESTED_PROMPTS = [
  "I'm feeling overwhelmed after my UPSC result. Where do I start?",
  "How do I explain my UPSC years to a private sector employer?",
  "I'm scared no one will hire me at 28 with no corporate experience.",
  "What career options make sense for someone with my background?",
  "I feel like I've wasted my best years. Is it too late?",
]

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: MessageOut | { role: string; content: string; id: string; streaming?: boolean } }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      animation: 'fadeInMsg 0.3s ease both',
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'white', fontWeight: 800, marginRight: 10, marginTop: 2,
        }}>D</div>
      )}
      <div style={{
        maxWidth: '72%',
        background: isUser
          ? 'linear-gradient(135deg, #1D4ED8, #3B82F6)'
          : 'white',
        color: isUser ? 'white' : '#1e293b',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 14,
        lineHeight: 1.7,
        boxShadow: isUser
          ? '0 4px 14px rgba(59,130,246,0.3)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        border: isUser ? 'none' : '1px solid rgba(226,232,240,0.8)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
        {'streaming' in msg && msg.streaming && (
          <span style={{
            display: 'inline-block', width: 10, height: 10,
            background: '#94A3B8', borderRadius: '50%', marginLeft: 4,
            animation: 'blink 1s infinite',
          }} />
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: 'white', fontWeight: 800, marginRight: 10,
      }}>D</div>
      <div style={{
        background: 'white', padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
        border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: 5,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#94A3B8',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CounsellorPage() {
  const qc = useQueryClient()
  const { convId: urlConvId } = useParams<{ convId?: string }>()
  const { activePrep } = useActivePrepJob()
  const [activeConvId, setActiveConvId] = useState<string | null>(urlConvId ?? null)
  const [messages, setMessages] = useState<(MessageOut | { role: string; content: string; id: string; streaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoStartedRef = useRef<Set<string>>(new Set())
  // Maps convId → the hidden auto-start trigger text so we can filter it from display
  const hiddenTriggerRef = useRef<Map<string, string>>(new Map())

  const { data: conversations } = useQuery({
    queryKey: ['counsellor-conversations'],
    queryFn: counsellorApi.listConversations,
  })

  const { data: convDetail, isLoading: loadingConv } = useQuery({
    queryKey: ['counsellor-conv', activeConvId],
    queryFn: () => counsellorApi.getConversation(activeConvId!),
    enabled: !!activeConvId,
  })

  // Sync active conversation when navigating from skill cards (URL changes)
  useEffect(() => {
    if (urlConvId && urlConvId !== activeConvId) {
      setActiveConvId(urlConvId)
      setMessages([])
    }
  }, [urlConvId])

  useEffect(() => {
    if (convDetail) {
      const hiddenText = hiddenTriggerRef.current.get(convDetail.id)
      // Filter out the silent auto-start trigger message from display
      const visible = hiddenText
        ? convDetail.messages.filter(m => !(m.role === 'user' && m.content === hiddenText))
        : convDetail.messages
      setMessages(visible)
    }
  }, [convDetail])

  // Auto-start: when a skill_learning conversation is loaded with 0 messages,
  // send a silent trigger so the AI speaks first without the user typing anything.
  useEffect(() => {
    if (
      convDetail &&
      convDetail.context_type === 'skill_learning' &&
      convDetail.messages.length === 0 &&
      !isStreaming &&
      !autoStartedRef.current.has(convDetail.id)
    ) {
      autoStartedRef.current.add(convDetail.id)
      const skill = convDetail.skill_focus ?? 'the skill'
      const jobTitle = (convDetail.job_context as any)?.job_title ?? 'this role'
      const company = (convDetail.job_context as any)?.company ?? 'the company'
      const triggerText = `Please start by introducing what I'll be learning: ${skill}, in the context of the ${jobTitle} role at ${company}. Give me a brief overview of what this skill means for this specific job, and what we'll cover in this session.`
      hiddenTriggerRef.current.set(convDetail.id, triggerText)
      sendMessage(triggerText, true)
    }
  }, [convDetail, isStreaming])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createConvMutation = useMutation({
    mutationFn: () => counsellorApi.createConversation('general'),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['counsellor-conversations'] })
      setActiveConvId(conv.id)
      setMessages([])
    },
  })

  // sendMessage accepts an explicit text (for auto-start) or reads from input state
  const sendMessage = useCallback(async (overrideText?: string, hideUserBubble = false) => {
    const userText = overrideText ?? input.trim()
    if (!userText || isStreaming || !activeConvId) return

    if (!overrideText) setInput('')
    setError(null)

    const tempUserId = `temp-${Date.now()}`
    if (!hideUserBubble) {
      setMessages(prev => [...prev, { id: tempUserId, role: 'user', content: userText }])
    }

    const tempAssistantId = `streaming-${Date.now()}`
    setMessages(prev => [...prev, { id: tempAssistantId, role: 'assistant', content: '', streaming: true }])
    setIsStreaming(true)

    let fullContent = ''

    await counsellorApi.sendMessage(
      activeConvId,
      userText,
      (chunk) => {
        fullContent += chunk
        setMessages(prev =>
          prev.map(m =>
            m.id === tempAssistantId
              ? { ...m, content: fullContent }
              : m
          )
        )
      },
      () => {
        setIsStreaming(false)
        setMessages(prev =>
          prev.map(m =>
            m.id === tempAssistantId
              ? { ...m, streaming: false }
              : m
          )
        )
        qc.invalidateQueries({ queryKey: ['counsellor-conversations'] })
        qc.invalidateQueries({ queryKey: ['counsellor-conv', activeConvId] })
      },
      (err) => {
        setIsStreaming(false)
        setError(err.message)
        setMessages(prev => prev.filter(m => m.id !== tempAssistantId))
      }
    )
  }, [input, isStreaming, activeConvId, qc])

  const handleSend = useCallback(() => sendMessage(), [sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/counsellor" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'white', fontWeight: 800,
            }}>D</div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', fontFamily: 'Hind, sans-serif' }}>DISHA AI Counsellor</p>
              <p style={{ fontSize: 11, color: '#94A3B8' }}>Your career guide — here whenever you need to talk</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>Online</span>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left sidebar — conversation list */}
          <div style={{
            width: 260, flexShrink: 0, background: 'white',
            borderRight: '1px solid rgba(226,232,240,0.8)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => createConvMutation.mutate()}
                disabled={createConvMutation.isPending}
                style={{
                  width: '100%', height: 38, borderRadius: 10,
                  background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                  color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: '0 3px 10px rgba(45,106,79,0.3)',
                }}
              >
                <Plus size={14} /> New conversation
              </button>
              {activePrep && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7,
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 10, padding: '8px 10px',
                }}>
                  <Briefcase size={12} color="#6366F1" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Active prep</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePrep.job_title}</p>
                    <p style={{ fontSize: 10, color: '#94A3B8' }}>{activePrep.company_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              {conversations?.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                    background: activeConvId === conv.id ? 'rgba(45,106,79,0.08)' : 'transparent',
                    border: activeConvId === conv.id ? '1px solid rgba(45,106,79,0.2)' : '1px solid transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = '#F8FAFC' }}
                  onMouseOut={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {conv.context_type === 'skill_learning'
                      ? <BrainCircuit size={13} color={activeConvId === conv.id ? '#EA580C' : '#F97316'} />
                      : <MessageCircle size={13} color={activeConvId === conv.id ? '#2D6A4F' : '#94A3B8'} />
                    }
                    <p style={{
                      fontSize: 12, fontWeight: 600,
                      color: activeConvId === conv.id
                        ? (conv.context_type === 'skill_learning' ? '#EA580C' : '#2D6A4F')
                        : '#374151',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      userSelect: 'none', pointerEvents: 'none',
                    }}>
                      {conv.title || (conv.context_type === 'skill_learning' ? conv.skill_focus ?? 'Skill session' : 'New conversation')}
                    </p>
                  </div>
                  <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, paddingLeft: 20 }}>
                    {conv.message_count} messages
                  </p>
                </button>
              ))}
              {(!conversations || conversations.length === 0) && (
                <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>
                  No conversations yet
                </p>
              )}
            </div>

            {/* Crisis resources footer */}
            <div style={{
              margin: '8px 12px 12px', padding: 10,
              background: 'rgba(200,75,49,0.05)', borderRadius: 10,
              border: '1px solid rgba(200,75,49,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <AlertTriangle size={11} color="#C84B31" />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#C84B31' }}>CRISIS SUPPORT</span>
              </div>
              {CRISIS_NUMBERS.map(n => (
                <div key={n.number} style={{ marginBottom: 3 }}>
                  <p style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{n.name}</p>
                  <p style={{ fontSize: 11, color: '#C84B31', fontWeight: 700 }}>{n.number}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!activeConvId ? (
              /* No conversation selected — general welcome */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 40,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: 'white', fontWeight: 800, marginBottom: 20,
                  boxShadow: '0 8px 24px rgba(45,106,79,0.3)',
                }}>D</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', marginBottom: 8 }}>
                  Hi, I'm DISHA
                </h2>
                <p style={{ fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 380, lineHeight: 1.7, marginBottom: 28 }}>
                  I'm your career counsellor. I understand the journey you've been on — the years of preparation, the uncertainty, the emotional weight. Let's talk.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 440 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
                    Or start with one of these
                  </p>
                  {[
                    ...(activePrep
                      ? [`Help me prepare for my ${activePrep.job_title} interview at ${activePrep.company_name}`, `What skills should I focus on for ${activePrep.job_title}?`]
                      : []
                    ),
                    ...SUGGESTED_PROMPTS,
                  ].slice(0, 5).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={async () => {
                        const conv = await createConvMutation.mutateAsync()
                        setActiveConvId(conv.id)
                        setTimeout(() => setInput(prompt), 100)
                      }}
                      style={{
                        padding: '12px 16px', borderRadius: 12, textAlign: 'left',
                        background: 'white', border: '1px solid rgba(226,232,240,0.8)',
                        cursor: 'pointer', fontSize: 13, color: '#374151',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s', lineHeight: 1.5,
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#2D6A4F'; e.currentTarget.style.color = '#2D6A4F' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(226,232,240,0.8)'; e.currentTarget.style.color = '#374151' }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active conversation */
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {loadingConv && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                      <div style={{ width: 20, height: 20, border: '2px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  )}
                  {messages.map(m => (
                    <MessageBubble key={m.id} msg={m} />
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <TypingIndicator />
                  )}
                  {error && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                      padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 12,
                    }}>
                      {error}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div style={{
                  padding: '12px 24px 20px',
                  background: 'white',
                  borderTop: '1px solid rgba(226,232,240,0.8)',
                }}>
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    background: '#F8FAFC', borderRadius: 16,
                    border: '1.5px solid rgba(226,232,240,0.9)',
                    padding: '10px 14px', minHeight: 52,
                    transition: 'border-color 0.2s',
                    width: '100%',
                  }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2D6A4F' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(226,232,240,0.9)' }}
                  >
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        convDetail?.context_type === 'skill_learning'
                          ? `Ask anything about ${convDetail.skill_focus}... (Enter to send)`
                          : 'Type your message... (Enter to send, Shift+Enter for new line)'
                      }
                      disabled={isStreaming}
                      rows={1}
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 14, color: '#0F172A', lineHeight: 1.6, resize: 'none',
                        maxHeight: 120, minHeight: 20, overflowY: 'auto',
                        fontFamily: 'inherit',
                      }}
                      onInput={e => {
                        const el = e.currentTarget
                        el.style.height = 'auto'
                        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                      style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: input.trim() && !isStreaming
                          ? 'linear-gradient(135deg, #2D6A4F, #40916C)'
                          : '#E2E8F0',
                        border: 'none', cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                        boxShadow: input.trim() && !isStreaming ? '0 3px 10px rgba(45,106,79,0.3)' : 'none',
                      }}
                    >
                      <Send size={15} color={input.trim() && !isStreaming ? 'white' : '#94A3B8'} />
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 8 }}>
                    DISHA is an AI counsellor, not a licensed mental health professional.
                    For crisis support: iCall 9152987821 · Vandrevala 1860-2662-345
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInMsg { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0) } 30% { transform: translateY(-5px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
