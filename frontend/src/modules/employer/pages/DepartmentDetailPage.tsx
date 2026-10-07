import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Users, Briefcase,
  FileText, CheckCircle, Clock, XCircle, ChevronRight,
  Plus, BarChart3, Mail, Shield, Calendar, X, Eye, EyeOff,
  Send, Pencil, Trash2, Copy, ClipboardList,
} from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'
import {
  useDepartment, useDepartmentJobs, useDepartmentOverview, useTeamMembers,
  useHasPermission, useInviteTeamMember, useEmployerPermissions, useEmployerDashboard,
  useCreateJob, useUpdateJob, useDeleteJob, usePublishJob, usePauseJob,
  useCloseJob, useReopenJob, useDuplicateJob,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { DepartmentJobEntry } from '@/api/company'
import type { JobPosting, JobPostingPayload } from '@/api/jobs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import { formatDate as fmtDate } from '@/shared/utils/format'
import JobForm from '../components/JobForm'
import StatusChip from '../components/StatusChip'
import Button from '@/shared/components/primitives/Button'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import PageHeader from '@/shared/layouts/PageHeader'
import Tabs, { type TabItem } from '@/shared/components/navigation/Tabs'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'

const C = { ink1: colors.text.ink, ink2: colors.text.inkSoft, ink3: colors.text.muted, border: colors.border.default, borderLight: colors.border.default, accent: colors.state.info, green: colors.state.success, red: colors.state.danger }

type Tab = 'overview' | 'jobs' | 'team'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, fallback = '—'): string {
  if (n == null) return fallback
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    published: { label: 'Active',   color: '#059669', bg: '#ECFDF5', dot: '#34D399' },
    draft:     { label: 'Draft',    color: '#D97706', bg: '#FFFBEB', dot: '#FCD34D' },
    paused:    { label: 'Paused',   color: '#6366F1', bg: '#EEF2FF', dot: '#A5B4FC' },
    closed:    { label: 'Closed',   color: '#6B7280', bg: '#F3F4F6', dot: '#D1D5DB' },
    archived:  { label: 'Archived', color: colors.text.muted, bg: colors.surface.elevated, dot: colors.border.medium },
  }
  const s = map[status] ?? map.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, color, onClick }: {
  icon: React.ElementType; label: string; value: string | number; color: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 14, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s' }}
      onMouseOver={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = `${color}30` } }}
      onMouseOut={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = colors.border.default } }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: colors.text.ink, margin: 0, lineHeight: 1, fontFamily: 'Hind, sans-serif' }}>{value}</p>
        <p style={{ fontSize: 12, color: colors.text.inkSoft, margin: '4px 0 0', fontWeight: 500 }}>{label}</p>
      </div>
      {onClick && <ChevronRight size={14} color="#CBD5E1" style={{ marginLeft: 'auto' }} />}
    </div>
  )
}

// ── Job preview row (Overview tab only — read-only) ─────────────────────────────

