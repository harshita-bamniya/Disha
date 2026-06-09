import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Clock,
  CheckCircle2, LogOut, LayoutDashboard, Building2,
  TrendingUp, PauseCircle, X, Users,
} from 'lucide-react'
import { useEmployerDashboard, useCreateJob, useUpdateJob, useToggleJob, useDeleteJob } from '../hooks/useJobs'
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  companyName, totalJobs, activeJobs, isApproved, onNewJob, logout, view,
}: {
  companyName: string; totalJobs: number; activeJobs: number
  isApproved: boolean; onNewJob: () => void; logout: () => void; view: View
}) {
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
            <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F' }}>DISHA AI</span>
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
            ].map(s => (
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
        {isApproved && view === 'list' && (
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
function JobCard({
  job, onEdit, onToggle, onDelete, isToggling,
}: {
  job: JobPosting
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  isToggling?: boolean
}) {
  const outlook = OUTLOOK_STYLE[job.growth_outlook ?? '']

  return (
    <div style={{
      background: job.is_active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(20px)',
      border: job.is_active ? '1px solid rgba(255,255,255,0.95)' : '1.5px dashed rgba(156,163,175,0.4)',
      borderRadius: 20, padding: '20px',
      boxShadow: '0 4px 20px rgba(30,58,95,0.06)',
      opacity: job.is_active ? 1 : 0.75,
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
          {job.is_active ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#059669' }}>
              <CheckCircle2 size={10} />Active
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.25)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>
              <PauseCircle size={10} />Paused
            </span>
          )}
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

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(59,130,246,0.06)', paddingTop: 14 }}>
        <button onClick={onToggle} disabled={isToggling} style={{
          flex: 1, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: 'transparent', border: '1.5px solid rgba(59,130,246,0.2)',
          color: '#3B82F6', transition: 'all 0.2s',
        }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(59,130,246,0.05)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          {isToggling ? (
            <div style={{ width: 12, height: 12, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : job.is_active ? (
            <><ToggleRight size={13} />Pause</>
          ) : (
            <><ToggleLeft size={13} />Activate</>
          )}
        </button>
        <button onClick={onEdit} style={{
          flex: 1, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)',
          color: '#3B82F6', transition: 'all 0.2s',
        }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
        >
          <Pencil size={12} />Edit
        </button>
        <button onClick={onDelete} style={{
          height: 36, width: 36, borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: '1px solid rgba(220,38,38,0.2)',
          color: '#DC2626', transition: 'all 0.2s', flexShrink: 0,
        }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(220,38,38,0.05)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {/* Phase 3: Candidate pipeline link */}
      <Link
        to={`/app/employer/pipeline/${job.id}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 34, borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)',
          color: '#059669', textDecoration: 'none', transition: 'all 0.2s',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'rgba(5,150,105,0.12)')}
        onMouseOut={e => (e.currentTarget.style.background = 'rgba(5,150,105,0.07)')}
      >
        <Users size={12} /> View Candidates
      </Link>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EmployerDashboardPage() {
  const { data, isLoading } = useEmployerDashboard()
  const createJob  = useCreateJob()
  const updateJob  = useUpdateJob()
  const toggleJob  = useToggleJob()
  const deleteJob  = useDeleteJob()
  const logout     = useLogout()
  const [view, setView] = useState<View>('list')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleCreate = (payload: JobPostingPayload) => {
    createJob.mutate(payload, { onSuccess: () => setView('list') })
  }

  const handleUpdate = (id: string, payload: JobPostingPayload) => {
    updateJob.mutate({ id, data: payload }, { onSuccess: () => setView('list') })
  }

  const handleDelete = (id: string) => {
    deleteJob.mutate(id, { onSuccess: () => setConfirmDelete(null) })
  }

  const handleToggle = async (id: string) => {
    setTogglingId(id)
    try { await toggleJob.mutateAsync(id) }
    finally { setTogglingId(null) }
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
          {data?.is_approved && view === 'list' && (
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
        </header>

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ── Pending banner ── */}
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
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Account pending approval</p>
                    <p style={{ fontSize: 13, color: '#B45309', marginTop: 3, lineHeight: 1.5 }}>
                      Our team is reviewing your registration. You'll be able to post jobs once approved (24–48 hrs).
                    </p>
                  </div>
                </div>
              )}

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
                    <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
                      {[
                        { label: 'Total Jobs', value: data.total_jobs },
                        { label: 'Active', value: data.active_jobs },
                        { label: 'Paused', value: data.total_jobs - data.active_jobs },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '10px 16px', border: '1px solid rgba(59,130,246,0.1)' }}>
                          <div style={{ fontSize: 26, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                      {data.is_approved && (
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
                          onToggle={() => handleToggle(job.id)}
                          onDelete={() => setConfirmDelete(job.id)}
                          isToggling={togglingId === job.id}
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
