import { useState, useMemo } from 'react'
import { Shield, Clock, AlertTriangle } from 'lucide-react'
import { useEmployerVerifications, useEmployerVerificationDetail, useReviewEmployerVerification, useReviewVerificationDocument } from '../hooks/useAdmin'
import { Spinner, Badge, SectionHeading, VERIF_STATUS_COLOR } from '../shared/adminUI'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'
import Drawer from '@/shared/components/overlays/Drawer'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import { adminApi } from '@/api/admin'
import type { EmployerVerificationEntry, VerificationReviewPayload } from '@/api/admin'


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

const ENTITY_FIELD_LABELS: Record<string, string> = {
  gstin: 'GSTIN', pan: 'PAN', cin: 'CIN', llpin: 'LLPIN', udyam: 'Udyam', darpan_id: 'NGO Darpan ID',
  registration_number: 'Registration no.', business_email: 'Business email', website: 'Website',
  registered_address: 'Registered address', signatory_name: 'Authorised person', signatory_designation: 'Designation',
}

const CHECK_STYLE = {
  ok:   { fg: '#15803D', bg: '#F0FDF4', icon: '✓' },
  warn: { fg: '#B45309', bg: '#FFFBEB', icon: '!' },
  fail: { fg: '#B91C1C', bg: '#FEF2F2', icon: '✕' },
}

function VerificationDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: v, isLoading } = useEmployerVerificationDetail(id)
  const review = useReviewEmployerVerification()
  const docReview = useReviewVerificationDocument()
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<null | 'reject' | 'info'>(null)
  const [reasonCode, setReasonCode] = useState('')
  const [rejectText, setRejectText] = useState('')
  const [infoText, setInfoText] = useState('')
  const [override, setOverride] = useState(false)
  const [docNote, setDocNote] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', color: colors.text.ink }
  const canAct = !!v && ['requested', 'under_review', 'needs_info'].includes(v.status)
  const inReview = !!v && ['requested', 'under_review'].includes(v.status)
  const failed = (v?.auto_checks ?? []).filter(c => c.level === 'fail')

  const run = (payload: Omit<VerificationReviewPayload, never>, after?: () => void) => {
    setError(null)
    review.mutate({ id, ...payload }, { onSuccess: () => { after?.(); setMode(null); setNotes('') }, onError: e => setError(getApiError(e)) })
  }

  const detailRows = v?.details
    ? Object.entries(v.details).filter(([k, val]) => k !== 'declarations' && val)
    : []
  const decl = (v?.details?.declarations ?? {}) as Record<string, boolean>

  return (
    <Drawer
      open
      onClose={onClose}
      title={isLoading ? 'Loading…' : v?.company_name}
      header={
        v && (
          <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
            <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>
            <SlaBadge submittedAt={v.submitted_at} status={v.status} />
            {v.entity_label && <span className="text-[11px]" style={{ color: colors.text.muted }}>{v.entity_label}</span>}
            {v.attempt_no > 1 && <Badge color="purple">attempt {v.attempt_no}</Badge>}
          </div>
        )
      }
    >
      <div className="px-5 py-4">
        {isLoading ? <Spinner /> : !v ? (
          <p className="text-sm text-center py-10" style={{ color: colors.text.muted }}>Could not load verification.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <SectionHeading>Account</SectionHeading>
            <div className="px-3 py-3 mb-3 text-xs flex flex-col gap-1" style={{ background: colors.surface.bg, borderRadius: 8 }}>
              <p style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>Company:</span> <strong>{v.company?.name ?? v.company_name}</strong>{v.company?.industry ? ` · ${v.company.industry}` : ''}{v.company?.size ? ` · ${v.company.size}` : ''}</p>
              <p style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>Login email:</span> {v.account_email ?? '—'} {v.email_verified ? '(verified)' : '(NOT verified)'}</p>
              {v.account_phone && <p style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>Phone:</span> {v.account_phone}</p>}
              {v.company?.website && <p style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>Website:</span> {v.company.website}</p>}
              <p style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>Submitted:</span> {new Date(v.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}{v.previous_attempts > 0 ? ` · ${v.previous_attempts} earlier rejected attempt(s)` : ''}</p>
            </div>

            <SectionHeading>Submitted details</SectionHeading>
            <div className="px-3 py-3 mb-3 text-xs flex flex-col gap-1" style={{ background: colors.surface.bg, borderRadius: 8 }}>
              {detailRows.length === 0 && <p style={{ color: colors.text.muted }}>No structured details (case predates the guided form).</p>}
              {detailRows.map(([k, val]) => (
                <p key={k} style={{ color: colors.text.ink }}><span style={{ color: colors.text.muted }}>{ENTITY_FIELD_LABELS[k] ?? k}:</span> <span className="font-mono">{String(val)}</span></p>
              ))}
              {Object.keys(decl).length > 0 && (
                <p style={{ color: colors.text.muted }}>Declarations: {Object.entries(decl).map(([k, val]) => `${k.replace(/_/g, ' ')} ${val ? '✓' : '✕'}`).join(' · ')}</p>
              )}
            </div>

            <SectionHeading>Automatic checks</SectionHeading>
            <div className="flex flex-col gap-1 mb-3">
              {v.auto_checks.length === 0 && <p className="text-xs" style={{ color: colors.text.muted }}>None recorded.</p>}
              {v.auto_checks.map(c => (
                <p key={c.code} className="text-xs px-2 py-1.5" style={{ color: CHECK_STYLE[c.level].fg, background: CHECK_STYLE[c.level].bg, borderRadius: 6 }}>
                  <strong>{CHECK_STYLE[c.level].icon}</strong> {c.message}
                </p>
              ))}
              <p className="text-[11px] mt-1" style={{ color: colors.text.muted }}>
                Format checks only. Also confirm the entity on the GST portal / MCA / NGO Darpan before approving.
              </p>
            </div>

            <SectionHeading>Documents ({v.documents.length})</SectionHeading>
            <div className="flex flex-col gap-2 mb-3">
              {v.documents.length === 0 && <p className="text-xs" style={{ color: '#B91C1C' }}>No documents uploaded.</p>}
              {v.documents.map(d => (
                <div key={d.id} className="px-3 py-2 text-xs" style={{ background: colors.surface.bg, borderRadius: 8 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: colors.text.ink }}>{d.label ?? d.doc_type}</p>
                      <p className="truncate" style={{ color: colors.text.muted }}>{d.original_filename}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge color={d.status === 'verified' ? 'green' : d.status === 'rejected' ? 'red' : 'gray'}>{d.status}</Badge>
                      <button onClick={() => adminApi.downloadVerificationDocument(v.id, d.id, d.original_filename ?? 'document')}
                        className="font-semibold underline" style={{ color: '#1D4ED8' }}>Open</button>
                    </div>
                  </div>
                  {d.notes && <p className="mt-1" style={{ color: '#B91C1C' }}>Note: {d.notes}</p>}
                  {inReview && (
                    <div className="flex items-center gap-2 mt-2">
                      <input value={docNote[d.id] ?? ''} onChange={e => setDocNote(n => ({ ...n, [d.id]: e.target.value }))}
                        placeholder="Note (required to reject)" className="flex-1 h-7 px-2 text-xs outline-none" style={inputStyle} />
                      <button disabled={docReview.isPending} onClick={() => docReview.mutate({ id, documentId: d.id, status: 'verified', notes: docNote[d.id]?.trim() || undefined }, { onError: e => setError(getApiError(e)) })}
                        className="h-7 px-2 font-semibold" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 6 }}>Accept</button>
                      <button disabled={docReview.isPending} onClick={() => docReview.mutate({ id, documentId: d.id, status: 'rejected', notes: docNote[d.id]?.trim() }, { onError: e => setError(getApiError(e)) })}
                        className="h-7 px-2 font-semibold" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6 }}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {v.missing.length > 0 && (
                <p className="text-xs" style={{ color: '#B45309' }}>Missing for this organisation type: {v.missing.join(' ')}</p>
              )}
            </div>

            {v.info_request && v.status === 'needs_info' && (
              <>
                <SectionHeading>Waiting on the employer</SectionHeading>
                <p className="text-xs mb-3 px-3 py-2" style={{ background: '#FFFBEB', borderRadius: 8, color: '#92400E' }}>{v.info_request}</p>
              </>
            )}
            {v.status === 'rejected' && (
              <>
                <SectionHeading>Rejected</SectionHeading>
                <p className="text-xs mb-3 px-3 py-2" style={{ background: '#FEF2F2', borderRadius: 8, color: '#991B1B' }}>
                  {v.reason_code ? `[${v.reason_code}] ` : ''}{v.rejection_reason}
                </p>
              </>
            )}

            <SectionHeading>Timeline</SectionHeading>
            <div className="flex flex-col gap-2 mb-3">
              {v.events.map(e => (
                <div key={e.id} className="text-xs">
                  <p className="font-semibold" style={{ color: colors.text.ink }}>{e.from_status ? `${e.from_status.replace(/_/g, ' ')} → ` : ''}{e.to_status.replace(/_/g, ' ')}</p>
                  <p style={{ color: colors.text.muted }}>{e.actor_name ?? 'System'} · {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  {e.note && <p className="mt-0.5" style={{ color: '#475569' }}>{e.note}</p>}
                </div>
              ))}
            </div>

            {canAct && (
              <>
                <SectionHeading>Decision</SectionHeading>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Internal notes (required to approve over a failed check)…"
                  className="w-full px-3 py-2 text-xs outline-none resize-none mb-2" style={inputStyle} />
                {failed.length > 0 && inReview && (
                  <label className="flex items-start gap-2 text-xs mb-2" style={{ color: '#B91C1C' }}>
                    <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} className="mt-0.5" />
                    Approve despite {failed.length} failed automatic check{failed.length > 1 ? 's' : ''} (I have verified manually; note above explains why)
                  </label>
                )}
                <div className="flex gap-2 flex-wrap">
                  {(v.status === 'requested' || v.status === 'needs_info') && (
                    <button onClick={() => run({ action: 'under_review', notes: notes.trim() || undefined })} disabled={review.isPending}
                      className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                      style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 8 }}>Mark Under Review</button>
                  )}
                  {inReview && (
                    <>
                      <button onClick={() => run({ action: 'approve', notes: notes.trim() || undefined, override_checks: override })} disabled={review.isPending}
                        className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 8 }}>Approve</button>
                      <button onClick={() => setMode(mode === 'info' ? null : 'info')} disabled={review.isPending}
                        className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 8 }}>Request info</button>
                    </>
                  )}
                  <button onClick={() => setMode(mode === 'reject' ? null : 'reject')} disabled={review.isPending}
                    className="flex-1 h-9 text-xs font-semibold disabled:opacity-50"
                    style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8 }}>Reject</button>
                </div>

                {mode === 'info' && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea value={infoText} onChange={e => setInfoText(e.target.value)} rows={3}
                      placeholder="Exactly what the employer must provide or fix (emailed to them)…"
                      className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ border: '1px solid #FDE68A', borderRadius: 8, background: '#FFFBEB', color: colors.text.ink }} />
                    <button onClick={() => infoText.trim() && run({ action: 'request_info', info_request: infoText.trim(), notes: notes.trim() || undefined }, () => setInfoText(''))}
                      disabled={!infoText.trim() || review.isPending} className="h-9 text-xs font-semibold disabled:opacity-40"
                      style={{ background: '#D97706', color: '#fff', borderRadius: 8, border: 'none' }}>Send request</button>
                  </div>
                )}
                {mode === 'reject' && (
                  <div className="mt-2 flex flex-col gap-2">
                    <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} className="h-9 px-2 text-xs outline-none" style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#fff', color: colors.text.ink }}>
                      <option value="">Select a reason code…</option>
                      {Object.entries(v.reason_codes).map(([code, text]) => <option key={code} value={code}>{code} — {text}</option>)}
                    </select>
                    <textarea value={rejectText} onChange={e => setRejectText(e.target.value)} rows={2}
                      placeholder="Message to the employer (optional — defaults to the reason text)…"
                      className="w-full px-3 py-2 text-xs outline-none resize-none" style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', color: colors.text.ink }} />
                    <button onClick={() => reasonCode && run({ action: 'reject', reason_code: reasonCode, rejection_reason: rejectText.trim() || undefined, notes: notes.trim() || undefined }, () => setRejectText(''))}
                      disabled={!reasonCode || review.isPending} className="h-9 text-xs font-semibold disabled:opacity-40"
                      style={{ background: '#EF4444', color: '#fff', borderRadius: 8, border: 'none' }}>Confirm rejection</button>
                  </div>
                )}
                {(error || review.isError) && <p className="text-xs text-red-500 mt-2">{error ?? getApiError(review.error)}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </Drawer>
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

  const columns: TableColumn<EmployerVerificationEntry>[] = useMemo(() => [
    {
      key: 'company_name',
      header: 'Company',
      render: row => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>{row.company_name}</p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            Submitted {new Date(row.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
          </p>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      width: 60,
      render: row => <span className="text-xs font-bold" style={{ color: colors.text.ink }}>{daysInQueue(row.submitted_at)}d</span>,
    },
    {
      key: 'sla',
      header: 'In Queue',
      align: 'right',
      width: 90,
      render: row => <SlaBadge submittedAt={row.submitted_at} status={row.status} />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      width: 110,
      render: row => <Badge color={VERIF_STATUS_COLOR[row.status] ?? 'gray'}>{row.status.replace(/_/g, ' ')}</Badge>,
    },
  ], [])

  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>KYC Verification</h1>

      {overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16 }}>
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-700">
            {overdue} verification{overdue !== 1 ? 's' : ''} past the {SLA_DAYS}-day SLA threshold
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: colors.text.ink }}>Employer Verification Queue</h2>
          <select
            value={statusFilter ?? ''}
            onChange={e => setStatusFilter(e.target.value || undefined)}
            className="h-8 px-2 text-xs outline-none"
            style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: colors.text.ink }}
          >
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under review</option>
            <option value="needs_info">Needs info</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <DataTable<EmployerVerificationEntry>
          columns={columns}
          rows={sorted}
          rowKey={r => r.id}
          loading={isLoading}
          onRowClick={r => setSelectedId(r.id)}
          emptyIcon={<Shield size={28} color={colors.surface.elevated} />}
          emptyTitle="No verifications match this filter"
        />

        {sorted.length > 0 && (
          <p className="text-xs mt-2.5" style={{ color: colors.text.muted }}>
            {sorted.length} verification{sorted.length !== 1 ? 's' : ''}{overdue > 0 ? ` · ${overdue} overdue` : ''}
          </p>
        )}
      </div>

      {selectedId && <VerificationDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}
