import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Send, ChevronRight, HelpCircle } from 'lucide-react'
import { employerSupportApi, type CreateTicketPayload, type TicketDetail } from '@/api/support'
import { getApiError } from '@/api/client'
import { DS, C, statusDot, fmtDate } from '../ds'
import { colors, radius } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import EmptyState from '@/shared/components/feedback/EmptyState'
import ErrorState from '@/shared/components/feedback/ErrorState'
import PageHeader from '@/shared/layouts/PageHeader'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer' }

function priorityColor(p: string) {
  if (p === 'urgent') return C.red
  if (p === 'high')   return C.amber
  return C.blue
}

// ── New ticket modal ───────────────────────────────────────────────────────────
function NewTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTicketPayload>({ subject: '', body: '', priority: 'normal', category: 'general' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => employerSupportApi.createTicket(form),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['employer-tickets'] }); onClose() },
    onError:    (e) => setError(getApiError(e)),
  })

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: colors.text.inkSoft, display: 'block', marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 24, width: '100%', maxWidth: 520, border: `1px solid ${colors.border.default}`, boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text.ink }}>New Support Ticket</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={16} /></Button>
        </div>

        {error && (
          <div style={{ background: colors.state.dangerBg, border: `1px solid rgba(220,38,38,0.2)`, borderRadius: radius.md, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: colors.state.danger }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Subject', <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Briefly describe your issue" style={inputStyle} />)}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Category',
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="jobs">Job Postings</option>
                <option value="candidates">Candidates</option>
                <option value="technical">Technical</option>
              </select>
            )}
            {field('Priority',
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))} style={{ ...selectStyle, width: '100%' }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            )}
          </div>

          {field('Description',
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Describe your issue in detail…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <Button variant="outline" size="sm" onClick={onClose} fullWidth>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => create.mutate()}
            disabled={!form.subject.trim() || !form.body.trim() || create.isPending}
            loading={create.isPending} fullWidth>
            <Send size={13} />{create.isPending ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Ticket reply thread ───────────────────────────────────────────────────────
function TicketThread({ ticket, onClose }: { ticket: TicketDetail; onClose: () => void }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState('')

  const postReply = useMutation({
    mutationFn: (body: string) => employerSupportApi.replyToTicket(ticket.id, body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['employer-tickets', ticket.id] }); setReply('') },
  })

  const { data: detail } = useQuery({
    queryKey: ['employer-tickets', ticket.id],
    queryFn:  () => employerSupportApi.getTicket(ticket.id),
    initialData: ticket,
    refetchInterval: 15000,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: colors.surface.card, borderRadius: radius.xl, width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: `1px solid ${colors.border.default}`, boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: colors.text.ink, margin: 0 }}>#{detail?.id.slice(-6).toUpperCase()} · {detail?.subject}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: statusDot(detail?.status ?? '').color }}>{statusDot(detail?.status ?? '').label}</span>
              <span style={{ fontSize: 11, color: colors.text.muted }}>{fmtDate(detail?.created_at)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}><X size={16} /></Button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(detail?.messages ?? []).map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.sender_type === 'employer' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: m.sender_type === 'employer' ? colors.brand.navy : colors.state.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: m.sender_type === 'employer' ? '#fff' : colors.state.info, flexShrink: 0 }}>
                {m.sender_type === 'employer' ? 'ME' : 'CS'}
              </div>
              <div style={{ maxWidth: '75%' }}>
                <div style={{ background: m.sender_type === 'employer' ? colors.brand.navy : colors.surface.elevated, color: m.sender_type === 'employer' ? '#fff' : colors.text.ink, borderRadius: m.sender_type === 'employer' ? '10px 2px 10px 10px' : '2px 10px 10px 10px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>
                  {m.body}
                </div>
                <p style={{ fontSize: 10, color: colors.text.muted, margin: '4px 0 0', textAlign: m.sender_type === 'employer' ? 'right' : 'left' }}>{fmtDate(m.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {detail?.status !== 'closed' && detail?.status !== 'resolved' && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.border.default}` }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Type your reply…"
                rows={2}
                style={{ ...inputStyle, flex: 1, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <Button variant="primary" size="sm" onClick={() => reply.trim() && postReply.mutate(reply)}
                disabled={!reply.trim() || postReply.isPending} loading={postReply.isPending}
                style={{ alignSelf: 'flex-end' }}>
                <Send size={13} />Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const [showNew, setShowNew]     = useState(false)
  const [activeTicket, setActive] = useState<TicketDetail | null>(null)

  const { data: tickets, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer-tickets'],
    queryFn:  employerSupportApi.getTickets,
  })

  const COLS = '1fr 90px 70px 100px 36px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Support"
        subtitle="Get help from the BeginableAI team"
        actions={<Button variant="primary" size="sm" onClick={() => setShowNew(true)}><Plus size={13} />New Ticket</Button>}
      />

      <div style={{ padding: '16px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={DS.card}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '8px 20px', background: colors.surface.elevated, borderBottom: `1px solid ${colors.border.default}`, fontSize: 11, fontWeight: 600, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {['Subject', 'Status', 'Priority', 'Created', ''].map(h => <span key={h}>{h}</span>)}
          </div>

          {isLoading ? (
            <Spinner />
          ) : isError ? (
            <ErrorState title="Tickets unavailable" description="Could not load support tickets. Please try again." onRetry={() => refetch()} />
          ) : !tickets?.length ? (
            <EmptyState
              icon={<HelpCircle size={24} />}
              title="No support tickets"
              description="Create a ticket if you need help from our team."
              action={
                <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                  <Plus size={13} />Open a ticket
                </Button>
              }
            />
          ) : (
            tickets.map(t => {
              const s = statusDot(t.status)
              return (
                <div key={t.id} onClick={() => setActive(t as unknown as TicketDetail)}
                  style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '11px 20px', borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseOver={e => { e.currentTarget.style.background = colors.surface.elevated }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: colors.text.ink, margin: 0 }}>{t.subject}</p>
                    <p style={{ fontSize: 11, color: colors.text.muted, margin: '1px 0 0' }}>#{t.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: s.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                    {s.label}
                  </span>
                  <span style={{ fontSize: 12, color: priorityColor(t.priority), fontWeight: 500, textTransform: 'capitalize' }}>{t.priority}</span>
                  <span style={{ fontSize: 12, color: colors.text.muted }}>{fmtDate(t.created_at)}</span>
                  <ChevronRight size={14} color={colors.text.muted} />
                </div>
              )
            })
          )}
        </div>
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
      {activeTicket && <TicketThread ticket={activeTicket} onClose={() => setActive(null)} />}
    </div>
  )
}
