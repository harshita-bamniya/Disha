import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Briefcase, Search, ChevronRight } from 'lucide-react'
import { useEmployerDashboard, useDepartments } from '../hooks/useJobs'
import type { JobPosting } from '@/api/jobs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import { DS, C } from '../ds'
import { formatDate as fmtDate } from '@/shared/utils/format'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import StatusChip from '../components/StatusChip'
import ErrorState from '@/shared/components/feedback/ErrorState'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer' }

// ── Job row — read-only. Creating/editing/publishing a job happens inside
// that job's own department workspace now, not here; this page exists so a
// company-wide viewer can see everything at a glance across departments. ──
// Candidates is 104px: its uppercase, letter-spaced header is ~90px wide and used to spill into Salary
const COLS = '1fr 96px 120px 104px 96px 88px 100px'

function JobRow({ job }: { job: JobPosting }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: hovered ? colors.surface.elevated : colors.surface.card, transition: 'background 0.1s', opacity: job.status === 'archived' ? 0.6 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Title */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
        <p style={{ fontSize: 11, color: C.ink3, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[job.sector, job.location, job.employment_type ? (EMPLOYMENT_TYPE_LABELS[job.employment_type as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? job.employment_type) : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Status */}
      <StatusChip status={job.status} />

      {/* Department */}
      <span style={{ fontSize: 12, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {job.department_name ?? '—'}
      </span>

      {/* Applicants */}
      <Link to={`/app/employer/pipeline/${job.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: (job.applicant_count ?? 0) > 0 ? C.accent : C.ink3, textDecoration: 'none' }}>
        <Users size={12} />
        {job.applicant_count ?? 0}
      </Link>

      {/* Salary */}
      <span style={{ fontSize: 12, color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
        {formatSalary(job.salary_min, job.salary_max) ? `₹${formatSalary(job.salary_min, job.salary_max)}` : '—'}
      </span>

      {/* Posted */}
      <span style={{ fontSize: 12, color: C.ink3 }}>{fmtDate(job.created_at)}</span>

      {/* Manage — hands off to the owning department's workspace, the only
          place this job can actually be edited/published/closed etc. */}
      {job.department_id ? (
        <button
          onClick={() => navigate(`/app/employer/departments/${job.department_id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Manage <ChevronRight size={12} />
        </button>
      ) : (
        <span style={{ fontSize: 11, color: C.ink3 }}>—</span>
      )}
    </div>
  )
}

// ── Filter tabs ────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: 'all',       label: 'All'      },
  { value: 'published', label: 'Active'   },
  { value: 'draft',     label: 'Draft'    },
  { value: 'paused',    label: 'Paused'   },
  { value: 'closed',    label: 'Closed'   },
  { value: 'archived',  label: 'Archived' },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EmployerJobsPage() {
  const { data, isLoading, isError, refetch } = useEmployerDashboard()
  const { data: departments } = useDepartments()

  const [statusFilter, setStatusFilter] = useState('all')
  const [deptFilter, setDeptFilter]   = useState('all')
  const [search, setSearch]           = useState('')

  const jobs: JobPosting[] = data?.jobs ?? []
  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (deptFilter !== 'all' && j.department_id !== deptFilter) return false
    if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Jobs Overview"
        subtitle="Monitor job openings across every department — manage a job from its own department's workspace"
      />

      {/* Toolbar */}
      <div style={{ ...DS.toolbar, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.ink3, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            style={{ ...inputStyle, width: 200, paddingLeft: 30 }}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 7, padding: 3, overflowX: 'auto' }}>
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)} style={{
              padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 12, fontWeight: 500,
              background: statusFilter === t.value ? '#fff' : 'transparent',
              color: statusFilter === t.value ? C.ink1 : C.ink2,
              cursor: 'pointer',
              boxShadow: statusFilter === t.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Dept filter */}
        {departments && departments.length > 0 && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={selectStyle}>
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ padding: '16px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={DS.card}>
          {/* Narrower than ~820px, this table scrolls horizontally rather than
              squishing columns or overflowing the card — standard pattern for
              tabular data that doesn't reflow into a single column sensibly. */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 820 }}>
              {/* Header */}
              <div style={{ ...DS.tHead, gridTemplateColumns: COLS }}>
                {['Job', 'Status', 'Department', 'Candidates', 'Salary', 'Posted', ''].map(h => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              {isLoading ? (
                <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.ink3 }}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading…
                </div>
              ) : isError ? (
                <ErrorState title="Failed to load jobs" onRetry={refetch} compact />
              ) : filtered.length === 0 ? (
                <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Briefcase size={28} color={C.ink3} strokeWidth={1.5} />
                  <p style={{ fontSize: 13, color: C.ink2, margin: 0, fontWeight: 500 }}>No jobs found</p>
                  <p style={{ fontSize: 12, color: C.ink3, margin: 0, textAlign: 'center', maxWidth: 320 }}>
                    Jobs are created from within a department's own workspace.{' '}
                    <Link to="/app/employer/departments" style={{ color: C.accent, fontWeight: 600 }}>Open a department</Link> to post one.
                  </p>
                </div>
              ) : (
                filtered.map(job => <JobRow key={job.id} job={job} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
