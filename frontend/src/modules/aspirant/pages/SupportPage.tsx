import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MessageSquare, X, Send, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { candidateSupportApi, type CreateTicketPayload, type TicketDetail } from '@/api/support'
import { getApiError } from '@/api/client'
import AspLayout from '@/shared/layouts/AspLayout'
import PageHeader from '@/shared/layouts/PageHeader'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'open')     return '#3B82F6'
  if (s === 'pending')  return '#F59E0B'
  if (s === 'resolved') return '#10B981'
  if (s === 'closed')   return '#6B7280'
  return '#6B7280'
}

function priorityColor(p: string) {
  if (p === 'urgent') return '#EF4444'
  if (p === 'high')   return '#F97316'
  if (p === 'normal') return '#3B82F6'
  return '#6B7280'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTicketPayload>({
    subject: '', body: '', priority: 'normal', category: 'general',
  })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => candidateSupportApi.createTicket(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['candidate-tickets'] }); onClose() },
    onError: (e) => setError(getApiError(e)),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0F172A' }}>New Support Ticket</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#64748B" /></button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Briefly describe your issue"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#0F172A', outline: 'none', background: '#fff' }}>
                <option value="general">General</option>
                <option value="technical">Technical</option>
                <option value="account">Account</option>
                <option value="jobs">Jobs / Applications</option>
                <option value="interview">Interview</option>
                <option value="roadmap">Roadmap</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#0F172A', outline: 'none', background: '#fff' }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Provide details about your issue…"
              rows={4}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#0F172A', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151' }}>Cancel</button>
          <button
            onClick={() => create.mutate()}
            disabled={!form.subject.trim() || create.isPending}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: form.subject.trim() ? '#4F7FE8' : '#CBD5E1', color: '#fff', cursor: form.subject.trim() ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600 }}
          >
            {create.isPending ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ticket Thread Panel ───────────────────────────────────────────────────────

function TicketThread({ ticketId, reporterId, onClose }: { ticketId: string; reporterId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-ticket', ticketId],
    queryFn: () => candidateSupportApi.getTicket(ticketId),
    select: r => r.data,
  })

  const send = useMutation({
    mutationFn: () => candidateSupportApi.addMessage(ticketId, { body: msg }),
    onSuccess: () => {
      setMsg('')
      qc.invalidateQueries({ queryKey: ['candidate-ticket', ticketId] })
    },
  })

  const ticket = data as TicketDetail | undefined

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{ticket?.subject ?? '…'}</p>
            {ticket && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${statusColor(ticket.status)}18`, color: statusColor(ticket.status) }}>{ticket.status}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${priorityColor(ticket.priority)}18`, color: priorityColor(ticket.priority) }}>{ticket.priority}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#64748B" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isLoading && <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading…</p>}
          {ticket?.body && (
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{ticket.body}</p>
            </div>
          )}
          {ticket?.messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_id === (reporterId ?? ticket.reporter_id) ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', background: m.sender_id === (reporterId ?? ticket.reporter_id) ? '#EEF4FF' : '#F1F5F9', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#64748B' }}>{m.sender_name ?? 'Support'}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#0F172A', whiteSpace: 'pre-wrap' }}>{m.body}</p>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94A3B8' }}>{fmtDate(m.created_at)}</p>
            </div>
          ))}
        </div>

        {ticket && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(37,99,235,0.08)', display: 'flex', gap: 10, flexShrink: 0 }}>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, resize: 'none', outline: 'none' }}
            />
            <button
              onClick={() => send.mutate()}
              disabled={!msg.trim() || send.isPending}
              style={{ padding: '0 14px', border: 'none', borderRadius: 8, background: msg.trim() ? '#4F7FE8' : '#CBD5E1', color: '#fff', cursor: msg.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CandidateSupportPage() {
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<{ id: string; reporterId: string | null } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-tickets'],
    queryFn: () => candidateSupportApi.listTickets(),
    select: r => r.data,
  })

  const tickets = data?.items ?? []

  return (
    <AspLayout activePath="/app/support">
      <PageHeader
        title="Support"
        subtitle="Get help from the Disha team"
        actions={
          <button
            onClick={() => setShowNew(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: 'none', borderRadius: 10, background: '#1A2744', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> New Ticket
          </button>
        }
      />

      <main style={{ padding: '28px 32px', flex: 1, maxWidth: 900 }}>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
      {selected && <TicketThread ticketId={selected.id} reporterId={selected.reporterId} onClose={() => setSelected(null)} />}

      {/* Ticket list */}
      {isLoading && <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading tickets…</p>}

      {!isLoading && tickets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#F8FAFC', borderRadius: 14, border: '1px dashed #E2E8F0' }}>
          <MessageSquare size={36} color="#CBD5E1" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#64748B' }}>No tickets yet</p>
          <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#94A3B8' }}>Submit a ticket and our support team will respond shortly.</p>
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#4F7FE8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Submit your first ticket
          </button>
        </div>
      )}

      {tickets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => setSelected({ id: t.id, reporterId: t.reporter_id })}
              style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'box-shadow 0.2s, border-color 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#CBD5E1' }}
              onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#F1F5F9' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor(t.status)}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.status === 'resolved' || t.status === 'closed'
                  ? <CheckCircle2 size={17} color={statusColor(t.status)} />
                  : t.status === 'pending' ? <Clock size={17} color={statusColor(t.status)} />
                  : <AlertCircle size={17} color={statusColor(t.status)} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94A3B8' }}>#{t.id.slice(0, 8)} · {t.category} · {fmtDate(t.created_at)}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: `${statusColor(t.status)}18`, color: statusColor(t.status) }}>{t.status}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: `${priorityColor(t.priority)}18`, color: priorityColor(t.priority) }}>{t.priority}</span>
              </div>
              {t.message_count > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <MessageSquare size={13} color="#94A3B8" />
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{t.message_count}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </main>
    </AspLayout>
  )
}
