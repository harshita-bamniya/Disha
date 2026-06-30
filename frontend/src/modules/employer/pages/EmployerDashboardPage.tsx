import { useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationBell from '@/components/NotificationBell'
import {
  Plus, Pencil, Trash2, Clock,
  CheckCircle2, LogOut, LayoutDashboard, Building2,
  TrendingUp, PauseCircle, X, Users, ShieldCheck, Users2, BarChart3, CreditCard,
  Rocket, PlayCircle, XCircle, Archive, Copy,
  Briefcase, CalendarClock, Send, Award, Activity, Video, Sparkles, ArrowRight,
  Star, CalendarDays, Upload, Download,
} from 'lucide-react'
import {
  useEmployerDashboard, useCreateJob, useUpdateJob, useDeleteJob,
  usePublishJob, usePauseJob, useCloseJob, useReopenJob, useArchiveJob, useDuplicateJob,
  useDashboardKpis, useApplicationTrend, useUpcomingInterviews, useHasPermission,
  useCompanyProfile, useBulkImportJobs,
} from '../hooks/useJobs'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import JobForm from '../components/JobForm'
import type { JobPosting, JobPostingPayload } from '@/api/jobs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import { getApiError } from '@/api/client'

type View = 'list' | 'new' | { edit: JobPosting }

const OUTLOOK_STYLE: Record<string, { color: string; bg: string }> = {
  high:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)'  },
  medium: { color: '#D97706', bg: 'rgba(245,158,11,0.08)' },
  low:    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)' },
}

function Spinner12({ color }: { color: string }) {
  return <div style={{ width: 12, height: 12, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
}

function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 2px 12px rgba(30,58,95,0.05)', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 19, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif', lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap' }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

function ApplicationTrendStrip() {
  const { data } = useApplicationTrend(30)
  const series = data?.series ?? []
  const max = Math.max(1, ...series.map(p => p.count))

  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(30,58,95,0.05)',
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F', marginBottom: 10 }}>Application Trend — last 30 days</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
        {series.map(p => (
          <div
            key={p.date}
            title={`${p.date}: ${p.count}`}
            style={{
              flex: 1, minHeight: 2, borderRadius: 2,
              height: `${(p.count / max) * 100}%`,
              background: 'linear-gradient(180deg, #3B82F6, #93C5FD)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

const primaryActionStyle: React.CSSProperties = {
  flex: 1, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', border: 'none',
  color: '#fff', transition: 'all 0.2s',
}

function outlineActionStyle(color: string): React.CSSProperties {
  return {
    flex: 1, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: 'transparent', border: `1.5px solid ${color}33`,
    color, transition: 'all 0.2s',
  }
}

function iconActionStyle(color: string): React.CSSProperties {
  return {
    height: 36, width: 36, borderRadius: 10, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: `1px solid ${color}33`,
    color, transition: 'all 0.2s', flexShrink: 0,
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  companyName, totalJobs, activeJobs, isApproved, onNewJob, logout, view,
}: {
  companyName: string; totalJobs: number; activeJobs: number
  isApproved: boolean; onNewJob: () => void; logout: () => void; view: View
}) {
  const canCreateJob = useHasPermission('jobs:create')
  const initial = companyName.charAt(0).toUpperCase()

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(59,130,246,0.08)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflow: 'auto',
      boxShadow: '4px 0 24px rgba(30,58,95,0.04)',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(59,130,246,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 17 }}>D</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F' }}>BeginablAI</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', padding: '2px 7px', borderRadius: 6, letterSpacing: '0.3px' }}>EMPLOYER</span>
          </div>
        </div>
      </div>

      {/* Company card */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(59,130,246,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,197,253,0.2))',
            border: '2px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, color: '#3B82F6',
          }}>
            {initial}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {isApproved ? (
                <><CheckCircle2 size={11} color="#059669" /><span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Verified employer</span></>
              ) : (
                <><Clock size={11} color="#D97706" /><span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Pending approval</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: 6 }}>Navigation</p>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginBottom: 2,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          color: 'white', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(59,130,246,0.22)',
        }}>
          <LayoutDashboard size={16} />Dashboard
        </button>

        <Link to="/app/employer/verification" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 4,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <ShieldCheck size={16} />Verification
        </Link>

        <Link to="/app/employer/company" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <Users2 size={16} />Company & Team
        </Link>

        <Link to="/app/employer/talent-pool" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <Star size={16} />Talent Pool
        </Link>

        <Link to="/app/employer/calendar" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <CalendarDays size={16} />Calendar
        </Link>

        <Link to="/app/employer/analytics" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <BarChart3 size={16} />Analytics
        </Link>

        <Link to="/app/employer/subscription" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <CreditCard size={16} />Subscription
        </Link>

        <Link to="/app/security" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12, marginTop: 2,
          color: '#1E3A5F', textDecoration: 'none',
          fontSize: 14, fontWeight: 600,
        }}>
          <ShieldCheck size={16} />Security
        </Link>

        {/* Stats panel in sidebar */}
        <div style={{
          marginTop: 20, padding: 16,
          background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.14)',
          borderRadius: 16,
        }}>
          <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Job Postings</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total', value: totalJobs },
              { label: 'Active', value: activeJobs },
              { label: 'Paused', value: totalJobs - activeJobs },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'rgba(59,130,246,0.07)', borderRadius: 10, padding: '8px 4px',
                border: '1px solid rgba(59,130,246,0.1)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Post job CTA */}
        {isApproved && view === 'list' && canCreateJob && (
          <button onClick={onNewJob} style={{
            width: '100%', marginTop: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 14px', borderRadius: 12,
            background: 'rgba(59,130,246,0.07)', border: '1.5px dashed rgba(59,130,246,0.25)',
            color: '#3B82F6', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.border = '1.5px dashed rgba(59,130,246,0.4)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.07)'; e.currentTarget.style.border = '1.5px dashed rgba(59,130,246,0.25)' }}
          >
            <Plus size={15} />Post a job
          </button>
        )}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(59,130,246,0.06)' }}>
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 12px', borderRadius: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: '#9CA3AF', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />Log out
        </button>
      </div>
    </aside>
  )
}

