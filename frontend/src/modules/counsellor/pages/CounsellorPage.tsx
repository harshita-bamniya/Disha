import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { counsellorApi, type ConversationSummary, type MessageOut, type CounsellorMemory } from '@/api/counsellor'
import AspLayout from '@/shared/layouts/AspLayout'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { Send, Plus, Archive, MessageCircle, AlertTriangle, Briefcase, BrainCircuit, Zap, Brain, ChevronDown, ChevronUp, X, Mic, MicOff, Trash2 } from 'lucide-react'
import { ChatBubble, ChatTypingIndicator, type ChatBubbleTheme } from '@/shared/components/ai/ChatBubble'

const COUNSELLOR_THEME: ChatBubbleTheme = {
  avatar: (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 800 }}>D</div>
  ),
  userBg: '#2563EB', userText: 'white', userShadow: '0 4px 14px rgba(59,130,246,0.3)',
  assistantBg: 'white', assistantText: '#1e293b', assistantShadow: '0 2px 8px rgba(0,0,0,0.06)',
  assistantBorder: '1px solid rgba(226,232,240,0.8)',
  streamingDotColor: '#94A3B8',
  typingDotColor: '#94A3B8',
}

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
  return (
    <ChatBubble
      isUser={msg.role === 'user'}
      content={msg.content}
      streaming={'streaming' in msg && msg.streaming}
      theme={COUNSELLOR_THEME}
    />
  )
}


const MEMORY_TYPE_COLORS: Record<string, string> = {
  fact: '#3B82F6',
  preference: '#8B5CF6',
  concern: '#EF4444',
  milestone: '#10B981',
  goal: '#F59E0B',
}

// ── Memory Panel ──────────────────────────────────────────────────────────────
function MemoryPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: memories, isLoading } = useQuery({
    queryKey: ['counsellor-memories'],
    queryFn: counsellorApi.listMemories,
    enabled: open,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => counsellorApi.deleteMemory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['counsellor-memories'] }),
  })

  return (
    <div style={{ margin: '0 12px 8px', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'rgba(59,130,246,0.05)', border: 'none',
          padding: '8px 10px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Brain size={11} color="#3B82F6" />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', flex: 1, textAlign: 'left' }}>
          WHAT BeginablAI KNOWS
        </span>
        {open ? <ChevronUp size={11} color="#3B82F6" /> : <ChevronDown size={11} color="#3B82F6" />}
      </button>
      {open && (
        <div style={{ padding: '8px 10px', background: 'white', maxHeight: 200, overflowY: 'auto' }}>
          {isLoading && <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>Loading...</p>}
          {memories?.length === 0 && (
            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>No memories yet — start chatting!</p>
          )}
          {memories?.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6,
              padding: '5px 6px', borderRadius: 6, background: '#F8FAFC',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8, flexShrink: 0, marginTop: 1,
                background: `${MEMORY_TYPE_COLORS[m.memory_type]}15`,
                color: MEMORY_TYPE_COLORS[m.memory_type],
              }}>{m.memory_type}</span>
              <p style={{ fontSize: 11, color: '#374151', flex: 1, lineHeight: 1.4, margin: 0 }}>{m.content}</p>
              <button
                onClick={() => deleteMutation.mutate(m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, opacity: 0.4 }}
                title="Forget this"
              >
                <X size={10} color="#EF4444" />
              </button>
            </div>
          ))}
          <p style={{ fontSize: 9, color: '#CBD5E1', textAlign: 'center', marginTop: 4 }}>
            Click × to ask BeginablAI to forget something
          </p>
        </div>
      )}
    </div>
  )
}

