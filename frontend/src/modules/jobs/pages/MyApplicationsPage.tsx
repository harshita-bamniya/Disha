import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, Clock, X, AlertTriangle, ChevronRight, FileText,
  ListChecks, Hourglass, Star, TrendingUp, Download, Gift, PenLine,
} from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import {
  getMyApplications, getApplicationDetail, withdrawApplication,
  getMyInterviews, requestInterviewReschedule,
  getMyOfferLetter, downloadMyOfferLetterPdf, acceptOfferLetter, declineOfferLetter,
  type ApplicationOut, type ApplicationStatusHistoryItem,
} from '@/api/matching'

// ── Status config ─────────────────────────────────────────────────────────────

// Colors mirror the employer-side pipeline (CandidatePipelinePage STATUS_STYLE)
// so a candidate's status reads the same way on both sides of the platform.
const STATUS_CFG: Record<string, { label: string; text: string; accent: string }> = {
  applied:              { label: 'Applied',              text: '#1D4ED8', accent: '#3B82F6' },
  under_review:         { label: 'Under Review',         text: '#92400E', accent: '#F59E0B' },
  screening:            { label: 'Under Review',         text: '#92400E', accent: '#F59E0B' },
  shortlisted:          { label: 'Shortlisted',           text: '#166534', accent: '#22C55E' },
  assessment:           { label: 'Assessment',            text: '#0369A1', accent: '#0EA5E9' },
  hr_interview:         { label: 'HR Interview',          text: '#0369A1', accent: '#0EA5E9' },
  technical_interview:  { label: 'Technical Interview',   text: '#0369A1', accent: '#0EA5E9' },
  manager_interview:    { label: 'Manager Interview',     text: '#0369A1', accent: '#0EA5E9' },
  interview_scheduled:  { label: 'Interview Scheduled',   text: '#1D4ED8', accent: '#3B82F6' },
  interview_completed:  { label: 'Interview Completed',   text: '#0369A1', accent: '#0EA5E9' },
  offer_sent:           { label: 'Offer Sent',            text: '#6D28D9', accent: '#7C3AED' },
  offer_declined:       { label: 'Offer Declined',        text: '#BE123C', accent: '#F43F5E' },
  rejected:             { label: 'Not Selected',          text: '#BE123C', accent: '#F43F5E' },
  hired:                { label: 'Hired',                 text: '#6D28D9', accent: '#7C3AED' },
  withdrawn:            { label: 'Withdrawn',             text: '#64748B', accent: '#94A3B8' },
}

const WITHDRAW_REASONS = [
  'Found a better opportunity',
  'Compensation does not match expectations',
  'No longer interested in this role',
  'Applied by mistake',
  'Other',
]

const CLOSED_STATUSES = new Set(['rejected', 'hired', 'withdrawn'])
// "Advanced" = candidate has been shortlisted or further — withdrawing now is a bigger deal.
const ADVANCED_STATUSES = new Set([
  'shortlisted', 'assessment', 'hr_interview', 'technical_interview', 'manager_interview',
  'interview_scheduled', 'interview_completed', 'offer_sent',
])

// ── Delivery-style progress tracker ────────────────────────────────────────────
// A single horizontal line — Applied → Screening → Shortlisted → Interview → Offer → outcome —
// same pattern as a food-delivery/courier tracker, instead of separate columns.

const TRACK_STEPS = ['Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer']

function trackInfo(status: string): { stepIndex: number; finalLabel: string; finalColor: string; isPending: boolean } {
  const FINAL = TRACK_STEPS.length   // beyond the last real step = "all steps reached"
  if (status === 'hired') return { stepIndex: FINAL, finalLabel: 'Hired', finalColor: '#16A34A', isPending: false }
  if (status === 'rejected') return { stepIndex: FINAL, finalLabel: 'Not Selected', finalColor: '#E11D48', isPending: false }
  if (status === 'withdrawn') return { stepIndex: FINAL, finalLabel: 'Withdrawn', finalColor: '#9CA3AF', isPending: false }
  if (status === 'offer_sent') return { stepIndex: 4, finalLabel: 'Decision', finalColor: '#D1D5DB', isPending: true }
  if (status === 'interview_scheduled' || status === 'interview_completed') return { stepIndex: 3, finalLabel: 'Decision', finalColor: '#D1D5DB', isPending: true }
  if (status === 'shortlisted') return { stepIndex: 2, finalLabel: 'Decision', finalColor: '#D1D5DB', isPending: true }
  if (status === 'under_review' || status === 'screening') return { stepIndex: 1, finalLabel: 'Decision', finalColor: '#D1D5DB', isPending: true }
  return { stepIndex: 0, finalLabel: 'Decision', finalColor: '#D1D5DB', isPending: true } // applied
}

