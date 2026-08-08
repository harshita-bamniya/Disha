import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  companionApi, type MessageOut, type Mood, type TimelineEntry,
} from '@/api/companion'
import AspLayout from '@/shared/layouts/AspLayout'
import PageHeader from '@/shared/layouts/PageHeader'
import ChatBubble, { type ChatBubbleTheme } from '@/shared/components/ai/ChatBubble'
import TypingIndicator from '@/shared/components/ai/TypingIndicator'
import {
  Send, Heart, Sparkles, BookHeart, AlertTriangle, X, Plus, Trash2, Flame,
} from 'lucide-react'

const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😔', label: 'Low' },
  { key: 'struggling', emoji: '😞', label: 'Struggling' },
]

const CRISIS_NUMBERS = [
  { name: 'iCall (TISS)', number: '9152987821' },
  { name: 'Vandrevala Foundation (24×7)', number: '1860-2662-345' },
]

const OPENERS = [
  "I don't think I'm doing well lately.",
  "I completed my targets today and I'm proud of it.",
  "I'm feeling really alone in this journey.",
  "How was your day, Companion?",
]

// ── Companion chat theme ───────────────────────────────────────────────────────
const COMPANION_THEME: ChatBubbleTheme = {
  avatarBg: 'linear-gradient(135deg, #F4A896, #E08E79)',
  avatarContent: <Heart size={14} color="white" fill="white" />,
  userBg: 'linear-gradient(135deg, #B98AC2, #9B6EB0)',
  userColor: 'white',
  aiBorderColor: 'rgba(244,168,150,0.25)',
}

