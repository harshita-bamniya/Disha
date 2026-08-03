import { useState, useMemo } from 'react'
import { Shield, X, Clock, AlertTriangle } from 'lucide-react'
import { useEmployerVerifications, useEmployerVerificationDetail, useReviewEmployerVerification } from '../hooks/useAdmin'
import { Spinner, Empty, Badge, SectionHeading, VERIF_STATUS_COLOR } from '../shared/adminUI'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

const SLA_DAYS = 3

function daysInQueue(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function SlaBadge({ submittedAt, status }: { submittedAt: string; status: string }) {
  if (status !== 'requested' && status !== 'under_review') return null
  const d = daysInQueue(submittedAt)
  const color = d > SLA_DAYS ? 'bg-red-100 text-red-700' : d >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', color)}>
      <Clock className="w-2.5 h-2.5" />{d}d
    </span>
  )
}

function VerificationDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: v, isLoading } = useEmployerVerificationDetail(id)
  const review = useReviewEmployerVerification()
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', color: N.ink }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white flex flex-col overflow-hidden" style={{ borderLeft: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: N.ink }}>{isLoading ? 'Loading…' : v?.company_name}</h3>
            {v && (
              <div className="flex items-center gap-2 mt-1">
                <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>
                <SlaBadge submittedAt={v.submitted_at} status={v.status} />
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ color: N.muted }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? <Spinner /> : !v ? (
            <p className="text-sm text-center py-10" style={{ color: N.muted }}>Could not load verification.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <SectionHeading>Employer Info</SectionHeading>
              <div className="px-3 py-3 mb-3 text-xs flex flex-col gap-1" style={{ background: N.cream, borderRadius: 8 }}>
                <p style={{ color: N.ink }}><span style={{ color: N.muted }}>Company:</span> <strong>{v.company_name}</strong></p>
                {v.contact_email && <p style={{ color: N.ink }}><span style={{ color: N.muted }}>Email:</span> {v.contact_email}</p>}
                {v.contact_phone && <p style={{ color: N.ink }}><span style={{ color: N.muted }}>Phone:</span> {v.contact_phone}</p>}
                <p style={{ color: N.ink }}><span style={{ color: N.muted }}>Requested:</span> {new Date(v.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              <SectionHeading>Timeline</SectionHeading>
              <div className="flex flex-col gap-2 mb-3">
                {v.events.map(e => (
                  <div key={e.id} className="text-xs">
                    <p className="font-semibold" style={{ color: N.ink }}>{e.from_status ? `${e.from_status.replace(/_/g,' ')} → ` : ''}{e.to_status.replace(/_/g,' ')}</p>
                    <p style={{ color: N.muted }}>{e.actor_name ?? 'System'} · {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    {e.note && <p className="mt-0.5" style={{ color: '#475569' }}>{e.note}</p>}
                  </div>
                ))}
              </div>

              {v.status !== 'approved' && (
                <>
                  <SectionHeading>Action</SectionHeading>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes (optional)…"
                    className="w-full px-3 py-2 text-xs outline-none resize-none mb-2"
                    style={inputStyle}
                  />
                  <div className="flex gap-2">
                    {(v.status === 'requested') && (
                      <button
                        onClick={() => review.mutate({ id, action: 'under_review', notes: notes.trim() || undefined })}
                        disabled={review.isPending}
                        className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 8 }}
                      >Mark Under Review</button>
                    )}
                    <button
                      onClick={() => review.mutate({ id, action: 'approve', notes: notes.trim() || undefined })}
                      disabled={review.isPending}
                      className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                      style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 8 }}
                    >Approve</button>
                    <button
                      onClick={() => setShowReject(true)}
                      disabled={review.isPending}
                      className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                      style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8 }}
                    >Reject</button>
                  </div>
                  {showReject && (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Rejection reason (required)…"
                        className="w-full px-3 py-2 text-xs outline-none resize-none"
                        style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', color: N.ink }}
                      />
                      <button
                        onClick={() => rejectReason.trim() && review.mutate(
                          { id, action: 'reject', notes: notes.trim() || undefined, rejection_reason: rejectReason.trim() },
                          { onSuccess: () => setShowReject(false) },
                        )}
                        disabled={!rejectReason.trim() || review.isPending}
                        className="h-9 text-xs font-semibold disabled:opacity-40"
                        style={{ background: '#EF4444', color: '#fff', borderRadius: 8, border: 'none' }}
                      >Confirm Rejection</button>
                    </div>
                  )}
                  {review.isError && <p className="text-xs text-red-500 mt-2">{getApiError(review.error)}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KycQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>('requested')
  const { data: list, isLoading } = useEmployerVerifications(statusFilter)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const overdue = useMemo(
    () => (list ?? []).filter(v => (v.status === 'requested' || v.status === 'under_review') && daysInQueue(v.submitted_at) > SLA_DAYS).length,
    [list],
  )

  const sorted = useMemo(() => {
    if (!list) return []
    if (statusFilter === 'requested' || statusFilter === 'under_review') {
      return [...list].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    }
    return list
  }, [list, statusFilter])

  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>KYC Verification</h1>

      {overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16 }}>
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-700">
            {overdue} verification{overdue !== 1 ? 's' : ''} past the {SLA_DAYS}-day SLA threshold
          </p>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 className="text-sm font-bold" style={{ color: N.ink }}>Employer Verification Queue</h2>
          <select
            value={statusFilter ?? ''}
            onChange={e => setStatusFilter(e.target.value || undefined)}
            className="h-8 px-2 text-xs outline-none"
            style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }}
          >
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isLoading ? <Spinner /> : sorted.length === 0 ? (
          <Empty icon={Shield} text="No verifications match this filter" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Company', 'Days', 'In Queue', 'Status'].map((h, i) => (
                <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {sorted.map((v, idx) => {
              const d = daysInQueue(v.submitted_at)
              const isOverdue = (v.status === 'requested' || v.status === 'under_review') && d > SLA_DAYS
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 cursor-pointer"
                  style={{
                    background: isOverdue ? '#FEF2F2' : idx % 2 === 0 ? '#fff' : N.cream,
                    borderBottom: idx < sorted.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                  onMouseOut={e => (e.currentTarget.style.background = isOverdue ? '#FEF2F2' : idx % 2 === 0 ? '#fff' : N.cream)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{v.company_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: N.muted }}>
                      Submitted {new Date(v.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-right self-center" style={{ color: N.ink }}>
                    {daysInQueue(v.submitted_at)}d
                  </span>
                  <div className="flex items-center justify-end">
                    <SlaBadge submittedAt={v.submitted_at} status={v.status} />
                  </div>
                  <div className="flex items-center justify-end">
                    <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              )
            })}
            <div className="px-4 py-2.5" style={{ background: N.cream, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-xs" style={{ color: N.muted }}>{sorted.length} verification{sorted.length !== 1 ? 's' : ''}{overdue > 0 ? ` · ${overdue} overdue` : ''}</p>
            </div>
          </>
        )}
      </div>

      {selectedId && <VerificationDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}