function ProgressTracker({ status }: { status: string }) {
  const { stepIndex, finalLabel, finalColor, isPending } = trackInfo(status)
  const allLabels = [...TRACK_STEPS, finalLabel]
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {allLabels.map((label, i) => {
        const isFinal = i === allLabels.length - 1
        const reached = i <= stepIndex
        const dotColor = isFinal ? (reached ? finalColor : '#E5E7EB') : (reached ? '#2563EB' : '#E5E7EB')
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: isFinal ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: dotColor,
                boxShadow: reached && i === stepIndex && isPending ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
              }} />
              <span style={{
                fontSize: 10.5, fontWeight: reached ? 700 : 500, marginTop: 5, whiteSpace: 'nowrap',
                color: reached ? (isFinal ? finalColor : '#2563EB') : '#9CA3AF',
              }}>
                {label}
              </span>
            </div>
            {!isFinal && (
              <div style={{ flex: 1, height: 2, margin: '0 4px', marginBottom: 15, background: i < stepIndex ? '#2563EB' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
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
function avatarColors(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ── Application card — one per application, with a delivery-style tracker ─────

function ApplicationCard({ app, onOpen }: { app: ApplicationOut; onOpen: () => void }) {
  const [hov, setHov] = useState(false)
  const [bg, fg] = avatarColors(app.company_name)
  const cfg = STATUS_CFG[app.status] ?? STATUS_CFG.applied
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white', borderRadius: 16, overflow: 'hidden',
        border: `1px solid ${hov ? '#DBEAFE' : '#EEF2F9'}`,
        cursor: 'pointer', transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.18s',
        boxShadow: hov ? '0 16px 36px rgba(37,99,235,0.14)' : '0 8px 22px rgba(15,23,42,0.06)',
        transform: hov ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={{ height: 3, background: cfg.accent }} />
      <div style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, color: fg,
          }}>
            {app.company_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.35 }}>
              {app.job_title}
            </p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {app.company_name}
              {app.department_name && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', borderRadius: 20, padding: '1px 7px' }}>
                  {app.department_name}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94A3B8' }}>
                <Clock size={10} /> {daysAgo(app.created_at)}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {app.match_score !== null && (
            <span style={{
              fontSize: 12.5, fontWeight: 700, color: matchColor(app.match_score),
              background: matchColor(app.match_score) + '14', borderRadius: 20, padding: '4px 10px',
            }}>
              {app.match_score}% match
            </span>
          )}
          <ChevronRight size={16} color={hov ? '#2563EB' : '#93C5FD'} style={{ transition: 'color 0.15s' }} />
        </div>
      </div>
      <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
        <ProgressTracker status={app.status} />
      </div>
      </div>
    </div>
  )
}

// ── Status timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ items }: { items: ApplicationStatusHistoryItem[] }) {
  if (!items.length) return (
    <p style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center', padding: '10px 0' }}>No timeline events yet.</p>
  )
  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: '#E2E8F0' }} />
      {items.map((item, i) => {
        const cfg = STATUS_CFG[item.to_status] ?? STATUS_CFG.applied
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
            <div style={{
              position: 'absolute', left: -20, top: 3,
              width: 11, height: 11, borderRadius: '50%',
              background: isLast ? cfg.accent : '#CBD5E1',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: '#A0AEC0' }}>{fmtDate(item.created_at)}</span>
            </div>
            {item.note && (
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', lineHeight: 1.5 }}>{item.note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Withdraw flow (realistic — requires a reason, warns at advanced stages) ────

function WithdrawPanel({ app, onDone, onCancel }: {
  app: ApplicationOut; onDone: () => void; onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const mutation = useMutation({
    mutationFn: () => withdrawApplication(app.id, reason, note || undefined),
    onSuccess: onDone,
  })
  const isAdvanced = ADVANCED_STATUSES.has(app.status)

  return (
    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16 }}>
      {isAdvanced && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
          <AlertTriangle size={14} color="#B45309" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
            You're shortlisted for this role. Withdrawing now will notify the employer immediately and you typically can't reapply to this posting.
          </p>
        </div>
      )}
      <p style={{ fontSize: 12.5, fontWeight: 700, color: '#7C2D12', margin: '0 0 8px' }}>
        Why are you withdrawing?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {WITHDRAW_REASONS.map(r => (
          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
            <input type="radio" name="withdraw-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note for your records (optional)"
        rows={2}
        style={{
          width: '100%', fontSize: 12.5, padding: '8px 10px', borderRadius: 8,
          border: '1px solid #FED7AA', resize: 'vertical', outline: 'none',
          fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={!reason || mutation.isPending}
          onClick={() => mutation.mutate()}
          style={{
            fontSize: 12.5, fontWeight: 700, color: '#fff',
            background: reason ? '#DC2626' : '#FCA5A5', border: 'none', borderRadius: 9,
            padding: '8px 16px', cursor: reason ? 'pointer' : 'not-allowed',
          }}
        >
          {mutation.isPending ? 'Withdrawing…' : 'Confirm Withdrawal'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: 12.5, fontWeight: 600, color: '#64748B', background: '#fff',
            border: '1px solid #E2E8F0', borderRadius: 9, padding: '8px 14px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Interviews section ────────────────────────────────────────────────────────

function InterviewsSection({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient()
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const { data: interviews } = useQuery({
    queryKey: ['my-interviews', applicationId],
    queryFn: () => getMyInterviews(applicationId),
  })

  const requestMutation = useMutation({
    mutationFn: (interviewId: string) => requestInterviewReschedule(applicationId, interviewId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-interviews', applicationId] })
      setRequestingId(null)
      setNote('')
    },
  })

  if (!interviews || interviews.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Clock size={12} /> Interviews
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interviews.map(iv => (
          <div key={iv.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: iv.status === 'scheduled' ? 'rgba(59,130,246,0.1)' : iv.status === 'completed' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
                color: iv.status === 'scheduled' ? '#3B82F6' : iv.status === 'completed' ? '#059669' : '#DC2626',
              }}>
                {iv.status}
              </span>
            </div>
            {iv.meeting_link && (
              <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#3B82F6', display: 'block', marginTop: 4 }}>{iv.meeting_link}</a>
            )}

            {iv.reschedule_requested_at ? (
              <p style={{ fontSize: 11.5, color: '#92400E', background: '#FFFBEB', borderRadius: 8, padding: '6px 8px', marginTop: 6 }}>
                Reschedule requested: "{iv.reschedule_note}" — waiting on the employer.
              </p>
            ) : iv.status === 'scheduled' && (
              requestingId === iv.id ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. I have a clash that day — could we do the following morning instead?"
                    rows={2}
                    maxLength={500}
                    style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12, resize: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setRequestingId(null); setNote('') }} style={{ flex: 1, padding: 6, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={() => requestMutation.mutate(iv.id)}
                      disabled={!note.trim() || requestMutation.isPending}
                      style={{ flex: 1, padding: 6, borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: !note.trim() ? 0.5 : 1 }}
                    >
                      {requestMutation.isPending ? 'Sending…' : 'Send request'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRequestingId(iv.id)}
                  style={{ fontSize: 11.5, fontWeight: 700, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, padding: 0 }}
                >
                  Request a different time
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Offer letter section — self-serve e-signature (typed name + audit trail) ──

function OfferLetterSection({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'idle' | 'accept' | 'decline'>('idle')
  const [signatureName, setSignatureName] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const { data: offer } = useQuery({
    queryKey: ['my-offer-letter', applicationId],
    queryFn: () => getMyOfferLetter(applicationId),
  })

  const acceptMutation = useMutation({
    mutationFn: () => acceptOfferLetter(applicationId, signatureName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-offer-letter', applicationId] })
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      setMode('idle')
    },
  })
  const declineMutation = useMutation({
    mutationFn: () => declineOfferLetter(applicationId, declineReason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-offer-letter', applicationId] })
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      setMode('idle')
    },
  })

  if (!offer) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Gift size={12} /> Offer Letter
      </p>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{offer.role_title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: offer.status === 'accepted' ? 'rgba(5,150,105,0.1)' : offer.status === 'declined' ? 'rgba(220,38,38,0.1)' : 'rgba(124,58,237,0.1)',
            color: offer.status === 'accepted' ? '#059669' : offer.status === 'declined' ? '#DC2626' : '#7C3AED',
          }}>
            {offer.status === 'sent' ? 'Action needed' : offer.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 10px' }}>{offer.salary_ctc} · {offer.work_location} · Starts {offer.start_date}</p>

        <button
          onClick={() => downloadMyOfferLetterPdf(applicationId)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: offer.status === 'sent' ? 12 : 0 }}
        >
          <Download size={12} /> View / Download PDF
        </button>

        {offer.status === 'accepted' && (
          <p style={{ fontSize: 11.5, color: '#059669', margin: '8px 0 0' }}>
            Signed by <strong>{offer.signature_name}</strong>{offer.responded_at ? ` on ${new Date(offer.responded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
          </p>
        )}
        {offer.status === 'declined' && (
          <p style={{ fontSize: 11.5, color: '#DC2626', margin: '8px 0 0' }}>
            You declined this offer{offer.decline_reason ? `: "${offer.decline_reason}"` : '.'}
          </p>
        )}

        {offer.status === 'sent' && mode === 'idle' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('accept')} style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Accept &amp; Sign</button>
            <button onClick={() => setMode('decline')} style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Decline</button>
          </div>
        )}

        {offer.status === 'sent' && mode === 'accept' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11.5, color: '#166534', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <PenLine size={12} /> Type your full legal name to sign
            </p>
            <input
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              style={{ border: '1px solid #BBF7D0', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, outline: 'none' }}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#166534' }}>
              <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ marginTop: 2 }} />
              I have read the offer letter and agree to its terms. This typed name serves as my digital signature.
            </label>
            {acceptMutation.isError && <p style={{ fontSize: 11, color: '#DC2626', margin: 0 }}>Failed to accept. Please try again.</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setMode('idle'); setSignatureName(''); setConfirmChecked(false) }} style={{ flex: 1, padding: 7, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={!signatureName.trim() || !confirmChecked || acceptMutation.isPending}
                style={{ flex: 1, padding: 7, borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: (!signatureName.trim() || !confirmChecked) ? 0.5 : 1 }}
              >
                {acceptMutation.isPending ? 'Signing…' : 'Confirm & Sign'}
              </button>
            </div>
          </div>
        )}

        {offer.status === 'sent' && mode === 'decline' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12 }}>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              maxLength={500}
              style={{ border: '1px solid #FECACA', borderRadius: 8, padding: '7px 10px', fontSize: 12, resize: 'none', fontFamily: 'inherit' }}
            />
            {declineMutation.isError && <p style={{ fontSize: 11, color: '#DC2626', margin: 0 }}>Failed to submit. Please try again.</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setMode('idle'); setDeclineReason('') }} style={{ flex: 1, padding: 7, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending} style={{ flex: 1, padding: 7, borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {declineMutation.isPending ? 'Submitting…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ app, onClose }: { app: ApplicationOut; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [withdrawing, setWithdrawing] = useState(false)
  const cfg = STATUS_CFG[app.status] ?? STATUS_CFG.applied
  const canWithdraw = !CLOSED_STATUSES.has(app.status)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['application-detail', app.id],
    queryFn: () => getApplicationDetail(app.id),
    staleTime: 60 * 1000,
  })

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
        zIndex: 40, animation: 'fadeIn 0.18s ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '92vw',
        background: '#fff', zIndex: 41, boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: cfg.text, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              {cfg.label}
            </span>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '4px 0 2px' }}>{app.job_title}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {app.company_name}
              {app.department_name && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', borderRadius: 20, padding: '1px 8px' }}>
                  {app.department_name}
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={15} color="#64748B" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Match + applied date */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid #F1F5F9' }}>
            {app.match_score !== null && (
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: matchColor(app.match_score), margin: 0 }}>{app.match_score}%</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>Match score</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>{fmtDate(app.created_at)}</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>Applied on</p>
            </div>
          </div>

          {app.employer_note && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Note from employer</p>
              <p style={{ fontSize: 13, color: '#14532D', margin: 0, lineHeight: 1.55 }}>{app.employer_note}</p>
            </div>
          )}

          {app.cover_note && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={12} /> Your Cover Note
              </p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{app.cover_note}</p>
            </div>
          )}

          <OfferLetterSection applicationId={app.id} />

          <InterviewsSection applicationId={app.id} />

          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Timeline
          </p>
          {isLoading
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
                <div style={{ width: 20, height: 20, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            : <StatusTimeline items={detail?.status_history ?? []} />
          }

          {/* Withdraw section */}
          {canWithdraw && (
            <div style={{ marginTop: 22 }}>
              {!withdrawing ? (
                <button
                  type="button"
                  onClick={() => setWithdrawing(true)}
                  style={{
                    fontSize: 12.5, fontWeight: 600, color: '#94A3B8', background: 'transparent',
                    border: '1px dashed #E2E8F0', borderRadius: 10, padding: '9px 14px',
                    cursor: 'pointer', width: '100%', textAlign: 'center',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FCA5A5' }}
                  onMouseOut={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                >
                  Withdraw Application
                </button>
              ) : (
                <WithdrawPanel
                  app={app}
                  onCancel={() => setWithdrawing(false)}
                  onDone={() => { qc.invalidateQueries({ queryKey: ['my-applications'] }); onClose() }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid #F1F5F9' }}>
          <button
            type="button"
            onClick={() => navigate(`/app/jobs/${app.job_id}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 13.5, fontWeight: 700, background: '#2563EB',
              color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', cursor: 'pointer',
            }}
          >
            View Full Job Posting <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyApplicationsPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<ApplicationOut | null>(null)

  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['my-applications'],
    queryFn: getMyApplications,
    staleTime: 60 * 1000,
  })

  const all = applications ?? []
  // "Shortlisted" = reached shortlisted stage or further (including hired) — not just sitting exactly at 'shortlisted'.
  const shortlisted = all.filter(a => ADVANCED_STATUSES.has(a.status) || a.status === 'hired').length
  // "In Progress" = still early-stage and not yet shortlisted, not closed.
  const inProgress  = all.filter(a => !CLOSED_STATUSES.has(a.status) && !ADVANCED_STATUSES.has(a.status)).length
  const respRate    = all.length > 0
    ? Math.round(((all.length - all.filter(a => a.status === 'applied').length) / all.length) * 100)
    : 0

  const sorted = [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  function exportToCSV() {
    const headers = ['Job Title', 'Company', 'Department', 'Status', 'Match Score', 'Applied On', 'Last Updated']
    const rows = sorted.map(a => [
      a.job_title, a.company_name, a.department_name ?? '', STATUS_CFG[a.status]?.label ?? a.status,
      a.match_score ?? '', new Date(a.created_at).toLocaleDateString('en-IN'),
      new Date(a.updated_at).toLocaleDateString('en-IN'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my_applications.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAFBFD' }}>
      <AppSidebar activePath="/app/jobs/applications" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FAFBFD' }}>
        {/* Header */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={14} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A', margin: 0 }}>Application Pipeline</p>
              <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>Track every application from submission to offer</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={exportToCSV}
              disabled={all.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#475569',
                background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10,
                padding: '9px 14px', cursor: all.length === 0 ? 'not-allowed' : 'pointer',
                opacity: all.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={14} />Export CSV
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/jobs')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 700, color: '#2563EB',
                background: 'white', border: '1.5px solid #BFDBFE', borderRadius: 10,
                padding: '9px 16px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.08)', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
            >
              Browse Jobs <ArrowUpRight size={14} />
            </button>
          </div>
        </header>

      <main style={{ flex: 1, minWidth: 0, padding: '28px 36px 48px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Applications', value: all.length, Icon: ListChecks, bg: '#EEF2FF', fg: '#4F46E5' },
            { label: 'In Progress',         value: inProgress, Icon: Hourglass, bg: '#FFF7ED', fg: '#D97706' },
            { label: 'Shortlisted',         value: shortlisted, Icon: Star, bg: '#ECFDF5', fg: '#059669' },
            { label: 'Response Rate',       value: `${respRate}%`, Icon: TrendingUp, bg: '#F0F9FF', fg: '#0284C7' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'white',
              border: '1px solid #EEF2F9', borderRadius: 14, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 6px 18px rgba(15,23,42,0.05)',
              transition: 'box-shadow 0.18s, transform 0.18s',
            }}
              onMouseOver={e => { e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseOut={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.05)'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.Icon size={18} color={s.fg} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {isError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 20px', color: '#991B1B', fontSize: 14 }}>
            Failed to load applications. Please refresh.
          </div>
        )}

        {!isLoading && !isError && all.length === 0 && (
          <div style={{ background: 'white', border: '1px solid #EEF2F9', borderRadius: 16, boxShadow: '0 6px 18px rgba(15,23,42,0.05)', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: '#EEF2FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <FileText size={24} color="#4F46E5" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>No applications yet</h3>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 18px' }}>Once you apply to jobs, they'll show up here as a pipeline.</p>
            <button
              type="button"
              onClick={() => navigate('/app/jobs')}
              style={{ fontSize: 13, fontWeight: 700, color: '#2563EB', background: 'white', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '10px 22px', cursor: 'pointer' }}
            >
              Browse Jobs →
            </button>
          </div>
        )}

        {!isLoading && !isError && all.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {sorted.map(app => (
              <ApplicationCard key={app.id} app={app} onOpen={() => setActive(app)} />
            ))}
          </div>
        )}
      </main>
      </div>

      {active && <DetailDrawer app={active} onClose={() => setActive(null)} />}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}
