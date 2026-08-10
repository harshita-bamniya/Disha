import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, Clock, AlertTriangle, FileText, ChevronDown, ChevronUp,
  ListChecks, Hourglass, Star, TrendingUp, Download, Gift, PenLine, Mic,
} from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import Button from '@/shared/components/primitives/Button'
import EmptyState from '@/shared/components/feedback/EmptyState'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER, colors } from '@/design-system/tokens'
import {
  getMyApplications, getApplicationDetail, withdrawApplication,
  getMyInterviews, requestInterviewReschedule,
  getMyOfferLetter, downloadMyOfferLetterPdf, acceptOfferLetter, declineOfferLetter,
  type ApplicationOut, type ApplicationStatusHistoryItem,
} from '@/api/matching'

const INK_S    = INK_SFT
const CREAM_DK = colors.surface.elevated
const WHITE    = '#fff'

// ── status config ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; text: string; accent: string }> = {
  applied:             { label: 'Applied',             text: '#1D4ED8', accent: '#3B82F6' },
  under_review:        { label: 'Under Review',        text: '#92400E', accent: '#F59E0B' },
  screening:           { label: 'Under Review',        text: '#92400E', accent: '#F59E0B' },
  shortlisted:         { label: 'Shortlisted',         text: '#166534', accent: '#22C55E' },
  assessment:          { label: 'Assessment',          text: '#0369A1', accent: '#0EA5E9' },
  hr_interview:        { label: 'HR Interview',        text: '#0369A1', accent: '#0EA5E9' },
  technical_interview: { label: 'Technical Interview', text: '#0369A1', accent: '#0EA5E9' },
  manager_interview:   { label: 'Manager Interview',   text: '#0369A1', accent: '#0EA5E9' },
  interview_scheduled: { label: 'Interview Scheduled', text: '#1D4ED8', accent: '#3B82F6' },
  interview_completed: { label: 'Interview Completed', text: '#0369A1', accent: '#0EA5E9' },
  offer_sent:          { label: 'Offer Sent',          text: '#6D28D9', accent: '#7C3AED' },
  offer_declined:      { label: 'Offer Declined',      text: '#BE123C', accent: '#F43F5E' },
  rejected:            { label: 'Not Selected',        text: '#BE123C', accent: '#F43F5E' },
  hired:               { label: 'Hired',               text: '#166534', accent: '#22C55E' },
  withdrawn:           { label: 'Withdrawn',           text: '#64748B', accent: '#94A3B8' },
}

const WITHDRAW_REASONS = [
  'Found a better opportunity',
  'Compensation does not match expectations',
  'No longer interested in this role',
  'Applied by mistake',
  'Other',
]

const CLOSED_STATUSES   = new Set(['rejected', 'hired', 'withdrawn'])
const ADVANCED_STATUSES = new Set([
  'shortlisted', 'assessment', 'hr_interview', 'technical_interview', 'manager_interview',
  'interview_scheduled', 'interview_completed', 'offer_sent',
])

// ── progress tracker ───────────────────────────────────────────────────────────
const TRACK_STEPS = ['Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer']

function trackInfo(status: string): { stepIndex: number; finalLabel: string; finalColor: string; isPending: boolean } {
  const FINAL = TRACK_STEPS.length
  if (status === 'hired')     return { stepIndex: FINAL, finalLabel: 'Hired',        finalColor: '#16A34A', isPending: false }
  if (status === 'rejected')  return { stepIndex: FINAL, finalLabel: 'Not Selected', finalColor: '#E11D48', isPending: false }
  if (status === 'withdrawn') return { stepIndex: FINAL, finalLabel: 'Withdrawn',    finalColor: '#9CA3AF', isPending: false }
  if (status === 'offer_sent') return { stepIndex: 4, finalLabel: 'Decision', finalColor: CREAM_DK, isPending: true }
  if (['interview_scheduled', 'interview_completed'].includes(status)) return { stepIndex: 3, finalLabel: 'Decision', finalColor: CREAM_DK, isPending: true }
  if (status === 'shortlisted') return { stepIndex: 2, finalLabel: 'Decision', finalColor: CREAM_DK, isPending: true }
  if (['under_review', 'screening'].includes(status)) return { stepIndex: 1, finalLabel: 'Decision', finalColor: CREAM_DK, isPending: true }
  return { stepIndex: 0, finalLabel: 'Decision', finalColor: CREAM_DK, isPending: true }
}

