import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Users, Briefcase, UserCheck,
  FileText, CheckCircle, Clock, XCircle, ChevronRight,
  Plus, BarChart3, Mail, Shield, Calendar, X, Eye, EyeOff,
  TrendingUp, Award, Send,
} from 'lucide-react'
import {
  useDepartment, useDepartmentJobs, useDepartmentOverview, useTeamMembers,
  useHasPermission, useInviteTeamMember,
} from '../hooks/useJobs'
import NotificationBell from '@/components/NotificationBell'
import { getApiError } from '@/api/client'
import type { DepartmentJobEntry } from '@/api/company'

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
    archived:  { label: 'Archived', color: '#9CA3AF', bg: '#F9FAFB', dot: '#E5E7EB' },
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
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 14, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s' }}
      onMouseOver={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = `${color}30` } }}
      onMouseOut={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#F1F5F9' } }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1, fontFamily: 'Hind, sans-serif' }}>{value}</p>
        <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', fontWeight: 500 }}>{label}</p>
      </div>
      {onClick && <ChevronRight size={14} color="#CBD5E1" style={{ marginLeft: 'auto' }} />}
    </div>
  )
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: DepartmentJobEntry }) {
  const posted  = job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
  const expires = job.expires_at ? new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
  const isExpired = job.expires_at ? new Date(job.expires_at) < new Date() : false

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
      onMouseOver={e => e.currentTarget.style.background = '#FAFBFF'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(30,58,95,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Briefcase size={15} color="#1E3A5F" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
          {job.employment_type?.replace('_', ' ')} · posted {posted}
          {job.location ? ` · ${job.location}` : ''}
        </p>
      </div>
      <StatusBadge status={job.status} />
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 64 }}>
        <p style={{ fontSize: 11, color: isExpired ? '#DC2626' : '#64748B', margin: 0, fontWeight: isExpired ? 700 : 500 }}>
          {isExpired ? 'Expired' : `Closes ${expires}`}
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.applicant_count}</p>
        <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0' }}>applicants</p>
      </div>
      <Link to={`/app/employer/pipeline/${job.id}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#3B82F6', textDecoration: 'none' }}>
        Pipeline <ChevronRight size={12} />
      </Link>
    </div>
  )
}

// ── Team member row ───────────────────────────────────────────────────────────

type TeamMember = {
  employer_profile_id: string
  contact_person: string
  email: string
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
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{member.contact_person}</p>
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
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 3px' }}>Invite team member</h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>to <strong>{departmentName}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={18} /></button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckCircle size={24} color="#059669" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>Account created!</p>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}><strong>{email}</strong> can now log in.</p>
            <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, background: '#1E3A5F', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Email', type: 'email', value: email, onChange: (v: string) => { setEmail(v); setErr('') }, placeholder: 'recruiter@company.com' },
              { label: 'Full name', type: 'text', value: name, onChange: (v: string) => { setName(v); setErr('') }, placeholder: 'e.g. Priya Sharma' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label} <span style={{ color: '#EF4444' }}>*</span></label>
                <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                  style={{ width: '100%', height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Password <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErr('') }} placeholder="Min. 6 characters"
                  style={{ width: '100%', height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 40px 0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Role <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ROLES.map(r => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: role === r.value ? '2px solid #3B82F6' : '1.5px solid #E5E7EB', background: role === r.value ? '#EFF6FF' : '#fff' }}>
                    <input type="radio" name="dept_role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} style={{ marginTop: 2, accentColor: '#3B82F6' }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{r.label}</p>
                      <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={onClose} disabled={busy} style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={busy} style={{ flex: 2, height: 40, borderRadius: 10, border: 'none', background: '#1E3A5F', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'white', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Creating…' : 'Create & invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ deptId, dept, overview, jobs, deptTeam, onSwitchTab }: {
  deptId: string
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '12px 16px' }}>
          <Clock size={15} color="#6366F1" />
          <p style={{ fontSize: 13, color: '#4338CA', margin: 0, flex: 1 }}>
            <strong>{draftJobs.length}</strong> draft job{draftJobs.length !== 1 ? 's' : ''} — ready to publish?
          </p>
          <button onClick={() => onSwitchTab('jobs')} style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', background: 'rgba(99,102,241,0.12)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Review
          </button>
        </div>
      )}

      {/* Dept-specific quick stats */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { icon: Calendar, label: 'Scheduled Interviews', value: fmt(overview.scheduled_interviews_count), color: '#0EA5E9' },
            { icon: Send,     label: 'Pending Offers',       value: fmt(overview.pending_offers_count),       color: '#059669' },
            { icon: Clock,    label: 'Avg. Days to Hire',    value: overview.avg_days_to_hire != null ? `${overview.avg_days_to_hire}d` : '—', color: '#6366F1' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={16} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: '#64748B', margin: '3px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline funnel — dept only */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Candidate Pipeline</p>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{s.pct}%</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.color, minWidth: 24, textAlign: 'right', fontFamily: 'Hind, sans-serif' }}>{s.value}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: '#F8FAFC', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(37,99,235,0.08)' }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 20, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active jobs preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Active Jobs <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 6 }}>in {dept.name}</span></p>
          <button onClick={() => onSwitchTab('jobs')} style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            All jobs <ChevronRight size={12} />
          </button>
        </div>
        {activeJobs.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#CBD5E1' }}>No active jobs. Publish a draft to start receiving applicants.</p>
          </div>
        ) : (
          activeJobs.slice(0, 4).map(job => <JobRow key={job.id} job={job} />)
        )}
      </div>

      {/* Team preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Team <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 6 }}>{deptTeam.length} member{deptTeam.length !== 1 ? 's' : ''}</span></p>
          <button onClick={() => onSwitchTab('team')} style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
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

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: dept, isLoading: deptLoading } = useDepartment(id ?? '')
  const { data: overview } = useDepartmentOverview(id ?? '')
  const { data: jobs, isLoading: jobsLoading } = useDepartmentJobs(id ?? '')
  const { data: allTeam } = useTeamMembers()
  const canManage    = useHasPermission('departments:write')
  const canCreateJob = useHasPermission('jobs:create')

  const [activeTab, setActiveTab]           = useState<Tab>('overview')
  const [jobStatusFilter, setJobStatusFilter] = useState('all')
  const [showInvite, setShowInvite]          = useState(false)

  const deptTeam: TeamMember[] = (allTeam ?? []).filter(m => m.department_id === id)

  const Loading = () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading department…</p>
    </div>
  )

  if (deptLoading) return <Loading />
  if (!dept) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94A3B8', fontSize: 14 }}>Department not found.</p>
    </div>
  )

  const filteredJobs = (jobs ?? []).filter(j => jobStatusFilter === 'all' || j.status === jobStatusFilter)

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'jobs',     label: 'Jobs',     icon: Briefcase, count: (jobs ?? []).length },
    { key: 'team',     label: 'Team',     icon: Users,     count: deptTeam.length },
  ]

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(37,99,235,0.08)', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/app/employer/departments" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: '#F8FAFC', color: '#64748B', textDecoration: 'none', flexShrink: 0, border: '1px solid rgba(37,99,235,0.08)' }}>
              <ArrowLeft size={15} />
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(30,58,95,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={15} color="#1E3A5F" />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>{dept.name}</h1>
                {dept.head_name && (
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <UserCheck size={9} />{dept.head_name}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
            {canManage && (
              <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Users size={13} />Invite
              </button>
            )}
            {canCreateJob && (
              <button onClick={() => navigate('/app/employer/jobs')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 9, background: '#1E3A5F', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={14} />New Job
              </button>
            )}
          </div>
        </header>

        <main style={{ padding: '24px 32px', flex: 1, maxWidth: 1200 }}>

          {/* Dept-level KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <MetricCard icon={Briefcase} label="Active Jobs"    value={fmt(dept.active_job_count)}      color="#059669" onClick={() => setActiveTab('jobs')} />
            <MetricCard icon={FileText}  label="Total Jobs"     value={fmt(dept.total_job_count)}       color="#1E3A5F" onClick={() => setActiveTab('jobs')} />
            <MetricCard icon={Users}     label="Applicants"     value={fmt(dept.total_applicant_count)} color="#3B82F6" />
            <MetricCard icon={Users}     label="Team Members"   value={fmt(dept.member_count)}          color="#7C3AED" onClick={() => setActiveTab('team')} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#0F172A' : '#64748B', transition: 'all 0.15s', boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <tab.icon size={13} />
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: activeTab === tab.key ? '#F1F5F9' : 'rgba(30,58,95,0.06)', color: activeTab === tab.key ? '#374151' : '#94A3B8', fontWeight: 700 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <OverviewTab deptId={id!} dept={dept} overview={overview} jobs={jobs ?? []} deptTeam={deptTeam} onSwitchTab={setActiveTab} />
          )}

          {activeTab === 'jobs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {['all', 'published', 'draft', 'paused', 'closed'].map(s => (
                  <button key={s} onClick={() => setJobStatusFilter(s)} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: jobStatusFilter === s ? 'none' : '1px solid #E2E8F0', background: jobStatusFilter === s ? '#0F172A' : '#fff', color: jobStatusFilter === s ? '#fff' : '#64748B', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                {jobsLoading ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading jobs…</div>
                ) : filteredJobs.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Briefcase size={20} color="#CBD5E1" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                      {jobStatusFilter === 'all' ? 'No jobs yet' : `No ${jobStatusFilter} jobs`}
                    </p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                      {jobStatusFilter === 'all' ? `Create a job and select ${dept.name} as the department.` : 'Try a different filter.'}
                    </p>
                  </div>
                ) : (
                  filteredJobs.map(job => <JobRow key={job.id} job={job} />)
                )}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {dept.name} Team
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', marginLeft: 8 }}>{deptTeam.length} member{deptTeam.length !== 1 ? 's' : ''}</span>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {canManage && (
                      <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, background: '#1E3A5F', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={11} />Invite Member
                      </button>
                    )}
                    <Link to="/app/employer/company" style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      Manage org team <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>

                {deptTeam.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Users size={20} color="#CBD5E1" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>No members assigned</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>Assign team members from the org team page, or invite directly.</p>
                    <Link to="/app/employer/company" style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Go to Team Management <ChevronRight size={12} />
                    </Link>
                  </div>
                ) : (
                  deptTeam.map(m => <TeamMemberRow key={m.employer_profile_id} member={m} />)
                )}
              </div>

              {/* Role capabilities */}
              {deptTeam.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(37,99,235,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Role capabilities in {dept.name}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {[
                      { role: 'Recruiter',      caps: 'Post jobs · Manage candidates' },
                      { role: 'Hiring Manager', caps: 'Review shortlists · Submit scorecards' },
                      { role: 'Interviewer',    caps: 'Conduct interviews · Submit feedback' },
                    ].map(r => (
                      <div key={r.role} style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid rgba(37,99,235,0.08)' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' }}>{r.role}</p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>{r.caps}</p>
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
    </div>
  )
}
