import { useState, useMemo } from 'react'
import { Shield, Clock, AlertTriangle } from 'lucide-react'
import { useEmployerVerifications, useEmployerVerificationDetail, useReviewEmployerVerification, useReviewVerificationDocument } from '../hooks/useAdmin'
import { Spinner, Badge, VERIF_STATUS_COLOR } from '../shared/adminUI'
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
// Registry IDs are shown in monospace; the rest read as normal text. Long values take the full row.
const MONO_FIELDS = new Set(['gstin', 'pan', 'cin', 'llpin', 'udyam', 'darpan_id', 'registration_number'])
const WIDE_FIELDS = new Set(['registered_address', 'website', 'business_email'])
const FIELD_ORDER = ['cin', 'llpin', 'gstin', 'pan', 'udyam', 'darpan_id', 'registration_number', 'business_email', 'website',
  'signatory_name', 'signatory_designation', 'registered_address']
const DECLARATION_LABELS: Record<string, string> = {
  info_accurate: 'Information is accurate', authorised: 'Authorised to represent the organisation', no_candidate_fee: 'Never charges candidates',
}

const CHECK_STYLE = {
  ok:   { fg: '#15803D', bg: '#F0FDF4', icon: '✓' },
  warn: { fg: '#B45309', bg: '#FFFBEB', icon: '!' },
  fail: { fg: '#B91C1C', bg: '#FEF2F2', icon: '✕' },
}
type CheckLevel = keyof typeof CHECK_STYLE
type AutoCheck = { code: string; level: CheckLevel; message: string }