function milestones(status: string): string[] {
  const { stepIndex } = trackInfo(status)
  return ['Applied', 'Screened', 'Shortlisted', 'Interview', 'Offer'].slice(0, Math.max(1, stepIndex))
}

function ProgressTracker({ status }: { status: string }) {
  const { stepIndex, finalLabel, finalColor, isPending } = trackInfo(status)
  const allLabels = [...TRACK_STEPS, finalLabel]
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {allLabels.map((label, i) => {
        const isFinal = i === allLabels.length - 1
        const reached = i <= stepIndex
        const isActive = reached && i === stepIndex && isPending
        const dotColor = isFinal ? (reached && !isPending ? finalColor : CREAM_DK) : (reached ? NAVY : CREAM_DK)
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: isFinal ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, boxShadow: isActive ? `0 0 0 3px ${NAVY}28` : 'none' }} />
              <span style={{ fontSize: 9.5, fontWeight: reached ? 700 : 500, marginTop: 5, whiteSpace: 'nowrap', color: reached ? (isFinal && !isPending ? finalColor : NAVY) : MUTED }}>
                {label}
              </span>
            </div>
            {!isFinal && (
              <div style={{ flex: 1, height: 2, margin: '0 4px', marginBottom: 14, background: i < stepIndex ? NAVY : CREAM_DK }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────
function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}
function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function matchColor(s: number) {
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#D97706'
  return '#E11D48'
}

const AVATAR_PALETTE = [
  ['#EEF2FF', '#4F46E5'], ['#ECFDF5', '#059669'], ['#FFF7ED', '#EA580C'],
  ['#FDF2F8', '#DB2777'], ['#F0F9FF', '#0284C7'], ['#FAF5FF', '#9333EA'],
]
function avatarColors(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] as [string, string]
}

// ── StatusTimeline ─────────────────────────────────────────────────────────────
function StatusTimeline({ items }: { items: ApplicationStatusHistoryItem[] }) {
  if (!items.length) return (
    <p style={{ fontSize: 12, color: MUTED, padding: '6px 0' }}>No timeline events yet.</p>
  )
  return (
    <div style={{ position: 'relative', paddingLeft: 18 }}>
      <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, background: CREAM_DK }} />
      {items.map((item, i) => {
        const cfg = STATUS_CFG[item.to_status] ?? STATUS_CFG.applied
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ position: 'relative', paddingBottom: isLast ? 0 : 14 }}>
            <div style={{ position: 'absolute', left: -18, top: 3, width: 9, height: 9, borderRadius: '50%', background: isLast ? NAVY : CREAM_DK }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{fmtDate(item.created_at)}</span>
            </div>
            {item.note && <p style={{ fontSize: 11.5, color: INK_S, margin: '3px 0 0', lineHeight: 1.5 }}>{item.note}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ── WithdrawPanel ──────────────────────────────────────────────────────────────
function WithdrawPanel({ app, onDone, onCancel }: { app: ApplicationOut; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const [note, setNote]     = useState('')
  const mutation = useMutation({ mutationFn: () => withdrawApplication(app.id, reason, note || undefined), onSuccess: onDone })
  const isAdvanced = ADVANCED_STATUSES.has(app.status)
  return (
    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: 14, marginTop: 10 }}>
      {isAdvanced && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10, padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
          <AlertTriangle size={13} color="#B45309" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11.5, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
            You're shortlisted for this role. Withdrawing now will notify the employer and you typically can't reapply.
          </p>
        </div>
      )}
      <p style={{ fontSize: 12, fontWeight: 700, color: '#7C2D12', margin: '0 0 8px' }}>Why are you withdrawing?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        {WITHDRAW_REASONS.map(r => (
          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: INK, cursor: 'pointer' }}>
            <input type="radio" name={`withdraw-${app.id}`} value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)" rows={2}
        style={{ width: '100%', fontSize: 12, padding: '7px 9px', borderRadius: 7, border: '1px solid #FED7AA', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 7 }}>
        <Button variant="danger" size="sm" disabled={!reason} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Withdrawing…' : 'Confirm Withdrawal'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ── InterviewsSection ──────────────────────────────────────────────────────────
function InterviewsSection({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient()
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const { data: interviews } = useQuery({ queryKey: ['my-interviews', applicationId], queryFn: () => getMyInterviews(applicationId) })
  const requestMutation = useMutation({
    mutationFn: (ivId: string) => requestInterviewReschedule(applicationId, ivId, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-interviews', applicationId] }); setRequestingId(null); setNote('') },
  })
  if (!interviews || interviews.length === 0) return null
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Mic size={11} /> Interviews
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {interviews.map(iv => (
          <div key={iv.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>
                {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: iv.status === 'scheduled' ? 'rgba(59,130,246,0.1)' : iv.status === 'completed' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: iv.status === 'scheduled' ? '#3B82F6' : iv.status === 'completed' ? '#059669' : '#DC2626' }}>
                {iv.status}
              </span>
            </div>
            {iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3B82F6', display: 'block', marginTop: 3 }}>{iv.meeting_link}</a>}
            {iv.reschedule_requested_at
              ? <p style={{ fontSize: 11, color: '#92400E', background: '#FFFBEB', borderRadius: 7, padding: '5px 7px', marginTop: 5 }}>Reschedule requested — waiting on employer.</p>
              : iv.status === 'scheduled' && (
                requestingId === iv.id
                  ? <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for reschedule…" rows={2} maxLength={500} style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 7px', fontSize: 11.5, resize: 'none', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 5 }}>
                        <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => { setRequestingId(null); setNote('') }}>Cancel</Button>
                        <Button size="sm" style={{ flex: 1 }} disabled={!note.trim()} loading={requestMutation.isPending} onClick={() => requestMutation.mutate(iv.id)}>
                          {requestMutation.isPending ? 'Sending…' : 'Send request'}
                        </Button>
                      </div>
                    </div>
                  : <Button variant="ghost" size="sm" style={{ padding: 0, height: 'auto', marginTop: 5 }} onClick={() => setRequestingId(iv.id)}>Request a different time</Button>
              )
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OfferLetterSection ─────────────────────────────────────────────────────────
function OfferLetterSection({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'idle' | 'accept' | 'decline'>('idle')
  const [signatureName, setSignatureName] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const { data: offer } = useQuery({ queryKey: ['my-offer-letter', applicationId], queryFn: () => getMyOfferLetter(applicationId) })
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['my-offer-letter', applicationId] }); qc.invalidateQueries({ queryKey: ['my-applications'] }) }
  const acceptMutation  = useMutation({ mutationFn: () => acceptOfferLetter(applicationId, signatureName.trim()), onSuccess: () => { invalidate(); setMode('idle') } })
  const declineMutation = useMutation({ mutationFn: () => declineOfferLetter(applicationId, declineReason.trim() || undefined), onSuccess: () => { invalidate(); setMode('idle') } })
  if (!offer) return null
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Gift size={11} /> Offer Letter
      </p>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{offer.role_title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: offer.status === 'accepted' ? 'rgba(5,150,105,0.1)' : offer.status === 'declined' ? 'rgba(220,38,38,0.1)' : 'rgba(124,58,237,0.1)', color: offer.status === 'accepted' ? '#059669' : offer.status === 'declined' ? '#DC2626' : '#7C3AED' }}>
            {offer.status === 'sent' ? 'Action needed' : offer.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: INK_S, margin: '0 0 8px' }}>{offer.salary_ctc} · {offer.work_location} · Starts {offer.start_date}</p>
        <Button variant="ghost" size="sm" style={{ padding: 0, height: 'auto', marginBottom: offer.status === 'sent' ? 10 : 0 }} onClick={() => downloadMyOfferLetterPdf(applicationId)}>
          <Download size={11} /> View / Download PDF
        </Button>
        {offer.status === 'accepted' && <p style={{ fontSize: 11, color: '#059669', margin: '6px 0 0' }}>Signed by <strong>{offer.signature_name}</strong>{offer.responded_at ? ` on ${fmtDate(offer.responded_at)}` : ''}.</p>}
        {offer.status === 'declined' && <p style={{ fontSize: 11, color: '#DC2626', margin: '6px 0 0' }}>You declined this offer{offer.decline_reason ? `: "${offer.decline_reason}"` : '.'}.</p>}
        {offer.status === 'sent' && mode === 'idle' && (
          <div style={{ display: 'flex', gap: 7 }}>
            <button
              onClick={() => setMode('accept')}
              style={{ flex: 1, height: 32, borderRadius: 7, border: 'none', background: '#059669', color: WHITE, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
            >Accept &amp; Sign</button>
            <button
              onClick={() => setMode('decline')}
              style={{ flex: 1, height: 32, borderRadius: 7, border: '1px solid #FCA5A5', background: WHITE, color: '#DC2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
            >Decline</button>
          </div>
        )}
        {offer.status === 'sent' && mode === 'accept' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, padding: 10 }}>
            <p style={{ fontSize: 11, color: '#166534', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}><PenLine size={11} /> Type your full legal name to sign</p>
            <input value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="e.g. Priya Sharma" style={{ border: '1px solid #BBF7D0', borderRadius: 7, padding: '6px 9px', fontSize: 12, outline: 'none' }} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10.5, color: '#166534' }}>
              <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ marginTop: 2 }} />
              I have read and agree to the terms. This typed name is my digital signature.
            </label>
            <div style={{ display: 'flex', gap: 5 }}>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => { setMode('idle'); setSignatureName(''); setConfirmChecked(false) }}>Cancel</Button>
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={!signatureName.trim() || !confirmChecked || acceptMutation.isPending}
                style={{ flex: 1, padding: 6, borderRadius: 7, border: 'none', background: '#059669', color: WHITE, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: (!signatureName.trim() || !confirmChecked) ? 0.5 : 1 }}
              >{acceptMutation.isPending ? 'Signing…' : 'Confirm & Sign'}</button>
            </div>
          </div>
        )}
        {offer.status === 'sent' && mode === 'decline' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: 10 }}>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Reason (optional)" rows={2} maxLength={500} style={{ border: '1px solid #FECACA', borderRadius: 7, padding: '6px 9px', fontSize: 11.5, resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 5 }}>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => { setMode('idle'); setDeclineReason('') }}>Cancel</Button>
              <Button variant="danger" size="sm" style={{ flex: 1 }} loading={declineMutation.isPending} onClick={() => declineMutation.mutate()}>
                {declineMutation.isPending ? 'Submitting…' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TimelineCard ───────────────────────────────────────────────────────────────
function TimelineCard({ app, isLast }: { app: ApplicationOut; isLast: boolean }) {
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [open, setOpen]           = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [bg, fg]    = avatarColors(app.company_name)
  const cfg         = STATUS_CFG[app.status] ?? STATUS_CFG.applied
  const chips       = milestones(app.status)
  const isClosed    = CLOSED_STATUSES.has(app.status)
  const canWithdraw = !isClosed
  const dotColor    = isClosed
    ? (app.status === 'hired' ? '#16A34A' : app.status === 'rejected' ? '#E11D48' : '#9CA3AF')
    : NAVY

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['application-detail', app.id],
    queryFn: () => getApplicationDetail(app.id),
    enabled: open,
    staleTime: 60 * 1000,
  })

  return (
    <div style={{ display: 'flex', gap: 0, position: 'relative', marginBottom: isLast ? 0 : 4 }}>
      {/* spine */}
      <div style={{ width: 32, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: dotColor, border: `2px solid ${CREAM}`, boxShadow: `0 0 0 2px ${dotColor}`, marginTop: 16, flexShrink: 0, zIndex: 1 }} />
        {!isLast && <div style={{ flex: 1, width: 2, background: CREAM_DK, marginTop: 4, minHeight: 20 }} />}
      </div>

      {/* card */}
      <div style={{ flex: 1, maxWidth: 560, marginLeft: 10, marginBottom: 16 }}>
        {/* collapsed header — always visible, click to toggle */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            background: WHITE,
            border: `1px solid ${open ? 'rgba(26,39,68,0.18)' : BORDER}`,
            borderRadius: open ? '13px 13px 0 0' : 13,
            padding: '13px 14px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: fg, flexShrink: 0 }}>
                {app.company_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.job_title}</p>
                <p style={{ fontSize: 11, color: MUTED, margin: 0, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  {app.company_name}
                  {app.department_name && <span style={{ fontSize: 10, fontWeight: 600, color: NAVY, background: CREAM_DK, borderRadius: 20, padding: '1px 6px' }}>{app.department_name}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />{daysAgo(app.created_at)}</span>
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.accent + '1A', color: cfg.text }}>
                {cfg.label}
              </span>
              {open ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
            </div>
          </div>

          {/* milestone chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {chips.map(c => (
                <span key={c} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: CREAM, border: `1px solid ${CREAM_DK}`, color: INK_S, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: '#16A34A', fontSize: 9 }}>✓</span> {c}
                </span>
              ))}
            </div>
          )}

          {/* match bar */}
          {app.match_score !== null && (
            <div>
              <div style={{ height: 4, borderRadius: 2, background: CREAM_DK, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${app.match_score}%`, background: matchColor(app.match_score), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: MUTED }}>Skill match</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: matchColor(app.match_score) }}>{app.match_score}%</span>
              </div>
            </div>
          )}
        </div>

        {/* expanded panel — inline below the header */}
        {open && (
          <div style={{ background: CREAM, border: `1px solid rgba(26,39,68,0.18)`, borderTop: 'none', borderRadius: '0 0 13px 13px', padding: '16px 16px 14px' }}>

            {/* progress tracker */}
            <div style={{ background: WHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Progress</p>
              <ProgressTracker status={app.status} />
            </div>

            {/* employer note */}
            {app.employer_note && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#166534', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Note from employer</p>
                <p style={{ fontSize: 12.5, color: '#14532D', margin: 0, lineHeight: 1.55 }}>{app.employer_note}</p>
              </div>
            )}

            {/* cover note */}
            {app.cover_note && (
              <div style={{ background: WHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={10} /> Cover Note
                </p>
                <p style={{ fontSize: 12.5, color: INK_S, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{app.cover_note}</p>
              </div>
            )}

            {/* offer + interviews */}
            <div style={{ background: WHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <OfferLetterSection applicationId={app.id} />
              <InterviewsSection applicationId={app.id} />
            </div>

            {/* status timeline */}
            <div style={{ background: WHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Timeline</p>
              {detailLoading
                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                : <StatusTimeline items={detail?.status_history ?? []} />
              }
            </div>

            {/* action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button size="sm" style={{ flex: 1 }} onClick={() => navigate(`/app/jobs/${app.job_id}`)}>
                View Full Job Posting <ArrowUpRight size={13} />
              </Button>
              {canWithdraw && !withdrawing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => { e.stopPropagation(); setWithdrawing(true) }}
                  className="text-gray-400 border border-gray-200 hover:text-red-600 hover:border-red-200"
                >
                  Withdraw
                </Button>
              )}
            </div>

            {withdrawing && (
              <WithdrawPanel app={app} onCancel={() => setWithdrawing(false)}
                onDone={() => { qc.invalidateQueries({ queryKey: ['my-applications'] }); setWithdrawing(false); setOpen(false) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MyApplicationsPage ─────────────────────────────────────────────────────────
type FilterKey = 'all' | 'active' | 'shortlisted' | 'closed'
type SortKey   = 'recent' | 'match'

const FILTER_BTNS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'active',      label: 'Active' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'closed',      label: 'Closed' },
]

export default function MyApplicationsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort]     = useState<SortKey>('recent')

  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['my-applications'],
    queryFn: getMyApplications,
    staleTime: 60 * 1000,
  })

  const all         = applications ?? []
  const shortlisted = all.filter(a => ADVANCED_STATUSES.has(a.status) || a.status === 'hired').length
  const inProgress  = all.filter(a => !CLOSED_STATUSES.has(a.status) && !ADVANCED_STATUSES.has(a.status)).length
  const respRate    = all.length > 0
    ? Math.round(((all.length - all.filter(a => a.status === 'applied').length) / all.length) * 100)
    : 0

  const filtered = useMemo(() => {
    let list = [...all]
    if (filter === 'active')      list = list.filter(a => !CLOSED_STATUSES.has(a.status))
    if (filter === 'shortlisted') list = list.filter(a => ADVANCED_STATUSES.has(a.status))
    if (filter === 'closed')      list = list.filter(a => CLOSED_STATUSES.has(a.status))
    if (sort === 'recent') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === 'match')  list.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    return list
  }, [all, filter, sort])

  const grouped = useMemo(() => {
    const map = new Map<string, ApplicationOut[]>()
    for (const app of filtered) {
      const key = monthLabel(app.created_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(app)
    }
    return Array.from(map.entries())
  }, [filtered])

  function exportToCSV() {
    const headers = ['Job Title', 'Company', 'Department', 'Status', 'Match Score', 'Applied On', 'Last Updated']
    const rows = all.map(a => [
      a.job_title, a.company_name, a.department_name ?? '', STATUS_CFG[a.status]?.label ?? a.status,
      a.match_score ?? '', new Date(a.created_at).toLocaleDateString('en-IN'),
      new Date(a.updated_at).toLocaleDateString('en-IN'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'my_applications.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const STATS = [
    { label: 'Total Applications', value: all.length,    Icon: ListChecks },
    { label: 'In Progress',        value: inProgress,    Icon: Hourglass  },
    { label: 'Shortlisted',        value: shortlisted,   Icon: Star       },
    { label: 'Response Rate',      value: `${respRate}%`,Icon: TrendingUp },
  ]

  return (
    <>
      <PageHeader
        title="Application Pipeline"
        subtitle="Track every application from submission to offer"
        icon={<FileText size={13} color={NAVY} />}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={all.length === 0} onClick={exportToCSV}>
              <Download size={13} /> Export CSV
            </Button>
            <Button size="sm" onClick={() => navigate('/app/jobs')}>
              Browse Jobs <ArrowUpRight size={13} />
            </Button>
          </>
        }
      />

        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* navy stats banner */}
          <div style={{ background: NAVY, padding: '20px 28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: -80, right: -60, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: -50, left: 80, pointerEvents: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, position: 'relative' }}>
              {STATS.map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '13px 15px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <s.Icon size={13} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: WHITE, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* body */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>

            {/* left filter sidebar */}
            <div style={{ width: 160, flexShrink: 0, padding: '20px 16px', position: 'sticky', top: 58 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px' }}>Filter</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
                {FILTER_BTNS.map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    style={{ fontSize: 12.5, fontWeight: filter === f.key ? 700 : 500, color: filter === f.key ? WHITE : INK_S, background: filter === f.key ? NAVY : 'transparent', border: 'none', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px' }}>Sort by</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['recent', 'match'] as SortKey[]).map(s => (
                  <button key={s} onClick={() => setSort(s)}
                    style={{ fontSize: 12.5, fontWeight: sort === s ? 700 : 500, color: sort === s ? WHITE : INK_S, background: sort === s ? NAVY : 'transparent', border: 'none', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                    {s === 'recent' ? 'Most Recent' : 'Match %'}
                  </button>
                ))}
              </div>
            </div>

            {/* timeline feed */}
            <div style={{ flex: 1, minWidth: 0, padding: '20px 24px 48px 8px' }}>

              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}

              {isError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 18px', color: '#991B1B', fontSize: 13, maxWidth: 560 }}>
                  Failed to load applications. Please refresh.
                </div>
              )}

              {!isLoading && !isError && filtered.length === 0 && (
                <EmptyState
                  icon={<FileText size={20} />}
                  title={filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
                  description={filter === 'all' ? "Once you apply to jobs, they'll appear here." : 'Try a different filter.'}
                  action={filter === 'all'
                    ? <Button size="sm" onClick={() => navigate('/app/jobs')}>Browse Jobs →</Button>
                    : undefined
                  }
                />
              )}

              {!isLoading && !isError && grouped.map(([month, apps]) => (
                <div key={month} style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 12px', paddingLeft: 42 }}>
                    {month}
                  </p>
                  {apps.map((app, i) => (
                    <TimelineCard key={app.id} app={app} isLast={i === apps.length - 1} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

    </>
  )
}
