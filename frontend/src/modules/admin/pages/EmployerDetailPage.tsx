import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Building2, Briefcase, Users, CheckCircle2, XCircle,
  Globe, CreditCard, Download, FileText, Clock, CheckCheck, X, AlertCircle,
  Activity, MessageSquare,
} from 'lucide-react'
import {
  useAdminEmployerDetail, useRevokeEmployer,
  useEmployerVerifications, useEmployerVerificationDetail, useReviewEmployerVerification,
  useEmployerJobs,
  useCandidateApplications,
  useEmployerSupportTickets,
} from '../hooks/useAdmin'
import {
  Spinner, Empty, Badge, SectionHeading, DetailRow, ExportButton,
  VERIF_STATUS_COLOR, Breadcrumb, TabBar, type TabDef, STATUS_COLOR_MAP,
} from '../shared/adminUI'
import { cn } from '@/lib/utils'
import { adminApi } from '@/api/admin'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

const cardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }
const tableCardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' as const }
const tableHeaderStyle = { background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px' }
const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }

function days(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

const TABS: TabDef[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'documents',    label: 'Documents' },
  { key: 'jobs',         label: 'Jobs' },
  { key: 'departments',  label: 'Departments' },
  { key: 'team',         label: 'Team' },
  { key: 'applicants',   label: 'Applicants' },
  { key: 'activity',     label: 'Activity' },
  { key: 'support',      label: 'Support' },
]

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ emp }: { emp: any }) {
  const [showRevoke, setShowRevoke] = useState(false)
  const revoke = useRevokeEmployer()
  const navigate = useNavigate()
  const slaDays = emp.kyc_submitted_at ? days(emp.kyc_submitted_at) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company info */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SectionHeading>Company Information</SectionHeading>
          <DetailRow label="Industry"       value={emp.industry} />
          <DetailRow label="Size"           value={emp.company_size} />
          <DetailRow label="City"           value={emp.city} />
          <DetailRow label="GST Number"     value={emp.gst_number} />
          {emp.website && (
            <DetailRow label="Website" value={
              <a href={emp.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:underline" style={{ color: N.navy }}>
                <Globe className="w-3 h-3" />{emp.website}
              </a>
            } />
          )}
          <SectionHeading>Contact</SectionHeading>
          <DetailRow label="Contact Person" value={emp.contact_person} />
          <DetailRow label="Designation"    value={emp.designation} />
          <DetailRow label="Phone"          value={emp.phone} />
          <DetailRow label="Registered"     value={new Date(emp.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
          {emp.description && (
            <div className="mt-2 px-3 py-3" style={{ background: N.cream, borderRadius: 10 }}>
              <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>{emp.description}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* KYC status */}
          <div style={cardStyle}>
            <SectionHeading>KYC Status</SectionHeading>
            {emp.kyc_status ? (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <Badge color={VERIF_STATUS_COLOR[emp.kyc_status] ?? 'gray'}>
                    {emp.kyc_status.replace(/_/g, ' ')}
                  </Badge>
                  {slaDays !== null && emp.kyc_status === 'pending' && (
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      slaDays > 3 ? 'bg-red-100 text-red-700' : slaDays > 1 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
                    )}>
                      {slaDays}d in queue
                    </span>
                  )}
                </div>
                {emp.kyc_submitted_at && (
                  <p className="text-xs" style={{ color: N.muted }}>
                    Submitted {new Date(emp.kyc_submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs mt-2" style={{ color: N.muted }}>No KYC submission on file.</p>
            )}
          </div>

          {/* Subscription */}
          <div style={cardStyle}>
            <SectionHeading>Subscription</SectionHeading>
            <p className="text-sm font-bold mt-2" style={{ color: N.ink }}>{emp.subscription_plan ?? 'Free'}</p>
          </div>

          {/* Actions */}
          <div style={cardStyle}>
            <SectionHeading>Actions</SectionHeading>
            <div className="flex flex-col gap-2 mt-2">
              {emp.is_approved && (
                <button
                  onClick={() => setShowRevoke(true)}
                  className="h-9 px-4 text-xs font-semibold text-left transition-colors"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10 }}
                >
                  Revoke Approval
                </button>
              )}
              <ExportButton
                rows={[{
                  company_name: emp.company_name, contact_person: emp.contact_person ?? '',
                  phone: emp.phone, city: emp.city ?? '', industry: emp.industry ?? '',
                  is_approved: emp.is_approved, job_count: emp.job_count,
                  registered_at: emp.registered_at,
                }]}
                filename={`employer_${emp.company_name.replace(/\s+/g, '_')}.csv`}
              />
            </div>
          </div>
        </div>
      </div>

      {showRevoke && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 24, maxWidth: 384, width: '100%' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: N.ink }}>Revoke approval?</h3>
            <p className="text-sm mb-5" style={{ color: N.muted }}>
              <span className="font-semibold" style={{ color: N.ink }}>{emp.company_name}</span> will lose access and their jobs will be unlisted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowRevoke(false)} className="flex-1 h-10 text-sm font-medium" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }}>
                Cancel
              </button>
              <button
                onClick={() => revoke.mutate(emp.id, { onSuccess: () => { setShowRevoke(false); navigate('/admin/employers') } })}
                disabled={revoke.isPending}
                className="flex-1 h-10 text-sm font-semibold disabled:opacity-40"
                style={{ background: '#EF4444', color: '#fff', borderRadius: 10, border: 'none' }}
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Documents (KYC) ───────────────────────────────────────────────────────

function DocumentsTab({ emp }: { emp: any }) {
  const { data: verifications, isLoading } = useEmployerVerifications()
  const verification = verifications?.find(v => v.employer_id === emp.id)
  const { data: detail } = useEmployerVerificationDetail(verification?.id ?? null)
  const review = useReviewEmployerVerification()
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  if (isLoading) return <Spinner />

  if (!verification) {
    return <Empty icon={FileText} text="No KYC documents submitted yet" />
  }

  const statusBannerStyle = {
    approved: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' },
    rejected: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' },
    under_review: { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' },
    pending: { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' },
  }
  const bannerStyle = (statusBannerStyle as any)[verification.status] ?? statusBannerStyle.pending

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner */}
      <div className="flex items-center gap-3 px-4 py-3 text-sm font-semibold" style={{ ...bannerStyle, borderRadius: 10 }}>
        <Badge color={VERIF_STATUS_COLOR[verification.status] ?? 'gray'}>
          {verification.status.replace(/_/g, ' ')}
        </Badge>
        <span>{verification.document_count} document{verification.document_count !== 1 ? 's' : ''} submitted</span>
        {verification.submitted_at && (
          <span className="ml-auto text-xs opacity-70">
            Submitted {new Date(verification.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents */}
        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <h3 className="text-sm font-bold" style={{ color: N.ink }}>Documents</h3>
          </div>
          {!detail?.documents.length ? (
            <Empty icon={FileText} text="No documents" />
          ) : (
            detail.documents.map((doc, idx) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3 gap-3"
                style={{ borderBottom: idx < detail.documents.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined, background: idx % 2 === 0 ? '#fff' : N.cream }}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold capitalize" style={{ color: N.ink }}>{doc.doc_type.replace(/_/g, ' ')}</p>
                  {doc.original_filename && <p className="text-[11px] truncate" style={{ color: N.muted }}>{doc.original_filename}</p>}
                  <Badge color={doc.status === 'approved' ? 'green' : doc.status === 'rejected' ? 'red' : 'gray'}>
                    {doc.status}
                  </Badge>
                </div>
                <button
                  onClick={() => adminApi.downloadVerificationDocument(verification.id, doc.id, doc.original_filename ?? doc.doc_type)}
                  className="flex items-center gap-1 h-7 px-2.5 text-xs font-semibold shrink-0"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', color: N.ink }}
                >
                  <Download size={11} /> Download
                </button>
              </div>
            ))
          )}
        </div>

        {/* Review panel */}
        <div className="flex flex-col gap-4">
          <div style={cardStyle}>
            <SectionHeading>Reviewer Notes</SectionHeading>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes (visible to other reviewers)…"
              className="w-full px-3 py-2 text-xs outline-none resize-none mt-2"
              style={inputStyle}
            />
            <div className="flex flex-col gap-2 mt-3">
              {verification.status !== 'approved' && (
                <button
                  onClick={() => review.mutate({ id: verification.id, action: 'approve', notes: notes.trim() || undefined })}
                  disabled={review.isPending}
                  className="flex items-center gap-2 h-9 px-4 text-xs font-semibold disabled:opacity-40"
                  style={{ background: '#22C55E', color: '#fff', borderRadius: 10, border: 'none' }}
                >
                  <CheckCheck size={13} /> Approve
                </button>
              )}
              {verification.status === 'pending' && (
                <button
                  onClick={() => review.mutate({ id: verification.id, action: 'under_review', notes: notes.trim() || undefined })}
                  disabled={review.isPending}
                  className="flex items-center gap-2 h-9 px-4 text-xs font-semibold disabled:opacity-40"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', borderRadius: 10 }}
                >
                  <Clock size={13} /> Mark Under Review
                </button>
              )}
              {verification.status !== 'rejected' && (
                <button
                  onClick={() => setShowReject(true)}
                  className="flex items-center gap-2 h-9 px-4 text-xs font-semibold"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10 }}
                >
                  <X size={13} /> Reject
                </button>
              )}
            </div>
            {showReject && (
              <div className="mt-3 flex flex-col gap-2 p-3" style={{ background: '#FEF2F2', borderRadius: 10 }}>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Rejection reason (shown to employer)…"
                  className="w-full px-3 py-2 text-xs outline-none resize-none"
                  style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#fff', color: N.ink }}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setShowReject(false); setRejectReason('') }}
                    className="flex-1 h-8 text-xs font-medium"
                    style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', color: N.ink }}>Cancel</button>
                  <button
                    onClick={() => {
                      review.mutate({ id: verification.id, action: 'reject', notes: notes.trim() || undefined, rejection_reason: rejectReason.trim() || undefined })
                      setShowReject(false); setRejectReason('')
                    }}
                    disabled={review.isPending}
                    className="flex-1 h-8 text-xs font-semibold disabled:opacity-40"
                    style={{ background: '#EF4444', color: '#fff', borderRadius: 8, border: 'none' }}
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          {detail?.events && detail.events.length > 0 && (
            <div style={cardStyle}>
              <SectionHeading>Timeline</SectionHeading>
              <div className="flex flex-col gap-3 mt-2">
                {detail.events.map(ev => (
                  <div key={ev.id} className="flex gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: N.navy }} />
                    <div className="min-w-0">
                      <p className="font-semibold capitalize" style={{ color: N.ink }}>
                        {ev.from_status ? `${ev.from_status.replace(/_/g, ' ')} → ` : ''}{ev.to_status.replace(/_/g, ' ')}
                      </p>
                      {ev.note && <p className="truncate" style={{ color: '#475569' }}>{ev.note}</p>}
                      <p style={{ color: N.muted }}>{ev.actor_name ?? 'System'} · {new Date(ev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Jobs ──────────────────────────────────────────────────────────────────

function JobsTab({ emp }: { emp: any }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useEmployerJobs(emp.id, { search: search || undefined })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs…"
          className="h-9 px-3 text-xs outline-none w-64"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.border = `1px solid ${N.navy}`)}
          onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)')}
        />
        <span className="text-xs" style={{ color: N.muted }}>{data?.total ?? 0} total</span>
      </div>
      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.items.length ? (
          <Empty icon={Briefcase} text="No jobs posted yet" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Job', 'Apps', 'Status', 'Posted'].map((h, i) => (
                <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {data.items.map((j, idx) => (
              <button
                key={j.id}
                onClick={() => navigate(`/admin/jobs/${j.id}`)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
                style={{
                  background: idx % 2 === 0 ? '#fff' : N.cream,
                  borderBottom: idx < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                }}
                onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{j.title}</p>
                  <p className="text-xs" style={{ color: N.muted }}>{j.sector}{j.location ? ` · ${j.location}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-right" style={{ color: N.ink }}>{j.applicant_count}</span>
                <span className="text-right">
                  {j.is_active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}
                </span>
                <span className="text-xs text-right whitespace-nowrap" style={{ color: N.muted }}>
                  {new Date(j.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab: Team ──────────────────────────────────────────────────────────────────

function TeamTab({ emp }: { emp: any }) {
  return (
    <div style={tableCardStyle}>
      <div style={{ ...tableHeaderStyle, display: 'flex', flexDirection: 'column' as const }}>
        <h2 className="text-sm font-bold" style={{ color: N.ink }}>Team Members</h2>
        <p className="text-[11px] mt-0.5" style={{ color: N.muted }}>{emp.team_members.length} seat{emp.team_members.length !== 1 ? 's' : ''} used</p>
      </div>
      {emp.team_members.length === 0 ? (
        <Empty icon={Users} text="No team members" />
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            {['Member', 'Role', 'Status', 'Joined'].map((h, i) => (
              <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
            ))}
          </div>
          {emp.team_members.map((m: any, idx: number) => (
            <div key={m.user_id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
              style={{ borderBottom: idx < emp.team_members.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined, background: idx % 2 === 0 ? '#fff' : N.cream }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{m.full_name ?? m.email ?? m.phone}</p>
                  {m.is_owner && <Badge color="blue">Owner</Badge>}
                </div>
                <p className="text-xs truncate" style={{ color: N.muted }}>{m.email ?? m.phone}</p>
              </div>
              <span className="text-xs font-medium text-right capitalize" style={{ color: '#475569' }}>{m.role_name.replace(/_/g, ' ')}</span>
              <span className="text-right">
                {m.is_active ? <CheckCircle2 className="w-4 h-4 ml-auto text-green-500" /> : <XCircle className="w-4 h-4 ml-auto text-red-400" />}
              </span>
              <span className="text-xs text-right whitespace-nowrap" style={{ color: N.muted }}>
                {new Date(m.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Tab: Applicants ────────────────────────────────────────────────────────────

function ApplicantsTab({ emp }: { emp: any }) {
  const navigate = useNavigate()
  const { data, isLoading } = useEmployerJobs(emp.id)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs" style={{ color: N.muted }}>
        Showing applicant counts per job for <span className="font-semibold" style={{ color: N.ink }}>{emp.company_name}</span>.
        Click a job to see all applicants for that role.
      </p>
      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.items.length ? (
          <Empty icon={Users} text="No jobs — no applicants" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Job', 'Applicants', ''].map((h, i) => (
                <span key={i} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {data.items.map((j, idx) => (
              <div key={j.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center"
                style={{ borderBottom: idx < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined, background: idx % 2 === 0 ? '#fff' : N.cream }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{j.title}</p>
                  <p className="text-xs" style={{ color: N.muted }}>{j.sector}</p>
                </div>
                <span className="text-sm font-bold text-right" style={{ color: N.ink }}>{j.applicant_count}</span>
                <button
                  onClick={() => navigate(`/admin/jobs/${j.id}?tab=applicants`)}
                  className="h-7 px-3 text-xs font-semibold whitespace-nowrap transition-colors"
                  style={{ background: N.creamDk, color: N.ink, borderRadius: 8, border: 'none' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#D1D5DB')}
                  onMouseOut={e => (e.currentTarget.style.background = N.creamDk)}
                >
                  View →
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab: Departments ───────────────────────────────────────────────────────────

function DepartmentsTab({ emp }: { emp: any }) {
  const navigate = useNavigate()
  const { data, isLoading } = useEmployerJobs(emp.id)

  const bySector = (data?.items ?? []).reduce<Record<string, typeof data.items>>((acc, j) => {
    const key = j.sector ?? 'Other'
    ;(acc[key] ??= []).push(j)
    return acc
  }, {})

  const sectors = Object.keys(bySector).sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 px-4 py-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16 }}>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-800">Department admin view coming soon</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Full department management requires a dedicated admin-scoped endpoint. Jobs below are grouped by sector as a structural overview.
          </p>
        </div>
      </div>

      {isLoading ? <Spinner /> : sectors.length === 0 ? (
        <Empty icon={Briefcase} text="No jobs posted — no department structure to show" />
      ) : (
        <div className="flex flex-col gap-4">
          {sectors.map(sector => {
            const sectorJobs = bySector[sector]
            const activeCount = sectorJobs.filter(j => j.is_active).length
            const totalApps   = sectorJobs.reduce((s, j) => s + j.applicant_count, 0)
            return (
              <div key={sector} style={tableCardStyle}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: N.ink }}>{sector}</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: N.muted }}>
                      {sectorJobs.length} job{sectorJobs.length !== 1 ? 's' : ''} · {activeCount} active · {totalApps} total applications
                    </p>
                  </div>
                  <div className="flex gap-2 text-right">
                    <div className="text-center px-3">
                      <p className="text-lg font-black" style={{ color: N.ink }}>{sectorJobs.length}</p>
                      <p className="text-[10px]" style={{ color: N.muted }}>Jobs</p>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-lg font-black" style={{ color: N.ink }}>{totalApps}</p>
                      <p className="text-[10px]" style={{ color: N.muted }}>Apps</p>
                    </div>
                  </div>
                </div>
                {sectorJobs.slice(0, 5).map((j, idx) => (
                  <button
                    key={j.id}
                    onClick={() => navigate(`/admin/jobs/${j.id}`)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: idx % 2 === 0 ? '#fff' : N.cream,
                      borderBottom: idx < Math.min(sectorJobs.length, 5) - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                    onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: N.ink }}>{j.title}</p>
                      {j.location && <p className="text-[11px]" style={{ color: N.muted }}>{j.location}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs tabular-nums" style={{ color: N.muted }}>{j.applicant_count} apps</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: j.is_active ? '#F0FDF4' : N.cream, color: j.is_active ? '#15803D' : N.muted }}>
                        {j.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                ))}
                {sectorJobs.length > 5 && (
                  <p className="px-4 py-2 text-[11px]" style={{ color: N.muted }}>+{sectorJobs.length - 5} more jobs in this sector</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Activity ──────────────────────────────────────────────────────────────

function ActivityTab({ emp }: { emp: any }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: 32 }}>
      <Activity className="w-12 h-12" style={{ color: N.creamDk }} />
      <p className="text-sm font-semibold" style={{ color: N.muted }}>Activity timeline</p>
      <p className="text-xs max-w-xs" style={{ color: N.muted }}>
        Login history, job posting history, KYC events, and subscription changes will appear here.
        This requires a per-employer audit log filter — coming in the next iteration.
      </p>
    </div>
  )
}

// ── Tab: Support ───────────────────────────────────────────────────────────────

const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'amber', pending: 'blue', resolved: 'green', closed: 'gray',
}
const TICKET_PRIORITY_COLOR: Record<string, string> = {
  low: 'gray', normal: 'blue', high: 'amber', urgent: 'red',
}

function SupportTab({ emp }: { emp: any }) {
  const navigate = useNavigate()
  const { data, isLoading } = useEmployerSupportTickets(emp.id)

  return (
    <div className="flex flex-col gap-4">
      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.items.length ? (
          <Empty icon={MessageSquare} text="No support tickets for this employer" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Subject', 'Category', 'Priority', 'Status', 'Created'].map((h, i) => (
                <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {data.items.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => navigate(`/admin/support/${t.id}`)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
                style={{
                  background: idx % 2 === 0 ? '#fff' : N.cream,
                  borderBottom: idx < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                }}
                onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{t.subject}</p>
                  {t.reporter_name && <p className="text-xs truncate" style={{ color: N.muted }}>by {t.reporter_name}</p>}
                </div>
                <span className="text-xs text-right capitalize" style={{ color: '#475569' }}>{t.category}</span>
                <span className="text-right">
                  <Badge color={TICKET_PRIORITY_COLOR[t.priority] ?? 'gray'}>{t.priority}</Badge>
                </span>
                <span className="text-right">
                  <Badge color={TICKET_STATUS_COLOR[t.status] ?? 'gray'}>{t.status}</Badge>
                </span>
                <span className="text-xs text-right whitespace-nowrap" style={{ color: N.muted }}>
                  {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EmployerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'overview'
  const setTab = (t: string) => setSearchParams({ tab: t }, { replace: true })

  const { data: emp, isLoading } = useAdminEmployerDetail(id ?? null)

  if (isLoading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  if (!emp) return <Empty icon={Building2} text="Employer not found" />

  const tabs: TabDef[] = TABS.map(t => ({
    ...t,
    count: t.key === 'jobs'       ? emp.job_count
      : t.key === 'team'          ? emp.team_members.length
      : t.key === 'applicants'    ? emp.application_count
      : undefined,
  }))

  return (
    <section className="flex flex-col gap-0">
      <Breadcrumb items={[{ label: 'Employers', href: '/admin/employers' }, { label: emp.company_name }]} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: N.creamDk, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 className="w-5 h-5" style={{ color: N.ink }} />
        </div>
        <div className="min-w-0">
          <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>{emp.company_name}</h1>
          <p className="text-xs" style={{ color: N.muted }}>{emp.industry ?? 'Industry not set'} · {emp.city ?? 'Location not set'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {emp.is_approved
            ? <Badge color="green">Approved</Badge>
            : emp.rejection_reason
              ? <Badge color="red">Rejected</Badge>
              : <Badge color="amber">Pending</Badge>}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Jobs Posted',   value: emp.job_count },
          { label: 'Applications',  value: emp.application_count },
          { label: 'Team Members',  value: emp.team_members.length },
          { label: 'Plan',          value: emp.subscription_plan ?? 'Free' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: N.ink }}>{value}</p>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 'overview'    && <OverviewTab emp={emp} />}
      {activeTab === 'documents'   && <DocumentsTab emp={emp} />}
      {activeTab === 'jobs'        && <JobsTab emp={emp} />}
      {activeTab === 'departments' && <DepartmentsTab emp={emp} />}
      {activeTab === 'team'        && <TeamTab emp={emp} />}
      {activeTab === 'applicants'  && <ApplicantsTab emp={emp} />}
      {activeTab === 'activity'    && <ActivityTab emp={emp} />}
      {activeTab === 'support'     && <SupportTab emp={emp} />}
    </section>
  )
}