// ── Nudge Banner ──────────────────────────────────────────────────────────────
function NudgeBanner() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const { data: nudge } = useQuery({
    queryKey: ['counsellor-nudge'],
    queryFn: counsellorApi.getNudge,
    staleTime: 1000 * 60 * 10,
  })

  if (dismissed || !nudge?.message) return null

  const bgMap: Record<string, string> = {
    interview: '#F5F8FF',
    learning: '#F5F8FF',
    streak: '#F5F8FF',
  }
  const borderMap: Record<string, string> = {
    interview: '#DBEAFE',
    learning: '#DBEAFE',
    streak: '#DBEAFE',
  }
  const colorMap: Record<string, string> = {
    interview: '#3B82F6',
    learning: '#3B82F6',
    streak: '#3B82F6',
  }
  const t = nudge.type ?? 'interview'

  return (
    <div style={{
      margin: '16px 24px 0',
      padding: '12px 16px',
      borderRadius: 12,
      background: bgMap[t] ?? bgMap.interview,
      border: `1px solid ${borderMap[t] ?? borderMap.interview}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Zap size={14} color={colorMap[t]} style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: '#374151', flex: 1, lineHeight: 1.5 }}>{nudge.message}</p>
      {nudge.cta_path && (
        <button
          onClick={() => navigate(nudge.cta_path!)}
          style={{
            padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: colorMap[t], color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}
        >{nudge.cta}</button>
      )}
      <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4, flexShrink: 0 }}>
        <X size={12} color="#374151" />
      </button>
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
  const lastUserMsgRef = useRef<string>('')
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

  const deleteConvMutation = useMutation({
    mutationFn: (convId: string) => counsellorApi.deleteConversation(convId),
    onSuccess: (_data, convId) => {
      qc.invalidateQueries({ queryKey: ['counsellor-conversations'] })
      if (activeConvId === convId) {
        setActiveConvId(null)
        setMessages([])
      }
    },
  })

  // sendMessage accepts an explicit text (for auto-start) or reads from input state
  const sendMessage = useCallback(async (overrideText?: string, hideUserBubble = false) => {
    const userText = overrideText ?? input.trim()
    if (!userText || isStreaming || !activeConvId) return

    if (!overrideText) setInput('')
    setError(null)
    lastUserMsgRef.current = userText

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
    <AspLayout activePath="/app/counsellor">
        {/* Top bar */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 24px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, #818CF8, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'white', fontWeight: 700,
            }}>D</div>
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>BeginablAI Counsellor</p>
              <p style={{ fontSize: 11.5, color: '#9CA3AF' }}>Your career guide — here whenever you need to talk</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />
            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Online</span>
          </div>
        </header>

        <NudgeBanner />
        <div style={{ flex: 1, display: 'flex', minHeight: 0, background: '#FAFBFD' }}>
          {/* Left sidebar — conversation list */}
          <div style={{
            width: 260, flexShrink: 0, background: 'white',
            borderRight: '1px solid #F1F5F9',
            boxShadow: '4px 0 16px rgba(15,23,42,0.03)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => createConvMutation.mutate()}
                disabled={createConvMutation.isPending}
                style={{
                  width: '100%', height: 38, borderRadius: 10,
                  background: 'white',
                  color: '#2563EB', border: '1.5px solid #BFDBFE', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: '0 2px 8px rgba(37,99,235,0.08)', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
              >
                <Plus size={14} /> New conversation
              </button>
              {activePrep && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7,
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 10, padding: '8px 10px',
                }}>
                  <Briefcase size={12} color="#3B82F6" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Active prep</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePrep.job_title}</p>
                    <p style={{ fontSize: 10, color: '#94A3B8' }}>{activePrep.company_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              {conversations?.map(conv => (
                <div
                  key={conv.id}
                  style={{ position: 'relative' }}
                  className="conv-item-wrap"
                  onMouseEnter={e => {
                    const btn = e.currentTarget.querySelector<HTMLElement>('.conv-delete-btn')
                    if (btn) btn.style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget.querySelector<HTMLElement>('.conv-delete-btn')
                    if (btn) btn.style.opacity = '0'
                  }}
                >
                  <button
                    onClick={() => setActiveConvId(conv.id)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                      background: activeConvId === conv.id ? '#EFF6FF' : 'transparent',
                      border: activeConvId === conv.id ? '1px solid #BFDBFE' : '1px solid transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', paddingRight: 30,
                    }}
                    onMouseOver={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = '#F8FAFC' }}
                    onMouseOut={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {conv.context_type === 'skill_learning'
                        ? <BrainCircuit size={13} color={activeConvId === conv.id ? '#15130F' : '#94A3B8'} />
                        : <MessageCircle size={13} color={activeConvId === conv.id ? '#3B82F6' : '#94A3B8'} />
                      }
                      <p style={{
                        fontSize: 12, fontWeight: 600,
                        color: activeConvId === conv.id
                          ? (conv.context_type === 'skill_learning' ? '#15130F' : '#3B82F6')
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
                  <button
                    className="conv-delete-btn"
                    onClick={e => {
                      e.stopPropagation()
                      if (window.confirm('Delete this conversation?')) {
                        deleteConvMutation.mutate(conv.id)
                      }
                    }}
                    title="Delete conversation"
                    style={{
                      position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
                      opacity: 0, transition: 'opacity 0.15s',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
                      color: '#EF4444',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#FEE2E2' }}
                    onMouseOut={e => { e.currentTarget.style.background = 'none' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {(!conversations || conversations.length === 0) && (
                <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>
                  No conversations yet
                </p>
              )}
            </div>

            <MemoryPanel />

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
                  background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, color: 'white', fontWeight: 800, marginBottom: 20,
                  boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
                }}>D</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', marginBottom: 8 }}>
                  Hi, I'm BeginablAI
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
                        background: 'white', border: '1px solid #EEF2F9',
                        cursor: 'pointer', fontSize: 13, color: '#374151',
                        boxShadow: '0 6px 16px rgba(15,23,42,0.05)',
                        transition: 'all 0.15s', lineHeight: 1.5,
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(37,99,235,0.12)' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#EEF2F9'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.05)' }}
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
                      <div style={{ width: 20, height: 20, border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  )}
                  {messages.map(m => (
                    <MessageBubble key={m.id} msg={m} />
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <ChatTypingIndicator theme={COUNSELLOR_THEME} />
                  )}
                  {error && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                      padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ flex: 1 }}>{error}</span>
                      {lastUserMsgRef.current && (
                        <button
                          onClick={() => sendMessage(lastUserMsgRef.current)}
                          style={{
                            flexShrink: 0, padding: '4px 12px', borderRadius: 7,
                            border: '1px solid #FECACA', background: 'white',
                            color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >Retry</button>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div style={{
                  padding: '12px 24px 20px',
                  background: 'white',
                  borderTop: '1px solid #F1F5F9',
                }}>
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    background: 'white', borderRadius: 16,
                    border: '1.5px solid #EEF2F9',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
                    padding: '10px 14px', minHeight: 52,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    width: '100%',
                  }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.1)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#EEF2F9'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.05)' }}
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
                          ? '#3B82F6'
                          : '#E2E8F0',
                        border: 'none', cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                        boxShadow: input.trim() && !isStreaming ? '0 3px 10px rgba(59,130,246,0.3)' : 'none',
                      }}
                    >
                      <Send size={15} color={input.trim() && !isStreaming ? 'white' : '#94A3B8'} />
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 8 }}>
                    BeginablAI is an AI counsellor, not a licensed mental health professional.
                    For crisis support: iCall 9152987821 · Vandrevala 1860-2662-345
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      <style>{`
        @keyframes fadeInMsg { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0) } 30% { transform: translateY(-5px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </AspLayout>
  )
}