// ── Mood check-in widget ───────────────────────────────────────────────────────
function MoodCheckIn() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Mood | null>(null)
  const [note, setNote] = useState('')
  const mutation = useMutation({
    mutationFn: () => companionApi.createMoodEntry(selected!, note.trim() || undefined),
    onSuccess: () => {
      setSelected(null)
      setNote('')
      qc.invalidateQueries({ queryKey: ['companion-mood'] })
      qc.invalidateQueries({ queryKey: ['companion-insights'] })
      qc.invalidateQueries({ queryKey: ['companion-timeline'] })
    },
  })

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid rgba(244,168,150,0.25)', boxShadow: '0 2px 10px rgba(120,80,60,0.06)' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#8A5A4F', marginBottom: 10 }}>How are you feeling today?</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: selected ? 10 : 0 }}>
        {MOODS.map(m => (
          <button
            key={m.key}
            onClick={() => setSelected(m.key)}
            title={m.label}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: selected === m.key ? '2px solid #E08E79' : '1px solid rgba(224,142,121,0.25)',
              background: selected === m.key ? 'rgba(224,142,121,0.1)' : 'transparent',
              cursor: 'pointer', fontSize: 18, transition: 'all 0.15s',
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      {selected && (
        <>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Want to add a quick note? (optional)"
            rows={2}
            style={{
              width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 8,
              border: '1px solid rgba(224,142,121,0.25)', resize: 'none', fontFamily: 'inherit',
              outline: 'none', marginBottom: 8, boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#E08E79', color: 'white', fontSize: 12, fontWeight: 700,
            }}
          >
            Log mood
          </button>
        </>
      )}
    </div>
  )
}

// ── Journey timeline ────────────────────────────────────────────────────────────
function JourneyTimeline() {
  const { data: timeline } = useQuery({ queryKey: ['companion-timeline'], queryFn: () => companionApi.getTimeline(60) })
  const moodEmoji: Record<string, string> = { great: '😄', good: '🙂', okay: '😐', low: '😔', struggling: '😞' }

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid rgba(244,168,150,0.25)', boxShadow: '0 2px 10px rgba(120,80,60,0.06)', maxHeight: 260, overflowY: 'auto' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#8A5A4F', marginBottom: 10 }}>Your journey timeline</p>
      {(!timeline || timeline.length === 0) && (
        <p style={{ fontSize: 11, color: '#B89B92', textAlign: 'center', padding: '10px 0' }}>Nothing logged yet — your story starts here.</p>
      )}
      {timeline?.slice(0, 20).map((e: TimelineEntry, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: i < timeline.length - 1 ? '1px solid rgba(224,142,121,0.12)' : 'none' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{e.type === 'milestone' ? '🌟' : moodEmoji[e.mood ?? 'okay']}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11.5, color: '#3D2B2B', fontWeight: 600, margin: 0 }}>
              {e.type === 'milestone' ? e.title : `Felt ${e.mood}`}
            </p>
            {(e.note || e.description) && (
              <p style={{ fontSize: 11, color: '#8A6F69', margin: '2px 0 0', lineHeight: 1.4 }}>{e.note || e.description}</p>
            )}
            <p style={{ fontSize: 9.5, color: '#C7AFA8', margin: '2px 0 0' }}>{new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Milestones panel ────────────────────────────────────────────────────────────
function MilestonesPanel() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const { data: milestones } = useQuery({ queryKey: ['companion-milestones'], queryFn: companionApi.listMilestones })
  const createMutation = useMutation({
    mutationFn: () => companionApi.createMilestone(title.trim()),
    onSuccess: () => {
      setTitle('')
      setAdding(false)
      qc.invalidateQueries({ queryKey: ['companion-milestones'] })
      qc.invalidateQueries({ queryKey: ['companion-timeline'] })
      qc.invalidateQueries({ queryKey: ['companion-insights'] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => companionApi.deleteMilestone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companion-milestones'] }),
  })

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid rgba(244,168,150,0.25)', boxShadow: '0 2px 10px rgba(120,80,60,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8A5A4F' }}>Personal milestones</p>
        <button onClick={() => setAdding(a => !a)} aria-label="Add milestone" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E08E79' }}>
          <Plus size={15} />
        </button>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Finished my first mock test"
            style={{ flex: 1, fontSize: 12, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(224,142,121,0.3)', outline: 'none' }}
          />
          <button
            onClick={() => title.trim() && createMutation.mutate()}
            style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#E08E79', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >Add</button>
        </div>
      )}
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {milestones?.length === 0 && <p style={{ fontSize: 11, color: '#B89B92', textAlign: 'center', padding: '6px 0' }}>No milestones yet.</p>}
        {milestones?.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '6px 0', borderBottom: '1px solid rgba(224,142,121,0.1)' }}>
            <span style={{ fontSize: 13, marginTop: 1 }}>🌟</span>
            <p style={{ flex: 1, fontSize: 11.5, color: '#3D2B2B', margin: 0, lineHeight: 1.4 }}>{m.title}</p>
            <button onClick={() => deleteMutation.mutate(m.id)} aria-label="Delete milestone" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35 }}>
              <Trash2 size={11} color="#C2645A" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Weekly insights ──────────────────────────────────────────────────────────────
function WeeklyInsights() {
  const { data: insight } = useQuery({ queryKey: ['companion-insights'], queryFn: companionApi.getInsights })
  if (!insight) return null
  const moodEmoji: Record<string, string> = { great: '😄', good: '🙂', okay: '😐', low: '😔', struggling: '😞' }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(244,168,150,0.16), rgba(185,138,194,0.12))', borderRadius: 14, padding: 14, border: '1px solid rgba(244,168,150,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles size={13} color="#9B6EB0" />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8A5A4F' }}>This week</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 20, margin: 0 }}>{insight.dominant_mood ? moodEmoji[insight.dominant_mood] : '—'}</p>
          <p style={{ fontSize: 10, color: '#8A6F69', margin: '2px 0 0' }}>Mostly feeling {insight.dominant_mood ?? 'unrecorded'}</p>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#9B6EB0', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <Flame size={15} /> {insight.check_in_streak}
          </p>
          <p style={{ fontSize: 10, color: '#8A6F69', margin: '2px 0 0' }}>day check-in streak</p>
        </div>
      </div>
    </div>
  )
}

// ── Memory highlights ────────────────────────────────────────────────────────────
function MemoryHighlights() {
  const qc = useQueryClient()
  const { data: memories } = useQuery({ queryKey: ['companion-memories'], queryFn: companionApi.listMemories })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => companionApi.deleteMemory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companion-memories'] }),
  })

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid rgba(244,168,150,0.25)', boxShadow: '0 2px 10px rgba(120,80,60,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <BookHeart size={13} color="#E08E79" />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8A5A4F' }}>What I remember about you</p>
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {memories?.length === 0 && <p style={{ fontSize: 11, color: '#B89B92', textAlign: 'center', padding: '6px 0' }}>Still getting to know you — keep talking to me.</p>}
        {memories?.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 0', borderBottom: '1px solid rgba(224,142,121,0.1)' }}>
            <p style={{ flex: 1, fontSize: 11, color: '#3D2B2B', margin: 0, lineHeight: 1.4 }}>{m.content}</p>
            <button onClick={() => deleteMutation.mutate(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3, flexShrink: 0 }} title="Forget this">
              <X size={10} color="#C2645A" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompanionPage() {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<(MessageOut | { role: string; content: string; id: string; streaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Return visits get a short personal greeting, not the entire past scrollback —
  // the companion still has full memory of past messages, it just doesn't replay them.
  const { data: welcome, isLoading } = useQuery({ queryKey: ['companion-welcome'], queryFn: companionApi.getWelcome })

  useEffect(() => {
    if (welcome?.greeting) {
      setMessages([{ id: 'welcome-back', role: 'assistant', content: welcome.greeting }])
    }
  }, [welcome])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const userText = overrideText ?? input.trim()
    if (!userText || isStreaming) return

    if (!overrideText) setInput('')
    setError(null)

    const tempUserId = `temp-${Date.now()}`
    setMessages(prev => [...prev, { id: tempUserId, role: 'user', content: userText }])
    const tempAssistantId = `streaming-${Date.now()}`
    setMessages(prev => [...prev, { id: tempAssistantId, role: 'assistant', content: '', streaming: true }])
    setIsStreaming(true)

    let fullContent = ''
    await companionApi.sendMessage(
      userText,
      (chunk) => {
        fullContent += chunk
        setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, content: fullContent } : m))
      },
      () => {
        setIsStreaming(false)
        setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, streaming: false } : m))
        qc.invalidateQueries({ queryKey: ['companion-memories'] })
      },
      (err) => {
        setIsStreaming(false)
        setError(err.message)
        setMessages(prev => prev.filter(m => m.id !== tempAssistantId))
      }
    )
  }, [input, isStreaming, qc])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <AspLayout activePath="/app/companion">
      <PageHeader
        title="Your Companion"
        subtitle="Here to listen, remember, and walk with you"
        icon={<Heart size={14} color="#E08E79" />}
      />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(224,142,121,0.2)', borderTopColor: '#E08E79', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
              {!isLoading && messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F4A896, #E08E79)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                    boxShadow: '0 8px 24px rgba(224,142,121,0.35)',
                  }}>
                    <Heart size={30} color="white" fill="white" />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: '#5C3D38', fontFamily: 'Hind, sans-serif', marginBottom: 8 }}>Hey, I'm here.</h2>
                  <p style={{ fontSize: 14, color: '#8A6F69', textAlign: 'center', maxWidth: 380, lineHeight: 1.7, marginBottom: 28 }}>
                    Not here to advise you on your career or your prep — just to listen, remember your journey, and be someone you don't have to face it alone with.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 440 }}>
                    {OPENERS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        style={{
                          padding: '12px 16px', borderRadius: 12, textAlign: 'left',
                          background: 'white', border: '1px solid rgba(244,168,150,0.3)',
                          cursor: 'pointer', fontSize: 13, color: '#5C3D38',
                          boxShadow: '0 1px 4px rgba(120,80,60,0.05)', lineHeight: 1.5,
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map(m => (
                <ChatBubble
                  key={m.id}
                  role={m.role as 'user' | 'assistant'}
                  content={m.content}
                  streaming={(m as any).streaming === true}
                  theme={COMPANION_THEME}
                />
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <TypingIndicator
                  avatarBg="linear-gradient(135deg, #F4A896, #E08E79)"
                  avatarContent={<Heart size={14} color="white" fill="white" />}
                  dotColor="#E0B8AE"
                />
              )}
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 28px 20px', background: 'rgba(255,255,255,0.6)', borderTop: '1px solid rgba(244,168,150,0.2)' }}>
              <div style={{
                display: 'flex', gap: 10, alignItems: 'center',
                background: 'white', borderRadius: 16,
                border: '1.5px solid rgba(244,168,150,0.3)',
                padding: '10px 14px', minHeight: 52,
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Talk to me... (Enter to send, Shift+Enter for new line)"
                  disabled={isStreaming}
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 14, color: '#3D2B2B', lineHeight: 1.6, resize: 'none',
                    maxHeight: 120, minHeight: 20, overflowY: 'auto', fontFamily: 'inherit',
                  }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send message"
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: input.trim() && !isStreaming ? '#E08E79' : '#F1E4DF',
                    border: 'none', cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Send size={15} color={input.trim() && !isStreaming ? 'white' : '#C7AFA8'} />
                </button>
              </div>
              <p style={{ fontSize: 10, color: '#C7AFA8', textAlign: 'center', marginTop: 8 }}>
                Your Companion isn't a licensed mental health professional. For crisis support: iCall 9152987821 · Vandrevala 1860-2662-345
              </p>
            </div>
          </div>

          {/* Side panel — growth dashboard */}
          <div style={{ width: 300, flexShrink: 0, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', borderLeft: '1px solid rgba(244,168,150,0.2)' }}>
            <WeeklyInsights />
            <MoodCheckIn />
            <JourneyTimeline />
            <MilestonesPanel />
            <MemoryHighlights />

            <div style={{ padding: 10, background: 'rgba(200,75,49,0.05)', borderRadius: 10, border: '1px solid rgba(200,75,49,0.15)' }}>
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
        </div>

    </AspLayout>
  )
}