function JobPreviewRow({ job }: { job: DepartmentJobEntry }) {
  const posted  = job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
  const expires = job.expires_at ? new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
  const isExpired = job.expires_at ? new Date(job.expires_at) < new Date() : false

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
      onMouseOver={e => e.currentTarget.style.background = '#FAFBFF'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(30,58,95,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Briefcase size={15} color="#1E3A5F" />
      </div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
          {job.employment_type?.replace('_', ' ')} · posted {posted}
          {job.location ? ` · ${job.location}` : ''}
        </p>
      </div>
      <StatusBadge status={job.status} />
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 64 }}>
        <p style={{ fontSize: 11, color: isExpired ? '#DC2626' : colors.text.inkSoft, margin: 0, fontWeight: isExpired ? 700 : 500 }}>
          {isExpired ? 'Expired' : `Closes ${expires}`}
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.applicant_count}</p>
        <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0' }}>applicants</p>
      </div>
      <Link to={`/app/employer/pipeline/${job.id}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
        Pipeline <ChevronRight size={12} />
      </Link>
    </div>
  )
}

// ── Job row (Jobs tab — full management) ────────────────────────────────────────
// This is where job creation/editing/publishing actually happens — the
// company-wide Jobs page is read-only monitoring only, per the "departments
// manage their own jobs" design.

const JOB_COLS = '1fr 96px 96px 96px 88px 148px'

function JobManageRow({
  job, canEdit, canPublish, canDelete, isMutating,
  onEdit, onDelete, onPublish, onPause, onClose, onReopen, onDuplicate,
}: {
  job: JobPosting; canEdit: boolean; canPublish: boolean; canDelete: boolean; isMutating: boolean
  onEdit: () => void; onDelete: () => void; onPublish: () => void
  onPause: () => void; onClose: () => void; onReopen: () => void; onDuplicate: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const spin: React.CSSProperties = { animation: 'spin 0.7s linear infinite', borderRadius: '50%', width: 10, height: 10, border: `2px solid ${C.ink3}`, borderTopColor: 'transparent', display: 'inline-block' }

  const primaryBtn = (label: string, fn: () => void, color: string = C.accent) => (
    <button onClick={fn} disabled={isMutating} aria-label={label}
      style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${color}30`, background: `${color}0f`, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      {isMutating ? <span style={spin} /> : label}
    </button>
  )

  const iconBtn = (icon: React.ReactNode, fn: () => void, title: string, danger = false) => (
    <Button variant="ghost" size="icon" onClick={fn} aria-label={title}
      style={{ color: danger ? C.red : C.ink3, border: `1px solid ${C.border}`, width: 26, height: 26 }}>
      {icon}
    </Button>
  )

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: JOB_COLS, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: hovered ? colors.surface.elevated : '#fff', transition: 'background 0.1s', opacity: job.status === 'archived' ? 0.6 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
        <p style={{ fontSize: 11, color: C.ink3, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[job.sector, job.location, job.employment_type ? (EMPLOYMENT_TYPE_LABELS[job.employment_type as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? job.employment_type) : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      <StatusChip status={job.status} />

      <Link to={`/app/employer/pipeline/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: (job.applicant_count ?? 0) > 0 ? C.accent : C.ink3, textDecoration: 'none' }}>
        <Users size={12} />
        {job.applicant_count ?? 0}
      </Link>

      <span style={{ fontSize: 12, color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
        {formatSalary(job.salary_min, job.salary_max) ? `₹${formatSalary(job.salary_min, job.salary_max)}` : '—'}
      </span>

      <span style={{ fontSize: 12, color: C.ink3 }}>{fmtDate(job.created_at)}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {job.status === 'draft'     && canPublish && primaryBtn('Publish', onPublish, C.green)}
        {job.status === 'published' && canPublish && primaryBtn('Pause',   onPause,   '#D97706')}
        {job.status === 'paused'    && canPublish && primaryBtn('Resume',  onReopen,  C.green)}
        {job.status === 'closed'    && canPublish && primaryBtn('Reopen',  onReopen,  C.accent)}
        {(job.status === 'published' || job.status === 'paused') && canPublish && iconBtn(<XCircle size={12} />, onClose, 'Close', true)}
        {canEdit    && iconBtn(<Pencil size={12} />, onEdit,      'Edit')}
        {canEdit    && iconBtn(<Copy size={12} />,   onDuplicate, 'Duplicate')}
        <Link to={`/app/employer/jobs/${job.id}/form-builder`} title="Application Form Builder" style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
          <ClipboardList size={12} />
        </Link>
        {canDelete  && iconBtn(<Trash2 size={12} />, onDelete, 'Delete', true)}
      </div>
    </div>
  )
}

// ── Team member row ───────────────────────────────────────────────────────────

type TeamMember = {
  employer_profile_id: string
  contact_person: string
  email: string | null
  role_name: string
  is_owner: boolean
  department_id: string | null
}

function TeamMemberRow({ member }: { member: TeamMember }) {
  const roleColors: Record<string, { color: string; bg: string }> = {
    employer_owner: { color: '#1E3A5F', bg: 'rgba(30,58,95,0.08)' },
    hr_manager:     { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
    hr_admin:       { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
    recruiter:      { color: '#059669', bg: 'rgba(5,150,105,0.08)' },
    interviewer:    { color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    hiring_manager: { color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  }
  const style = roleColors[member.role_name] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.08)' }
  const initials = member.contact_person.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid #F8FAFC' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: `${style.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: style.color }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{member.contact_person}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Mail size={10} color="#94A3B8" />
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{member.email}</p>
        </div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: style.color, background: style.bg, flexShrink: 0 }}>
        <Shield size={9} />
        {member.role_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </span>
    </div>
  )
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ departmentId, departmentName, onClose }: {
  departmentId: string; departmentName: string; onClose: () => void
}) {
  const invite = useInviteTeamMember()
  const [email, setEmail]       = useState('')
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [role, setRole]         = useState<'recruiter' | 'hiring_manager' | 'interviewer'>('recruiter')
  const [err, setErr]           = useState('')
  const [done, setDone]         = useState(false)

  const busy = invite.isPending

  const handleSubmit = () => {
    if (!email.trim()) { setErr('Email is required'); return }
    if (!name.trim())  { setErr('Full name is required'); return }
    if (!password || password.length < 6) { setErr('Password must be at least 6 characters'); return }
    invite.mutate({ email: email.trim(), contact_person: name.trim(), role_name: role, department_id: departmentId, password }, {
      onSuccess: () => setDone(true),
      onError: e => setErr(getApiError(e)),
    })
  }

  const ROLES = [
    { value: 'recruiter',      label: 'Recruiter',      desc: 'Post jobs, manage candidates in this department' },
    { value: 'hiring_manager', label: 'Hiring Manager', desc: 'Review shortlists, submit scorecards' },
    { value: 'interviewer',    label: 'Interviewer',     desc: 'Conduct interviews, submit feedback' },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: '0 0 3px' }}>Invite team member</h3>
            <p style={{ fontSize: 12, color: colors.text.inkSoft, margin: 0 }}>to <strong>{departmentName}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted, padding: 4 }}><X size={18} /></button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckCircle size={24} color="#059669" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 6px' }}>Account created!</p>
            <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 0 20px' }}><strong>{email}</strong> can now log in.</p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Email', type: 'email', value: email, onChange: (v: string) => { setEmail(v); setErr('') }, placeholder: 'recruiter@company.com' },
              { label: 'Full name', type: 'text', value: name, onChange: (v: string) => { setName(v); setErr('') }, placeholder: 'e.g. Priya Sharma' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>{f.label} <span style={{ color: '#EF4444' }}>*</span></label>
                <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                  style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>Password <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErr('') }} placeholder="Min. 6 characters"
                  style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '0 40px 0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 8 }}>Role <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ROLES.map(r => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: radius.xl, cursor: 'pointer', border: role === r.value ? `2px solid ${colors.brand.navy}` : `1.5px solid ${colors.border.default}`, background: role === r.value ? colors.state.infoBg : '#fff' }}>
                    <input type="radio" name="dept_role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} style={{ marginTop: 2, accentColor: colors.brand.navy }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{r.label}</p>
                      <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: '2px 0 0' }}>{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button className="flex-1" style={{ flex: 2 }} onClick={handleSubmit} loading={busy}>Create & invite</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ dept, overview, jobs, deptTeam, onSwitchTab }: {
  dept: { name: string; active_job_count: number; total_job_count: number; total_applicant_count: number; member_count: number }
  overview: { pipeline_funnel: Record<string, number>; scheduled_interviews_count: number; pending_offers_count: number; avg_days_to_hire: number | null } | undefined
  jobs: DepartmentJobEntry[]
  deptTeam: TeamMember[]
  onSwitchTab: (tab: Tab) => void
}) {
  const activeJobs = jobs.filter(j => j.status === 'published')
  const draftJobs  = jobs.filter(j => j.status === 'draft')

  const FUNNEL_ORDER = ['applied', 'under_review', 'screening', 'shortlisted', 'interview_scheduled', 'interview_completed', 'offer_sent', 'hired']
  const FUNNEL_LABELS: Record<string, string> = {
    applied: 'Applied', under_review: 'Under Review', screening: 'Screening',
    shortlisted: 'Shortlisted', interview_scheduled: 'Interview Scheduled',
    interview_completed: 'Interview Done', offer_sent: 'Offer Sent', hired: 'Hired',
  }
  const FUNNEL_COLORS: Record<string, string> = {
    applied: '#3B82F6', under_review: '#6366F1', screening: '#8B5CF6',
    shortlisted: '#0EA5E9', interview_scheduled: '#D97706', interview_completed: '#F59E0B',
    offer_sent: '#059669', hired: '#10B981',
  }
  const funnel = overview?.pipeline_funnel ?? {}
  const totalApplied = funnel.applied ?? 0
  const funnelRows = FUNNEL_ORDER
    .filter(k => (funnel[k] ?? 0) > 0)
    .map(k => ({ key: k, label: FUNNEL_LABELS[k] ?? k, value: funnel[k] ?? 0, color: FUNNEL_COLORS[k] ?? '#6B7280', pct: totalApplied > 0 ? Math.round(((funnel[k] ?? 0) / totalApplied) * 100) : 0 }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Draft alert */}
      {draftJobs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.state.infoBg, border: '1px solid #BFDBFE', borderRadius: radius.xl, padding: '12px 16px' }}>
          <Clock size={15} color={colors.state.info} />
          <p style={{ fontSize: 13, color: '#1E40AF', margin: 0, flex: 1 }}>
            <strong>{draftJobs.length}</strong> draft job{draftJobs.length !== 1 ? 's' : ''} — ready to publish?
          </p>
          <button onClick={() => onSwitchTab('jobs')} style={{ fontSize: 12, fontWeight: 700, color: colors.state.info, background: colors.state.infoBg, border: `1px solid #BFDBFE`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Review
          </button>
        </div>
      )}

      {/* Dept-specific quick stats */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { icon: Calendar, label: 'Scheduled Interviews', value: fmt(overview.scheduled_interviews_count), color: '#0EA5E9' },
            { icon: Send,     label: 'Pending Offers',       value: fmt(overview.pending_offers_count),       color: '#059669' },
            { icon: Clock,    label: 'Avg. Days to Hire',    value: overview.avg_days_to_hire != null ? `${overview.avg_days_to_hire}d` : '—', color: '#0EA5E9' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={16} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: '3px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline funnel — dept only */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Candidate Pipeline</p>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{dept.name} only</span>
        </div>
        {funnelRows.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#CBD5E1' }}>No applicants in this department yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {funnelRows.map(s => (
              <div key={s.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.inkSoft }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{s.pct}%</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.color, minWidth: 24, textAlign: 'right', fontFamily: 'Hind, sans-serif' }}>{s.value}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: '#F8FAFC', borderRadius: 20, overflow: 'hidden', border: `1px solid ${colors.border.default}` }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 20, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active jobs preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Active Jobs <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 6 }}>in {dept.name}</span></p>
          <button onClick={() => onSwitchTab('jobs')} style={{ fontSize: 12, fontWeight: 600, color: colors.state.info, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            All jobs <ChevronRight size={12} />
          </button>
        </div>
        {activeJobs.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#CBD5E1' }}>No active jobs. Publish a draft to start receiving applicants.</p>
          </div>
        ) : (
          activeJobs.slice(0, 4).map(job => <JobPreviewRow key={job.id} job={job} />)
        )}
      </div>

      {/* Team preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Team <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 6 }}>{deptTeam.length} member{deptTeam.length !== 1 ? 's' : ''}</span></p>
          <button onClick={() => onSwitchTab('team')} style={{ fontSize: 12, fontWeight: 600, color: colors.state.info, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            View all <ChevronRight size={12} />
          </button>
        </div>
        {deptTeam.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#CBD5E1' }}>No members assigned yet.</p>
          </div>
        ) : (
          deptTeam.slice(0, 3).map(m => <TeamMemberRow key={m.employer_profile_id} member={m} />)
        )}
      </div>

    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type JobView = 'list' | 'new' | { edit: JobPosting }

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: dept, isLoading: deptLoading, isError: deptError, refetch: refetchDept } = useDepartment(id ?? '')
  const { data: overview } = useDepartmentOverview(id ?? '')
  const { data: jobs, isLoading: jobsLoading } = useDepartmentJobs(id ?? '')
  const { data: allTeam } = useTeamMembers()
  const { data: myPerms } = useEmployerPermissions()
  // Full JobPosting[] (unlike useDepartmentJobs' lighter DepartmentJobEntry)
  // — the Jobs tab needs every field JobForm edits (description, skills,
  // salary, etc.), and this is already scoped correctly by the backend for
  // a dept-scoped caller, or filterable client-side for a company-wide one.
  const { data: dashboard } = useEmployerDashboard()
  // Backend guards department create/update/delete with companies:edit, not a
  // separate departments:* permission (which doesn't exist in the system) —
  // check the same one the API actually enforces.
  const canManage    = useHasPermission('companies:edit')
  const canCreateJob = useHasPermission('jobs:create')
  const canEditJob   = useHasPermission('jobs:edit')
  const canPublishJob = useHasPermission('jobs:publish')
  const canDeleteJob = useHasPermission('jobs:delete')
  // A department-scoped recruiter/HR manager can only ever post into their OWN
  // department (the backend silently forces this regardless of what's
  // requested), so for them "New Job" only makes sense on that same
  // department. A company-wide user (owner/hr_admin, no department_id) can
  // post into any department they're viewing — same as LinkedIn Recruiter's
  // admin seat or Naukri's super-user, both of which can post jobs directly
  // rather than only being able to delegate to a scoped seat.
  const isMyDepartment = myPerms?.department_id === id || !!myPerms?.is_company_wide

  const createJob    = useCreateJob()
  const updateJob    = useUpdateJob()
  const deleteJob    = useDeleteJob()
  const publishJob   = usePublishJob()
  const pauseJob     = usePauseJob()
  const closeJob     = useCloseJob()
  const reopenJob    = useReopenJob()
  const duplicateJob = useDuplicateJob()

  // Dashboard's "Post a Job" links here with ?newJob=1 when it can resolve a
  // single unambiguous department to jump into, so the button actually opens
  // the job form in one click instead of landing on Overview first.
  const [searchParams] = useSearchParams()
  const wantsNewJob = searchParams.get('newJob') === '1'

  const [activeTab, setActiveTab]           = useState<Tab>(wantsNewJob ? 'jobs' : 'overview')
  const [jobStatusFilter, setJobStatusFilter] = useState('all')
  const [showInvite, setShowInvite]          = useState(false)
  const [jobView, setJobView]                = useState<JobView>(wantsNewJob ? 'new' : 'list')
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<string | null>(null)
  const [mutatingJobId, setMutatingJobId]    = useState<string | null>(null)

  const deptTeam: TeamMember[] = (allTeam ?? []).filter(m => m.department_id === id)
  const deptJobs: JobPosting[] = (dashboard?.jobs ?? []).filter(j => j.department_id === id)

  const runJobAction = async (jobId: string, fn: (id: string) => Promise<unknown>) => {
    setMutatingJobId(jobId); try { await fn(jobId) } finally { setMutatingJobId(null) }
  }

  const handleCreateJob = (payload: JobPostingPayload) =>
    createJob.mutate(payload, { onSuccess: () => setJobView('list') })

  const handleUpdateJob = (jobId: string, payload: JobPostingPayload) =>
    updateJob.mutate({ id: jobId, data: payload }, { onSuccess: () => setJobView('list') })

  const handleDeleteJob = (jobId: string) =>
    deleteJob.mutate(jobId, { onSuccess: () => setConfirmDeleteJob(null) })

  if (deptLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size="md" centered />
    </div>
  )
  if (deptError) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ErrorState title="Department unavailable" description="Could not load this department. Please try again." onRetry={() => refetchDept()} />
    </div>
  )
  if (!dept) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ErrorState title="Department not found" description="This department doesn't exist or you don't have access." />
    </div>
  )

  const filteredJobs = deptJobs.filter(j => jobStatusFilter === 'all' || j.status === jobStatusFilter)

  const tabs: TabItem[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
    { key: 'jobs',     label: 'Jobs',     icon: <Briefcase size={13} />, count: deptJobs.length },
    { key: 'team',     label: 'Team',     icon: <Users size={13} />,     count: deptTeam.length },
  ]

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        <PageHeader
          title={dept.name}
          subtitle={dept.head_name ? `Head: ${dept.head_name}` : 'Department overview'}
          below={<div style={{ paddingBottom: 8 }}><Breadcrumb items={[{ label: 'Departments', href: '/app/employer/departments' }, { label: dept.name }]} /></div>}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}><Users size={13} />Invite</Button>
              )}
              {canCreateJob && isMyDepartment && (
                <Button size="sm" onClick={() => { setActiveTab('jobs'); setJobView('new') }}><Plus size={14} />New Job</Button>
              )}
            </div>
          }
        />

        <main style={{ padding: '24px 32px', flex: 1, maxWidth: 1200 }}>

          {/* Dept-level KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <MetricCard icon={Briefcase} label="Active Jobs"    value={fmt(dept.active_job_count)}      color="#059669" onClick={() => setActiveTab('jobs')} />
            <MetricCard icon={FileText}  label="Total Jobs"     value={fmt(dept.total_job_count)}       color="#1E3A5F" onClick={() => setActiveTab('jobs')} />
            <MetricCard icon={Users}     label="Applicants"     value={fmt(dept.total_applicant_count)} color={colors.state.info} />
            <MetricCard icon={Users}     label="Team Members"   value={fmt(dept.member_count)}          color="#7C3AED" onClick={() => setActiveTab('team')} />
          </div>

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            active={activeTab}
            onChange={k => setActiveTab(k as Tab)}
            variant="pill"
            style={{ marginBottom: 20 }}
          />

          {/* Tab content */}
          {activeTab === 'overview' && (
            <OverviewTab dept={dept} overview={overview} jobs={jobs ?? []} deptTeam={deptTeam} onSwitchTab={setActiveTab} />
          )}

          {activeTab === 'jobs' && (
            jobView === 'new' ? (
              <div style={{ maxWidth: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: colors.text.ink, margin: 0 }}>New Job Posting</p>
                  <Button variant="outline" size="sm" onClick={() => setJobView('list')}><X size={14} />Cancel</Button>
                </div>
                <JobForm
                  lockedDepartmentId={id}
                  onSubmit={handleCreateJob}
                  loading={createJob.isPending}
                  onCancel={() => setJobView('list')}
                  error={createJob.isError ? getApiError(createJob.error) : undefined}
                />
              </div>
            ) : typeof jobView === 'object' && 'edit' in jobView ? (
              <div style={{ maxWidth: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Edit: {jobView.edit.title}</p>
                  <Button variant="outline" size="sm" onClick={() => setJobView('list')}><X size={14} />Cancel</Button>
                </div>
                <JobForm
                  initial={jobView.edit}
                  lockedDepartmentId={id}
                  onSubmit={p => handleUpdateJob(jobView.edit.id, p)}
                  loading={updateJob.isPending}
                  onCancel={() => setJobView('list')}
                  error={updateJob.isError ? getApiError(updateJob.error) : undefined}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {['all', 'published', 'draft', 'paused', 'closed'].map(s => (
                    <button key={s} onClick={() => setJobStatusFilter(s)} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: jobStatusFilter === s ? 'none' : '1px solid #E2E8F0', background: jobStatusFilter === s ? '#0F172A' : '#fff', color: jobStatusFilter === s ? '#fff' : colors.text.inkSoft, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {s === 'all' ? 'All' : s}
                    </button>
                  ))}
                  <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  {/* Narrower than ~700px, this table scrolls horizontally rather
                      than squishing columns — same pattern as the company-wide
                      Jobs page. */}
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 700 }}>
                      {jobsLoading ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading jobs…</div>
                      ) : filteredJobs.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <Briefcase size={20} color="#CBD5E1" />
                          </div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: '0 0 6px' }}>
                            {jobStatusFilter === 'all' ? 'No jobs yet' : `No ${jobStatusFilter} jobs`}
                          </p>
                          <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>
                            {jobStatusFilter === 'all' ? `Post the first job for ${dept.name}.` : 'Try a different filter.'}
                          </p>
                          {jobStatusFilter === 'all' && canCreateJob && isMyDepartment && (
                            <Button size="sm" onClick={() => setJobView('new')}><Plus size={13} />New Job</Button>
                          )}
                        </div>
                      ) : (
                        filteredJobs.map(job => (
                          <JobManageRow
                            key={job.id}
                            job={job}
                            canEdit={canEditJob}
                            canPublish={canPublishJob}
                            canDelete={canDeleteJob}
                            isMutating={mutatingJobId === job.id}
                            onEdit={() => setJobView({ edit: job })}
                            onDelete={() => setConfirmDeleteJob(job.id)}
                            onPublish={() => runJobAction(job.id, jid => publishJob.mutateAsync(jid))}
                            onPause={() => runJobAction(job.id, jid => pauseJob.mutateAsync(jid))}
                            onClose={() => runJobAction(job.id, jid => closeJob.mutateAsync(jid))}
                            onReopen={() => runJobAction(job.id, jid => reopenJob.mutateAsync(jid))}
                            onDuplicate={() => runJobAction(job.id, jid => duplicateJob.mutateAsync(jid))}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: 0 }}>
                    {dept.name} Team
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 8 }}>{deptTeam.length} member{deptTeam.length !== 1 ? 's' : ''}</span>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {canManage && (
                      <Button size="sm" onClick={() => setShowInvite(true)}><Plus size={11} />Invite Member</Button>
                    )}
                    <Link to="/app/employer/company" style={{ fontSize: 12, fontWeight: 600, color: colors.state.info, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      Manage org team <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>

                {deptTeam.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Users size={20} color="#CBD5E1" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, margin: '0 0 6px' }}>No members assigned</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>Assign team members from the org team page, or invite directly.</p>
                    <Link to="/app/employer/company" style={{ fontSize: 12, fontWeight: 700, color: colors.state.info, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Go to Team Management <ChevronRight size={12} />
                    </Link>
                  </div>
                ) : (
                  deptTeam.map(m => <TeamMemberRow key={m.employer_profile_id} member={m} />)
                )}
              </div>

              {/* Role capabilities */}
              {deptTeam.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: `1px solid ${colors.border.default}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Role capabilities in {dept.name}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {[
                      { role: 'Recruiter',      caps: 'Post jobs · Manage candidates' },
                      { role: 'Hiring Manager', caps: 'Review shortlists · Submit scorecards' },
                      { role: 'Interviewer',    caps: 'Conduct interviews · Submit feedback' },
                    ].map(r => (
                      <div key={r.role} style={{ padding: '10px 14px', borderRadius: radius.xl, background: '#F8FAFC', border: `1px solid ${colors.border.default}` }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, margin: '0 0 3px' }}>{r.role}</p>
                        <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: 0 }}>{r.caps}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

      {showInvite && id && (
        <InviteModal departmentId={id} departmentName={dept.name} onClose={() => setShowInvite(false)} />
      )}

      {confirmDeleteJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: radius.xl, padding: 24, maxWidth: 380, width: '100%', border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.ink1, margin: '0 0 8px' }}>Delete job posting?</h3>
            <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 20px' }}>This cannot be undone. All applicants for this job will lose access.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteJob(null)} fullWidth>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => handleDeleteJob(confirmDeleteJob)}
                disabled={deleteJob.isPending} loading={deleteJob.isPending} fullWidth>
                {deleteJob.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