// ── Job Card ──────────────────────────────────────────────────────────────────
const STATUS_BADGE_STYLE: Record<string, { bg: string; border: string; color: string; icon: React.ElementType; label: string }> = {
  draft:     { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', color: '#6B7280', icon: Pencil,       label: 'Draft' },
  published: { bg: 'rgba(5,150,105,0.08)',   border: 'rgba(5,150,105,0.2)',   color: '#059669', icon: CheckCircle2, label: 'Active' },
  paused:    { bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)',   color: '#D97706', icon: PauseCircle,  label: 'Paused' },
  closed:    { bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)',   color: '#DC2626', icon: XCircle,      label: 'Closed' },
  archived:  { bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.15)',color: '#9CA3AF', icon: Archive,      label: 'Archived' },
}

function JobCard({
  job, onEdit, onDelete, onPublish, onPause, onClose, onReopen, onArchive, onDuplicate, isMutating,
}: {
  job: JobPosting
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onPause: () => void
  onClose: () => void
  onReopen: () => void
  onArchive: () => void
  onDuplicate: () => void
  isMutating?: boolean
}) {
  const outlook = OUTLOOK_STYLE[job.growth_outlook ?? '']
  const canEdit = useHasPermission('jobs:edit')
  const canPublish = useHasPermission('jobs:publish')
  const canCreate = useHasPermission('jobs:create')
  const canDelete = useHasPermission('jobs:delete')
  const statusStyle = STATUS_BADGE_STYLE[job.status] ?? STATUS_BADGE_STYLE.draft
  const StatusIcon = statusStyle.icon

  return (
    <div style={{
      background: job.status === 'published' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(20px)',
      border: job.status === 'published' ? '1px solid rgba(255,255,255,0.95)' : '1.5px dashed rgba(156,163,175,0.4)',
      borderRadius: 20, padding: '20px',
      boxShadow: '0 4px 20px rgba(30,58,95,0.06)',
      opacity: job.status === 'archived' ? 0.6 : job.status === 'published' ? 1 : 0.8,
      transition: 'all 0.25s',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,197,253,0.15))',
              border: '1px solid rgba(59,130,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>💼</div>
            <div>
              <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 900, color: '#1E3A5F', lineHeight: 1.2 }}>{job.title}</h3>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                {job.sector}{job.job_type ? ` · ${job.job_type}` : ''}{job.location ? ` · ${job.location}` : ''}
              </p>
            </div>
          </div>
        </div>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: statusStyle.color }}>
            <StatusIcon size={10} />{statusStyle.label}
          </span>
        </div>
      </div>

      {/* Skills */}
      {(job.required_skills ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(job.required_skills ?? []).slice(0, 5).map(skill => (
            <span key={skill} style={{
              padding: '3px 9px', background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.12)',
              borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#3B82F6',
            }}>{skill}</span>
          ))}
          {(job.required_skills ?? []).length > 5 && (
            <span style={{ padding: '3px 9px', background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.12)', borderRadius: 20, fontSize: 11, color: '#9CA3AF' }}>
              +{job.required_skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {job.employment_type && (
          <span style={{ padding: '3px 9px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#3B82F6' }}>
            {EMPLOYMENT_TYPE_LABELS[job.employment_type as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? job.employment_type}
          </span>
        )}
        {outlook && (
          <span style={{ padding: '3px 9px', background: outlook.bg, borderRadius: 20, fontSize: 11, fontWeight: 600, color: outlook.color }}>
            <TrendingUp size={9} style={{ display: 'inline', marginRight: 3 }} />{job.growth_outlook} growth
          </span>
        )}
        {job.min_k_score > 0 && (
          <span style={{ padding: '3px 9px', background: 'rgba(30,58,95,0.05)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1E3A5F' }}>
            K-score ≥ {job.min_k_score}
          </span>
        )}
        {formatSalary(job.salary_min, job.salary_max) && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F', marginLeft: 'auto' }}>
            ₹{formatSalary(job.salary_min, job.salary_max)} LPA
          </span>
        )}
      </div>

      {/* Dates */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9CA3AF' }}>
        <span>Posted {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {job.expires_at && (
          <span style={{ fontWeight: 600, color: new Date(job.expires_at) < new Date() ? '#DC2626' : '#6B7280' }}>
            {new Date(job.expires_at) < new Date() ? '⚠ Expired' : `Closes ${new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </span>
        )}
      </div>

      {/* Actions — vary by lifecycle status */}
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(59,130,246,0.06)', paddingTop: 14, flexWrap: 'wrap' }}>
        {job.status === 'draft' && canPublish && (
          <button onClick={onPublish} disabled={isMutating} style={primaryActionStyle}>
            {isMutating ? <Spinner12 color="#fff" /> : <><Rocket size={13} />Publish</>}
          </button>
        )}
        {job.status === 'published' && canPublish && (
          <button onClick={onPause} disabled={isMutating} style={outlineActionStyle('#D97706')}>
            {isMutating ? <Spinner12 color="#D97706" /> : <><PauseCircle size={13} />Pause</>}
          </button>
        )}
        {job.status === 'paused' && canPublish && (
          <button onClick={onReopen} disabled={isMutating} style={outlineActionStyle('#059669')}>
            {isMutating ? <Spinner12 color="#059669" /> : <><PlayCircle size={13} />Resume</>}
          </button>
        )}
        {job.status === 'closed' && canPublish && (
          <button onClick={onReopen} disabled={isMutating} style={outlineActionStyle('#059669')}>
            {isMutating ? <Spinner12 color="#059669" /> : <><PlayCircle size={13} />Reopen</>}
          </button>
        )}
        {(job.status === 'published' || job.status === 'paused') && canPublish && (
          <button onClick={onClose} disabled={isMutating} style={outlineActionStyle('#DC2626')}>
            <XCircle size={13} />Close
          </button>
        )}
        {job.status !== 'archived' && canEdit && (
          <button onClick={onEdit} style={outlineActionStyle('#3B82F6')}>
            <Pencil size={12} />Edit
          </button>
        )}
        {canCreate && (
          <button onClick={onDuplicate} style={iconActionStyle('#3B82F6')} title="Duplicate job">
            <Copy size={13} />
          </button>
        )}
        {job.status !== 'archived' && canPublish && (
          <button onClick={onArchive} style={iconActionStyle('#6B7280')} title="Archive job">
            <Archive size={13} />
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} style={iconActionStyle('#DC2626')} title="Delete job">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {/* Applicant count summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 10,
        background: (job.applicant_count ?? 0) > 0 ? 'rgba(5,150,105,0.06)' : 'rgba(107,114,128,0.04)',
        border: `1px solid ${(job.applicant_count ?? 0) > 0 ? 'rgba(5,150,105,0.15)' : 'rgba(107,114,128,0.1)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Users size={13} color={(job.applicant_count ?? 0) > 0 ? '#059669' : '#9CA3AF'} />
          <span style={{ fontSize: 13, fontWeight: 700, color: (job.applicant_count ?? 0) > 0 ? '#059669' : '#9CA3AF' }}>
            {job.applicant_count ?? 0} applicant{(job.applicant_count ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <Link
          to={`/app/employer/pipeline/${job.id}`}
          style={{
            fontSize: 12, fontWeight: 700, color: '#059669',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          View Pipeline →
        </Link>
      </div>
    </div>
  )
}

function DashboardKpiSection() {
  const { data: kpis, isLoading } = useDashboardKpis()
  if (isLoading || !kpis) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiCard icon={Briefcase} label="Active Jobs" value={kpis.active_jobs} color="#3B82F6" />
        <KpiCard icon={Pencil} label="Draft Jobs" value={kpis.draft_jobs} color="#6B7280" />
        <KpiCard icon={XCircle} label="Closed Jobs" value={kpis.closed_jobs} color="#DC2626" />
        <KpiCard icon={Users} label="Applications Today" value={kpis.applications_today} color="#7C3AED" />
        <KpiCard icon={Activity} label="Total Applications" value={kpis.total_applications} color="#0EA5E9" />
        <KpiCard icon={CalendarClock} label="Interviews Scheduled" value={kpis.interviews_scheduled} color="#D97706" />
        <KpiCard icon={Send} label="Offers Sent" value={kpis.offers_sent} color="#059669" />
        <KpiCard icon={Award} label="Hires" value={kpis.hires} color="#1E3A5F" />
        <KpiCard icon={TrendingUp} label="Response Rate" value={`${kpis.response_rate_pct}%`} color="#3B82F6" />
        <KpiCard
          icon={Clock} label="Avg. Time to Hire" color="#D97706"
          value={kpis.avg_time_to_hire_days !== null ? `${kpis.avg_time_to_hire_days}d` : '—'}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <ApplicationTrendStrip />
        <UpcomingInterviewsWidget />
      </div>
    </div>
  )
}

function UpcomingInterviewsWidget() {
  const { data: interviews, isLoading } = useUpcomingInterviews(5)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.95)', borderRadius: 16, padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(30,58,95,0.05)',
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Video size={13} color="#3B82F6" />Upcoming Interviews
      </p>
      {isLoading ? (
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>Loading…</p>
      ) : !interviews || interviews.length === 0 ? (
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>No interviews scheduled.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {interviews.map(iv => (
            <div key={iv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {iv.candidate_name ?? 'Candidate'}
                </p>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '1px 0 0' }}>{iv.job_title}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', whiteSpace: 'nowrap' }}>
                {new Date(iv.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Setup wizard prompt ─────────────────────────────────────────────────────────
// Shown once per company until dismissed or the wizard's been completed —
// `company.industry` being null is the signal nobody's been through it yet.
function SetupWizardBanner() {
  const { data: company } = useCompanyProfile()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('setup_wizard_dismissed') === '1')

  if (!company || company.industry || dismissed) return null

  const dismiss = () => {
    sessionStorage.setItem('setup_wizard_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(59,130,246,0.06))',
      border: '1px solid rgba(124,58,237,0.18)',
      borderRadius: 20, padding: '16px 20px',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Sparkles size={18} color="#7C3AED" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F' }}>Complete your company profile</p>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
          Add your industry, logo, and a few more details to help candidates trust your listings — takes about 2 minutes.
        </p>
      </div>
      <Link to="/app/employer/setup" style={{
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: '8px 16px', borderRadius: 10,
        background: '#7C3AED', color: 'white', fontSize: 13, fontWeight: 700,
        textDecoration: 'none',
      }}>
        Complete setup <ArrowRight size={14} />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0, padding: 4 }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── Bulk job import modal ────────────────────────────────────────────────────

const BULK_IMPORT_TEMPLATE_CSV =
  'title,description,sector,required_skills,job_type,location,employment_type,expires_at,min_k_score,salary_min,salary_max,growth_outlook\n' +
  '"Policy Research Associate","Support senior analysts on policy research projects, drafting briefs and conducting data analysis.","Government & Civil Services","Policy Research;Data Analysis;Report Writing","hybrid","New Delhi","full_time","2026-12-31",40,8,14,medium\n'

function downloadBulkImportTemplate() {
  const blob = new Blob([BULK_IMPORT_TEMPLATE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'job_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const bulkImport = useBulkImportJobs()
  const [file, setFile] = useState<File | null>(null)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Bulk import jobs</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>
          Upload a CSV to create multiple job postings at once. All are saved as <strong>drafts</strong> —
          review and publish each one individually afterward.
        </p>

        <button
          onClick={downloadBulkImportTemplate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.06)', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 14 }}
        >
          <Download size={13} />Download CSV template
        </button>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          style={{ width: '100%', fontSize: 12, marginBottom: 14 }}
        />

        {bulkImport.isError && (
          <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{getApiError(bulkImport.error, 'Import failed. Please check your file and try again.')}</p>
        )}

        {bulkImport.data && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 6 }}>
              {bulkImport.data.created} job{bulkImport.data.created !== 1 ? 's' : ''} created as drafts.
            </p>
            {bulkImport.data.failed.length > 0 && (
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>{bulkImport.data.failed.length} row(s) failed:</p>
                {bulkImport.data.failed.map(f => (
                  <p key={f.row} style={{ fontSize: 11, color: '#991B1B', margin: '2px 0' }}>Row {f.row}: {f.error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>
            {bulkImport.data ? 'Done' : 'Cancel'}
          </button>
          {!bulkImport.data && (
            <button
              onClick={() => file && bulkImport.mutate(file)}
              disabled={!file || bulkImport.isPending}
              style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !file ? 0.5 : 1 }}
            >{bulkImport.isPending ? 'Importing…' : 'Import'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EmployerDashboardPage() {
  const { data, isLoading } = useEmployerDashboard()
  const createJob  = useCreateJob()
  const updateJob  = useUpdateJob()
  const deleteJob  = useDeleteJob()
  const publishJob = usePublishJob()
  const pauseJob   = usePauseJob()
  const closeJob   = useCloseJob()
  const reopenJob  = useReopenJob()
  const archiveJob = useArchiveJob()
  const duplicateJob = useDuplicateJob()
  const canCreateJob = useHasPermission('jobs:create')
  const logout     = useLogout()
  const [view, setView] = useState<View>('list')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const handleCreate = (payload: JobPostingPayload) => {
    createJob.mutate(payload, { onSuccess: () => setView('list') })
  }

  const runLifecycleAction = async (id: string, mutate: (id: string) => Promise<unknown>) => {
    setMutatingId(id)
    try { await mutate(id) }
    finally { setMutatingId(null) }
  }

  const handleUpdate = (id: string, payload: JobPostingPayload) => {
    updateJob.mutate({ id, data: payload }, { onSuccess: () => setView('list') })
  }

  const handleDelete = (id: string) => {
    deleteJob.mutate(id, { onSuccess: () => setConfirmDelete(null) })
  }


  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)', display: 'flex' }}>

      {/* ── Sidebar ── */}
      {data && (
        <Sidebar
          companyName={data.company_name}
          totalJobs={data.total_jobs}
          activeJobs={data.active_jobs}
          isApproved={data.is_approved}
          onNewJob={() => setView('new')}
          logout={() => logout.mutate()}
          view={view}
        />
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(59,130,246,0.08)',
          padding: '0 32px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 2px 16px rgba(30,58,95,0.04)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: '#1E3A5F' }}>
              {view === 'list' ? 'Job Postings' : view === 'new' ? 'New Job Posting' : 'Edit Job Posting'}
            </h1>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>
              {view === 'list'
                ? `${data?.active_jobs ?? 0} active · ${data?.total_jobs ?? 0} total`
                : 'Fill in the details below'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />
            {data?.is_approved && view === 'list' && canCreateJob && (
              <button onClick={() => setShowBulkImport(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 10,
                background: '#fff', border: '1px solid #E5E7EB',
                color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                <Upload size={14} />Bulk Import
              </button>
            )}
            {data?.is_approved && view === 'list' && canCreateJob && (
              <button onClick={() => setView('new')} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 11,
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59,130,246,0.3)', transition: 'all 0.2s',
              }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                <Plus size={15} />Post a Job
              </button>
            )}
            {view !== 'list' && (
              <button onClick={() => setView('list')} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                background: 'rgba(107,114,128,0.07)', border: '1px solid rgba(107,114,128,0.15)',
                color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                <X size={14} />Cancel
              </button>
            )}
          </div>
        </header>

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ── Verification banner — account access is instant, only posting is gated ── */}
              {!data.is_approved && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 20, padding: '18px 22px',
                  boxShadow: '0 2px 12px rgba(245,158,11,0.08)',
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={18} color="#D97706" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Verification required to post jobs</p>
                    <p style={{ fontSize: 13, color: '#B45309', marginTop: 3, lineHeight: 1.5 }}>
                      Complete your company profile and submit verification documents — you can browse and set
                      everything up now, you just can't publish a job listing until verification is approved.
                    </p>
                  </div>
                  <Link to="/app/employer/verification" style={{
                    flexShrink: 0, alignSelf: 'center', padding: '8px 16px', borderRadius: 10,
                    background: '#D97706', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Start verification
                  </Link>
                </div>
              )}

              <SetupWizardBanner />

              {/* ── Hero banner ── */}
              {view === 'list' && (
                <div style={{
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 60%, #E0F2FE 100%)',
                  borderRadius: 24, padding: '28px 32px', position: 'relative', overflow: 'hidden',
                  border: '1px solid rgba(59,130,246,0.15)',
                  boxShadow: '0 4px 24px rgba(59,130,246,0.08)',
                }}>
                  <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'rgba(59,130,246,0.06)', top: '-80px', right: '-60px' }} />
                  <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'rgba(99,102,241,0.04)', bottom: '-40px', left: '30%' }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 12 }}>
                      <Building2 size={12} color="#3B82F6" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6' }}>Employer Portal</span>
                    </div>
                    <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 26, fontWeight: 900, color: '#1E3A5F', letterSpacing: '-0.5px', marginBottom: 6 }}>
                      Welcome, {data.company_name} 👋
                    </h2>
                    <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                      Reach <strong style={{ color: '#1E3A5F' }}>UPSC-prepared talent</strong> with high career readiness scores
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total Jobs', value: data.total_jobs },
                        { label: 'Active', value: data.active_jobs },
                        { label: 'Paused', value: data.total_jobs - data.active_jobs },
                        { label: 'Total Applicants', value: data.jobs.reduce((sum, j) => sum + (j.applicant_count ?? 0), 0) },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '10px 16px', border: '1px solid rgba(59,130,246,0.1)', minWidth: 80 }}>
                          <div style={{ fontSize: 26, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── KPI grid + trend ── */}
              {view === 'list' && <DashboardKpiSection />}

              {/* ── Form views ── */}
              {view === 'new' && (
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 24, padding: 32, boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
                  <JobForm
                    onSubmit={handleCreate}
                    loading={createJob.isPending}
                    onCancel={() => setView('list')}
                  />
                  {createJob.error && (
                    <p style={{ fontSize: 13, color: '#DC2626', marginTop: 12 }}>
                      {getApiError(createJob.error, 'Could not save. Try again.')}
                    </p>
                  )}
                </div>
              )}

              {typeof view === 'object' && 'edit' in view && (
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 24, padding: 32, boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
                  <JobForm
                    initial={view.edit}
                    onSubmit={(payload) => handleUpdate(view.edit.id, payload)}
                    loading={updateJob.isPending}
                    onCancel={() => setView('list')}
                  />
                  {updateJob.error && (
                    <p style={{ fontSize: 13, color: '#DC2626', marginTop: 12 }}>
                      {getApiError(updateJob.error, 'Could not save. Try again.')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Job grid ── */}
              {view === 'list' && (
                <>
                  {data.jobs.length === 0 ? (
                    <div style={{
                      background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.95)', borderRadius: 24,
                      padding: '52px 24px', textAlign: 'center',
                      boxShadow: '0 4px 20px rgba(30,58,95,0.06)',
                    }}>
                      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>📋</div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>No job postings yet</p>
                      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>Post your first job to start reaching UPSC aspirants</p>
                      {data.is_approved && canCreateJob && (
                        <button onClick={() => setView('new')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '11px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                          color: '#fff', border: 'none', cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                        }}>
                          <Plus size={15} />Post your first job
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                      {data.jobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onEdit={() => setView({ edit: job })}
                          onDelete={() => setConfirmDelete(job.id)}
                          onPublish={() => runLifecycleAction(job.id, (id) => publishJob.mutateAsync(id))}
                          onPause={() => runLifecycleAction(job.id, (id) => pauseJob.mutateAsync(id))}
                          onClose={() => runLifecycleAction(job.id, (id) => closeJob.mutateAsync(id))}
                          onReopen={() => runLifecycleAction(job.id, (id) => reopenJob.mutateAsync(id))}
                          onArchive={() => runLifecycleAction(job.id, (id) => archiveJob.mutateAsync(id))}
                          onDuplicate={() => runLifecycleAction(job.id, (id) => duplicateJob.mutateAsync(id))}
                          isMutating={mutatingId === job.id}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} />}

      {/* ── Delete confirm modal ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 24px 60px rgba(30,58,95,0.2)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 16px', fontSize: 24 }}>🗑</div>
            <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: '#1E3A5F', marginBottom: 8 }}>Delete job posting?</h3>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>This action cannot be undone. The listing will be permanently removed.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid rgba(59,130,246,0.2)', fontSize: 14, fontWeight: 600, color: '#374151', background: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(107,114,128,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteJob.isPending}
                style={{ flex: 1, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #DC2626, #B91C1C)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: deleteJob.isPending ? 'not-allowed' : 'pointer', opacity: deleteJob.isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {deleteJob.isPending ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Deleting…</>
                ) : (
                  <><Trash2 size={14} />Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