const fmtDate = (iso: string, withYear = true) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit' })

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ border: `1px solid ${colors.border.default}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: colors.surface.bg, borderBottom: `1px solid ${colors.border.default}` }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.text.inkSoft }}>{title}</h3>
        {aside}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  )
}

function Field({ label, children, wide, mono }: { label: string; children: React.ReactNode; wide?: boolean; mono?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, color: colors.text.muted }}>{label}</p>
      <p className={mono ? 'font-mono' : undefined} style={{ margin: '2px 0 0', fontSize: 13, color: colors.text.ink, overflowWrap: 'anywhere' }}>{children}</p>
    </div>
  )
}

const FIELD_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 20px' }

function CheckRow({ c }: { c: AutoCheck }) {
  const st = CHECK_STYLE[c.level]
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: st.bg, color: st.fg, fontSize: 12.5, lineHeight: 1.45, listStyle: 'none' }}>
      <strong style={{ width: 14, flexShrink: 0, textAlign: 'center' }}>{st.icon}</strong>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{c.message}</span>
    </li>
  )
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

  const inputStyle = { border: `1px solid ${colors.border.medium}`, borderRadius: 8, background: '#fff', color: colors.text.ink }
  const canAct = !!v && ['requested', 'under_review', 'needs_info'].includes(v.status)
  const inReview = !!v && ['requested', 'under_review'].includes(v.status)
  const checks = (v?.auto_checks ?? []) as AutoCheck[]
  const failed = checks.filter(c => c.level === 'fail')

  const run = (payload: Omit<VerificationReviewPayload, never>, after?: () => void) => {
    setError(null)
    review.mutate({ id, ...payload }, { onSuccess: () => { after?.(); setMode(null); setNotes('') }, onError: e => setError(getApiError(e)) })
  }

  const details = (v?.details ?? {}) as Record<string, unknown>
  const detailRows = Object.keys(details)
    .filter(k => k !== 'declarations' && details[k])
    .sort((x, y) => (FIELD_ORDER.indexOf(x) + 1 || 99) - (FIELD_ORDER.indexOf(y) + 1 || 99))
  const decl = (details.declarations ?? {}) as Record<string, boolean>

  // Checks about a specific upload sit on that document's card; the rest form the summary list.
  const docTypes = (v?.documents ?? []).map(d => d.doc_type)
  const checksForDoc = (type: string) => checks.filter(c => c.code.startsWith(`doc_${type}_`))
  const generalChecks = checks.filter(c => !docTypes.some(t => c.code.startsWith(`doc_${t}_`)))
  const order: Record<CheckLevel, number> = { fail: 0, warn: 1, ok: 2 }
  const sortedGeneral = [...generalChecks].sort((x, y) => order[x.level] - order[y.level])
  const attention = sortedGeneral.filter(c => c.level !== 'ok')
  const passed = sortedGeneral.filter(c => c.level === 'ok')
  const warnCount = checks.filter(c => c.level === 'warn').length
  const passedCount = checks.length - failed.length - warnCount

  const actionBtn = (bg: string, fg: string, border: string): React.CSSProperties =>
    ({ flex: '1 1 0', minWidth: 110, height: 38, fontSize: 13, fontWeight: 600, background: bg, color: fg, border: `1px solid ${border}`, borderRadius: 8, cursor: 'pointer' })

  const footer = v && canAct ? (
    <div style={{ padding: '14px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder="Internal notes (required to approve over a failed check)…"
        className="w-full px-3 py-2 outline-none resize-none" style={{ ...inputStyle, fontSize: 13 }} />
      {failed.length > 0 && inReview && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#B91C1C' }}>
          <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} style={{ marginTop: 3 }} />
          Approve despite {failed.length} failed automatic check{failed.length > 1 ? 's' : ''} (I have verified manually; the note above explains why)
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(v.status === 'requested' || v.status === 'needs_info') && (
          <button onClick={() => run({ action: 'under_review', notes: notes.trim() || undefined })} disabled={review.isPending}
            className="disabled:opacity-50" style={actionBtn(colors.surface.bg, colors.brand.navy, colors.border.strong)}>Mark under review</button>
        )}
        {inReview && (
          <>
            <button onClick={() => run({ action: 'approve', notes: notes.trim() || undefined, override_checks: override })} disabled={review.isPending}
              className="disabled:opacity-50" style={actionBtn('#16A34A', '#fff', '#16A34A')}>Approve</button>
            <button onClick={() => setMode(mode === 'info' ? null : 'info')} disabled={review.isPending}
              className="disabled:opacity-50" style={actionBtn('#FFFBEB', '#B45309', '#FDE68A')}>Request info</button>
          </>
        )}
        <button onClick={() => setMode(mode === 'reject' ? null : 'reject')} disabled={review.isPending}
          className="disabled:opacity-50" style={actionBtn('#FEF2F2', '#B91C1C', '#FECACA')}>Reject</button>
      </div>

      {mode === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={infoText} onChange={e => setInfoText(e.target.value)} rows={3}
            placeholder="Exactly what the employer must provide or fix (emailed to them)…"
            className="w-full px-3 py-2 outline-none resize-none" style={{ border: '1px solid #FDE68A', borderRadius: 8, background: '#FFFBEB', color: colors.text.ink, fontSize: 13 }} />
          <button onClick={() => infoText.trim() && run({ action: 'request_info', info_request: infoText.trim(), notes: notes.trim() || undefined }, () => setInfoText(''))}
            disabled={!infoText.trim() || review.isPending} className="disabled:opacity-40"
            style={{ height: 38, fontSize: 13, fontWeight: 600, background: '#D97706', color: '#fff', borderRadius: 8, border: 'none' }}>Send request</button>
        </div>
      )}
      {mode === 'reject' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} className="px-2 outline-none"
            style={{ height: 38, fontSize: 13, border: '1px solid #FECACA', borderRadius: 8, background: '#fff', color: colors.text.ink }}>
            <option value="">Select a reason code…</option>
            {Object.entries(v.reason_codes).map(([code, text]) => <option key={code} value={code}>{code} — {text}</option>)}
          </select>
          <textarea value={rejectText} onChange={e => setRejectText(e.target.value)} rows={2}
            placeholder="Message to the employer (optional — defaults to the reason text)…"
            className="w-full px-3 py-2 outline-none resize-none" style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', color: colors.text.ink, fontSize: 13 }} />
          <button onClick={() => reasonCode && run({ action: 'reject', reason_code: reasonCode, rejection_reason: rejectText.trim() || undefined, notes: notes.trim() || undefined }, () => setRejectText(''))}
            disabled={!reasonCode || review.isPending} className="disabled:opacity-40"
            style={{ height: 38, fontSize: 13, fontWeight: 600, background: '#DC2626', color: '#fff', borderRadius: 8, border: 'none' }}>Confirm rejection</button>
        </div>
      )}
      {(error || review.isError) && <p style={{ margin: 0, fontSize: 12.5, color: '#DC2626' }}>{error ?? getApiError(review.error)}</p>}
    </div>
  ) : undefined

  return (
    <Drawer
      open
      onClose={onClose}
      width={720}
      title={isLoading ? 'Loading…' : v?.company_name}
      footer={footer}
      header={
        v && (
          <div className="flex items-center gap-2 flex-wrap" style={{ padding: '10px 24px 14px', borderBottom: `1px solid ${colors.border.default}` }}>
            <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>
            <SlaBadge submittedAt={v.submitted_at} status={v.status} />
            {v.entity_label && <span style={{ fontSize: 12, color: colors.text.inkSoft }}>{v.entity_label}</span>}
            {v.attempt_no > 1 && <Badge color="purple">attempt {v.attempt_no}</Badge>}
          </div>
        )
      }
    >
      <div style={{ padding: 24 }}>
        {isLoading ? <Spinner /> : !v ? (
          <p className="text-sm text-center py-10" style={{ color: colors.text.muted }}>Could not load verification.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Account">
              <div style={FIELD_GRID}>
                <Field label="Company">{v.company?.name ?? v.company_name}{v.company?.industry ? ` · ${v.company.industry}` : ''}{v.company?.size ? ` · ${v.company.size}` : ''}</Field>
                <Field label="Submitted">{fmtDate(v.submitted_at)}{v.previous_attempts > 0 ? ` · ${v.previous_attempts} earlier rejected attempt(s)` : ''}</Field>
                <Field label="Login email">
                  {v.account_email ?? '—'}{' '}
                  <span style={{ color: v.email_verified ? '#15803D' : '#B91C1C', fontWeight: 600, fontSize: 12 }}>{v.email_verified ? 'verified' : 'NOT verified'}</span>
                </Field>
                {v.account_phone && <Field label="Phone">{v.account_phone}</Field>}
                {v.company?.website && <Field label="Company website" wide>{v.company.website}</Field>}
              </div>
            </Panel>

            <Panel title="Submitted details">
              {detailRows.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: colors.text.muted }}>No structured details (case predates the guided form).</p>
              ) : (
                <div style={FIELD_GRID}>
                  {detailRows.map(k => (
                    <Field key={k} label={ENTITY_FIELD_LABELS[k] ?? k} mono={MONO_FIELDS.has(k)} wide={WIDE_FIELDS.has(k)}>{String(details[k])}</Field>
                  ))}
                </div>
              )}
              {Object.keys(decl).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${colors.border.default}` }}>
                  {Object.entries(decl).map(([k, val]) => (
                    <span key={k} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, color: val ? '#15803D' : '#B91C1C', background: val ? '#F0FDF4' : '#FEF2F2' }}>
                      {val ? '✓' : '✕'} {DECLARATION_LABELS[k] ?? k.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Automatic checks"
              aside={checks.length > 0 && (
                <span style={{ fontSize: 12, color: colors.text.inkSoft }}>
                  {[
                    failed.length > 0 && <strong key="f" style={{ color: '#B91C1C' }}>{failed.length} failed</strong>,
                    warnCount > 0 && <strong key="w" style={{ color: '#B45309' }}>{warnCount} to review</strong>,
                    passedCount > 0 && <span key="p">{passedCount} passed</span>,
                  ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ' · ', el]), [])}
                </span>
              )}
            >
              {checks.length === 0 && <p style={{ margin: 0, fontSize: 13, color: colors.text.muted }}>None recorded.</p>}
              {attention.length > 0 && (
                <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attention.map(c => <CheckRow key={c.code} c={c} />)}
                </ul>
              )}
              {passed.length > 0 && (
                <details style={{ marginTop: attention.length > 0 ? 12 : 0 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, color: colors.text.inkSoft }}>{passed.length} check{passed.length > 1 ? 's' : ''} passed</summary>
                  <ul style={{ margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {passed.map(c => <CheckRow key={c.code} c={c} />)}
                  </ul>
                </details>
              )}
              <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.text.muted }}>
                Automatic checks cover format and consistency only. Confirm the entity on the GST portal / MCA / NGO Darpan before approving.
              </p>
            </Panel>

            <Panel title={`Documents (${v.documents.length})`}>
              {v.documents.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#B91C1C' }}>No documents uploaded.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {v.documents.map(d => (
                  <div key={d.id} style={{ border: `1px solid ${colors.border.default}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text.ink }}>{d.label ?? d.doc_type}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.text.muted, overflowWrap: 'anywhere' }}>{d.original_filename}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <Badge color={d.status === 'verified' ? 'green' : d.status === 'rejected' ? 'red' : 'gray'}>{d.status}</Badge>
                        <button onClick={() => adminApi.downloadVerificationDocument(v.id, d.id, d.original_filename ?? 'document')}
                          style={{ fontSize: 13, fontWeight: 600, color: colors.brand.navy, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Open</button>
                      </div>
                    </div>
                    {checksForDoc(d.doc_type).length > 0 && (
                      <ul style={{ margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {checksForDoc(d.doc_type).map(c => <CheckRow key={c.code} c={c} />)}
                      </ul>
                    )}
                    {d.notes && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#B91C1C' }}>Note: {d.notes}</p>}
                    {inReview && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <input value={docNote[d.id] ?? ''} onChange={e => setDocNote(n => ({ ...n, [d.id]: e.target.value }))}
                          placeholder="Note (required to reject)" className="px-3 outline-none"
                          style={{ ...inputStyle, flex: '1 1 220px', minWidth: 0, height: 34, fontSize: 13 }} />
                        <button disabled={docReview.isPending} onClick={() => docReview.mutate({ id, documentId: d.id, status: 'verified', notes: docNote[d.id]?.trim() || undefined }, { onError: e => setError(getApiError(e)) })}
                          style={{ height: 34, padding: '0 14px', fontSize: 13, fontWeight: 600, background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 8, cursor: 'pointer' }}>Accept</button>
                        <button disabled={docReview.isPending} onClick={() => docReview.mutate({ id, documentId: d.id, status: 'rejected', notes: docNote[d.id]?.trim() }, { onError: e => setError(getApiError(e)) })}
                          style={{ height: 34, padding: '0 14px', fontSize: 13, fontWeight: 600, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer' }}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {v.missing.length > 0 && (
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#B45309' }}>Missing for this organisation type: {v.missing.join(' ')}</p>
              )}
            </Panel>

            {v.info_request && v.status === 'needs_info' && (
              <Panel title="Waiting on the employer">
                <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>{v.info_request}</p>
              </Panel>
            )}
            {v.status === 'rejected' && (
              <Panel title="Rejected">
                <p style={{ margin: 0, fontSize: 13, color: '#991B1B' }}>{v.reason_code ? `[${v.reason_code}] ` : ''}{v.rejection_reason}</p>
              </Panel>
            )}

            <Panel title="Timeline">
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {v.events.map(e => (
                  <li key={e.id} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.brand.navy, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text.ink }}>
                        {e.from_status ? `${e.from_status.replace(/_/g, ' ')} → ` : ''}{e.to_status.replace(/_/g, ' ')}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 12, color: colors.text.muted }}>{e.actor_name ?? 'System'} · {fmtDate(e.created_at, false)}</p>
                      {e.note && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: colors.text.inkSoft, overflowWrap: 'anywhere' }}>{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
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
