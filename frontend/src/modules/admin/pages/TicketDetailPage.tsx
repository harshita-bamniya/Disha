import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, MessageSquare, User, Paperclip, Lock,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown,
} from 'lucide-react'
import { useAdminTicket, useUpdateTicket, useAddTicketMessage } from '../hooks/useAdmin'
import { Spinner, Breadcrumb } from '../shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'


const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low:    'bg-gray-100 text-gray-500',
}
const STATUS_COLORS: Record<string, string> = {
  open:     'bg-blue-50 text-blue-700',
  pending:  'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  closed:   'bg-gray-100 text-gray-500',
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const TABS = [
  { key: 'conversation', label: 'Conversation', icon: MessageSquare },
  { key: 'user',         label: 'User Info',    icon: User },
  { key: 'attachments',  label: 'Attachments',  icon: Paperclip },
]

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const activeTab = (sp.get('tab') ?? 'conversation') as 'conversation' | 'user' | 'attachments'
  const setTab = (t: string) => setSp({ tab: t })

  const { data: ticket, isLoading } = useAdminTicket(id)
  const updateTicket = useUpdateTicket(id!)
  const addMessage   = useAddTicketMessage(id!)

  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  if (isLoading) return <Spinner />
  if (!ticket) return <div style={{ padding: 32, fontSize: 14, color: colors.text.muted }}>Ticket not found</div>

  const handleSend = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await addMessage.mutateAsync({ body: reply.trim(), is_internal: isInternal })
      setReply('')
    } finally {
      setSending(false)
    }
  }

  const handleStatus = (status: string) => updateTicket.mutate({ status })
  const handlePriority = (priority: string) => updateTicket.mutate({ priority })

  return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[
        { label: 'Support', href: '/admin/support' },
        { label: ticket.subject },
      ]} />

      <div className="flex items-start gap-6" style={{ flexWrap: 'wrap' }}>
        {/* ── Main content ─────────────────────── */}
        <div className="min-w-0 flex flex-col gap-4" style={{ flex: '1 1 320px' }}>
          {/* Header */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px 24px' }}>
            <button
              onClick={() => navigate('/admin/support')}
              className="flex items-center gap-1 mb-3"
              style={{ fontSize: 12, color: colors.text.muted, background: 'transparent', border: 'none' }}
            >
              <ArrowLeft size={13} /> Back to tickets
            </button>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
                  {ticket.subject}
                </h1>
                <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 4 }}>
                  Ticket #{ticket.id.slice(0, 8).toUpperCase()} · Opened {fmt(ticket.created_at)}
                  {ticket.reporter_name && ` · ${ticket.reporter_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full capitalize', STATUS_COLORS[ticket.status])}>
                  {ticket.status}
                </span>
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full capitalize', PRIORITY_COLORS[ticket.priority])}>
                  {ticket.priority}
                </span>
              </div>
            </div>
            {ticket.body && (
              <div style={{ marginTop: 16, fontSize: 14, color: colors.text.ink, background: colors.surface.bg, borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap' }}>
                {ticket.body}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 2, padding: '12px 16px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', background: colors.surface.bg }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none',
                    background: activeTab === t.key ? '#fff' : 'transparent',
                    color: activeTab === t.key ? colors.text.ink : colors.text.muted,
                    borderBottom: activeTab === t.key ? '2px solid ' + colors.brand.navy : 'none',
                    marginBottom: activeTab === t.key ? -1 : 0,
                  }}
                >
                  <t.icon size={12} /> {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {/* ── Conversation tab ─────────────────────── */}
              {activeTab === 'conversation' && (
                <div className="flex flex-col gap-4">
                  {ticket.messages.length === 0 && (
                    <p style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', padding: '24px 0' }}>No messages yet</p>
                  )}
                  {ticket.messages.map(msg => (
                    <div key={msg.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 4, borderRadius: 10, padding: '12px 16px', fontSize: 14,
                      background: msg.is_internal ? '#FFFBEB' : colors.surface.bg,
                      border: msg.is_internal ? '1px solid #FDE68A' : '1px solid rgba(0,0,0,0.08)',
                    }}>
                      <div className="flex items-center gap-2" style={{ fontSize: 10, color: colors.text.muted, fontWeight: 600 }}>
                        {msg.is_internal && <Lock size={10} style={{ color: '#F59E0B' }} />}
                        <span style={{ color: colors.text.ink, fontWeight: 700 }}>{msg.sender_name ?? 'System'}</span>
                        {msg.is_internal && <span style={{ color: '#D97706' }}>Internal note</span>}
                        <span style={{ marginLeft: 'auto' }}>{fmt(msg.created_at)}</span>
                      </div>
                      <p style={{ color: colors.text.ink, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                    </div>
                  ))}

                  {/* Reply box */}
                  <div style={{ marginTop: 8, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type a reply…"
                      rows={4}
                      style={{ width: '100%', padding: '12px 16px', fontSize: 14, color: colors.text.ink, outline: 'none', resize: 'none', border: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: colors.surface.bg, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ fontSize: 12, color: colors.text.muted }}>
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                          className="rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
                        <Lock size={11} style={{ color: '#F59E0B' }} /> Internal note
                      </label>
                      <button
                        onClick={handleSend}
                        disabled={sending || !reply.trim()}
                        style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 8, background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', opacity: (sending || !reply.trim()) ? 0.4 : 1 }}
                      >
                        {sending ? 'Sending…' : isInternal ? 'Add Note' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── User Info tab ─────────────────────────── */}
              {activeTab === 'user' && (
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Reporter', value: ticket.reporter_name ?? '—' },
                    { label: 'Phone', value: ticket.reporter_phone ?? '—' },
                    { label: 'Reporter ID', value: ticket.reporter_id ?? '—' },
                    { label: 'Entity Type', value: ticket.entity_type },
                    { label: 'Entity ID', value: ticket.entity_id ?? '—' },
                    { label: 'Assigned To', value: ticket.assignee_name ?? 'Unassigned' },
                    { label: 'SLA Deadline', value: ticket.sla_deadline ? fmt(ticket.sla_deadline) : '—' },
                    { label: 'Resolved At', value: ticket.resolved_at ? fmt(ticket.resolved_at) : '—' },
                    { label: 'Closed At', value: ticket.closed_at ? fmt(ticket.closed_at) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.muted }}>{label}</span>
                      <span style={{ fontSize: 12, color: colors.text.ink, fontWeight: 500, maxWidth: '60%', textAlign: 'right' }} className="truncate">{value}</span>
                    </div>
                  ))}
                  {ticket.reporter_id && (
                    <button
                      onClick={() => navigate(`/admin/candidates/${ticket.reporter_id}`)}
                      style={{ marginTop: 8, fontSize: 12, color: colors.brand.navy, fontWeight: 600, background: 'transparent', border: 'none', textAlign: 'left' }}
                    >
                      View candidate profile →
                    </button>
                  )}
                </div>
              )}

              {/* ── Attachments tab ───────────────────────── */}
              {activeTab === 'attachments' && (
                <div className="flex flex-col gap-2">
                  {ticket.attachments.length === 0 ? (
                    <p style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', padding: '24px 0' }}>No attachments</p>
                  ) : ticket.attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-3" style={{ padding: '10px 12px', background: colors.surface.bg, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}>
                      <Paperclip size={14} style={{ color: colors.text.muted, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink }} className="truncate">{a.filename}</p>
                        <p style={{ fontSize: 10, color: colors.text.muted }}>
                          {a.content_type ?? 'unknown type'}
                          {a.size_bytes ? ` · ${(a.size_bytes / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Action sidebar ────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ flex: '0 1 240px', minWidth: 200 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>Actions</p>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: 10, fontWeight: 600, color: colors.text.muted }}>Status</label>
              <select
                value={ticket.status}
                onChange={e => handleStatus(e.target.value)}
                style={{ height: 32, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, color: colors.text.ink, padding: '0 8px', outline: 'none', background: '#fff' }}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: 10, fontWeight: 600, color: colors.text.muted }}>Priority</label>
              <select
                value={ticket.priority}
                onChange={e => handlePriority(e.target.value)}
                style={{ height: 32, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, color: colors.text.ink, padding: '0 8px', outline: 'none', background: '#fff' }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => handleStatus('resolved')}
                disabled={ticket.status === 'resolved'}
                className="flex items-center gap-2 w-full"
                style={{ padding: '8px 12px', borderRadius: 10, background: '#F0FDF4', color: '#15803D', fontSize: 12, fontWeight: 700, border: 'none', opacity: ticket.status === 'resolved' ? 0.4 : 1 }}
              >
                <CheckCircle2 size={13} /> Mark Resolved
              </button>
              <button
                onClick={() => handleStatus('closed')}
                disabled={ticket.status === 'closed'}
                className="flex items-center gap-2 w-full"
                style={{ padding: '8px 12px', borderRadius: 10, background: colors.surface.bg, color: colors.text.ink, fontSize: 12, fontWeight: 700, border: 'none', opacity: ticket.status === 'closed' ? 0.4 : 1 }}
              >
                <XCircle size={13} /> Close Ticket
              </button>
              {ticket.priority !== 'urgent' && (
                <button
                  onClick={() => handlePriority('urgent')}
                  className="flex items-center gap-2 w-full"
                  style={{ padding: '8px 12px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 700, border: 'none' }}
                >
                  <AlertTriangle size={13} /> Escalate
                </button>
              )}
            </div>
          </div>

          {/* Ticket meta */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 4 }}>Details</p>
            {[
              { label: 'Entity', value: ticket.entity_type },
              { label: 'Assignee', value: ticket.assignee_name ?? 'Unassigned' },
              { label: 'Messages', value: String(ticket.messages?.length ?? ticket.message_count) },
              { label: 'Opened', value: fmt(ticket.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: colors.text.muted, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: colors.text.ink, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
