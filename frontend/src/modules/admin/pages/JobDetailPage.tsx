import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Briefcase, Users, AlertTriangle, ToggleLeft, ToggleRight, Trash2, ChevronRight,
} from 'lucide-react'
import { useAdminJobDetail, useJobApplications, useToggleAdminJob, useDeleteAdminJob } from '../hooks/useAdmin'
import {
  Spinner, Empty, Badge, SectionHeading, DetailRow, Breadcrumb, TabBar, type TabDef, STATUS_COLOR_MAP,
} from '../shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'


const TABS: TabDef[] = [
  { key: 'info',        label: 'Information' },
  { key: 'applicants',  label: 'Applicants' },
  { key: 'reports',     label: 'Reports' },
  { key: 'moderation',  label: 'Moderation' },
]

const cardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }
const tableCardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' as const }

// ── Tab: Information ───────────────────────────────────────────────────────────

function InfoTab({ job }: { job: any }) {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <SectionHeading>Job Details</SectionHeading>
        <DetailRow label="Title"            value={job.title} />
        <DetailRow label="Sector"           value={job.sector} />
        <DetailRow label="Location"         value={job.location} />
        <DetailRow label="Employment Type"  value={job.employment_type?.replace(/_/g, ' ')} />
        <DetailRow label="Job Type"         value={job.job_type?.replace(/_/g, ' ')} />
        <DetailRow label="Min K-Score"      value={job.min_k_score > 0 ? job.min_k_score : null} />
        <DetailRow label="Growth Outlook"   value={job.growth_outlook} />
        {(job.salary_min || job.salary_max) && (
          <DetailRow label="Salary (LPA)"
            value={[job.salary_min, job.salary_max].filter(Boolean).join(' – ')}
          />
        )}
        <DetailRow label="Status"           value={<Badge color={job.is_active ? 'green' : 'gray'}>{job.status}</Badge>} />
        <DetailRow label="Posted"           value={new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
        {job.expires_at && (
          <DetailRow label="Expires"        value={new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
        )}

        {job.required_skills?.length > 0 && (
          <>
            <SectionHeading>Required Skills</SectionHeading>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {job.required_skills.map((s: string) => (
                <span key={s} className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: colors.surface.elevated, color: colors.text.ink }}>{s}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div style={cardStyle}>
          <SectionHeading>Employer</SectionHeading>
          <button
            onClick={() => navigate(`/admin/employers/${job.employer_id}`)}
            className="flex items-center gap-2 mt-2 text-sm font-semibold hover:underline"
            style={{ color: colors.brand.navy }}
          >
            {job.company_name} <ChevronRight size={14} />
          </button>
          {job.department_name && (
            <>
              <SectionHeading>Department</SectionHeading>
              <p className="text-sm font-medium mt-1" style={{ color: '#475569' }}>{job.department_name}</p>
            </>
          )}
        </div>

        {job.description && (
          <div style={cardStyle}>
            <SectionHeading>Description</SectionHeading>
            <p className="text-xs leading-relaxed mt-1 whitespace-pre-line line-clamp-12" style={{ color: '#475569' }}>{job.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Applicants ────────────────────────────────────────────────────────────

function ApplicantsTab({ jobId }: { jobId: string }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useJobApplications(jobId, { status: statusFilter || undefined })

  const STATUS_OPTS = ['applied', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn']

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {['', ...STATUS_OPTS].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="h-8 px-3 text-xs font-semibold transition-all"
            style={{
              borderRadius: 10,
              background: statusFilter === s ? colors.brand.navy : '#fff',
              color: statusFilter === s ? '#fff' : colors.text.ink,
              border: statusFilter === s ? 'none' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.length ? (
          <Empty icon={Users} text="No applicants yet" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 480 }}>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {['Candidate', 'Score', 'Status', 'Applied'].map((h, i) => (
                  <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>{h}</span>
                ))}
              </div>
              {data.map((app, idx) => (
                <button
                  key={app.id}
                  onClick={() => navigate(`/admin/candidates/${app.aspirant_id}`)}
                  className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
                  style={{
                    background: idx % 2 === 0 ? '#fff' : colors.surface.bg,
                    borderBottom: idx < data.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
                  onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : colors.surface.bg)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>{app.aspirant_name ?? app.aspirant_phone}</p>
                    <p className="text-xs" style={{ color: colors.text.muted }}>{app.aspirant_phone}</p>
                  </div>
                  <span className="text-xs font-bold text-right" style={{ color: colors.text.ink }}>{app.match_score ?? '—'}</span>
                  <span className="text-right">
                    <Badge color={STATUS_COLOR_MAP[app.status] ?? 'gray'}>{app.status.replace(/_/g, ' ')}</Badge>
                  </span>
                  <span className="text-xs text-right whitespace-nowrap" style={{ color: colors.text.muted }}>
                    {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Reports ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  applied: '#6b7280', under_review: '#2563eb', shortlisted: '#7c3aed',
  rejected: '#dc2626', hired: '#16a34a', withdrawn: '#9ca3af',
}

function ReportsTab({ jobId, job }: { jobId: string; job: any }) {
  const { data: apps, isLoading } = useJobApplications(jobId)

  if (isLoading) return <Spinner />
  if (!apps?.length) return <Empty icon={Users} text="No applications yet — nothing to report" />

  const funnelMap: Record<string, number> = {}
  apps.forEach(a => { funnelMap[a.status] = (funnelMap[a.status] ?? 0) + 1 })
  const funnel = ['applied', 'under_review', 'shortlisted', 'hired', 'rejected', 'withdrawn']
    .map(s => ({ status: s, count: funnelMap[s] ?? 0 }))
    .filter(f => f.count > 0)

  const maxCount = Math.max(1, ...funnel.map(f => f.count))
  const hired    = funnelMap['hired'] ?? 0
  const reviewed = funnelMap['under_review'] ?? 0
  const hireRate = apps.length > 0 ? ((hired / apps.length) * 100).toFixed(1) : '0'

  const weekMap: Record<string, number> = {}
  apps.forEach(a => {
    const d  = new Date(a.applied_at)
    const wk = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`
    weekMap[wk] = (weekMap[wk] ?? 0) + 1
  })
  const weeks    = Object.keys(weekMap).sort()
  const maxWeek  = Math.max(1, ...Object.values(weekMap))

  const scores = apps.map(a => a.match_score).filter((s): s is number => s !== null && s !== undefined)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Applicants', value: apps.length },
          { label: 'Under Review',     value: reviewed },
          { label: 'Hired',            value: hired },
          { label: 'Hire Rate',        value: `${hireRate}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: colors.text.ink }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Application funnel */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, whiteSpace: 'nowrap' }}>Application Funnel</span>
          <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
        </div>
        <div className="flex flex-col gap-3">
          {funnel.map(stage => (
            <div key={stage.status} className="flex items-center gap-3">
              <p className="text-xs w-28 shrink-0 capitalize" style={{ color: '#475569' }}>{stage.status.replace(/_/g, ' ')}</p>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: colors.surface.elevated }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(stage.count / maxCount) * 100}%`, background: STATUS_COLORS[stage.status] ?? '#6b7280' }}
                />
              </div>
              <p className="text-xs font-bold w-8 text-right tabular-nums" style={{ color: colors.text.ink }}>{stage.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly trend */}
      {weeks.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, whiteSpace: 'nowrap' }}>Applications by Week</span>
            <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
          </div>
          <div className="flex items-end gap-2 h-20">
            {weeks.map(wk => (
              <div key={wk} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  title={`${wk}: ${weekMap[wk]}`}
                  style={{ height: `${(weekMap[wk] / maxWeek) * 100}%`, minHeight: 3, width: '100%', background: colors.brand.navy, borderRadius: 2, opacity: 0.75, transition: 'opacity 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                  onMouseOut={e => (e.currentTarget.style.opacity = '0.75')}
                />
                <span className="text-[9px]" style={{ color: colors.text.muted }}>{wk.slice(-2)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-2" style={{ color: colors.text.muted }}>Week number within month</p>
        </div>
      )}

      {/* Avg match score */}
      {avgScore && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, whiteSpace: 'nowrap' }}>Average KRS Match Score</span>
            <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
          </div>
          <p style={{ fontSize: 36, fontWeight: 800, color: colors.text.ink }}>{avgScore}</p>
          <p className="text-xs mt-1" style={{ color: colors.text.muted }}>across {scores.length} scored applicant{scores.length !== 1 ? 's' : ''}</p>
          <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: colors.surface.elevated }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, parseFloat(avgScore))}%`, background: colors.brand.navy }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Moderation ────────────────────────────────────────────────────────────

function ModerationTab({ job }: { job: any }) {
  const navigate = useNavigate()
  const toggle = useToggleAdminJob()
  const deleteJob = useDeleteAdminJob()
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 className="text-sm font-bold mb-1" style={{ color: colors.text.ink }}>Job Visibility</h3>
          <p className="text-xs mb-3" style={{ color: colors.text.muted }}>
            Inactive jobs are hidden from candidates and not counted toward the employer's active job limit.
          </p>
          <button
            onClick={() => toggle.mutate(job.id)}
            disabled={toggle.isPending}
            className="flex items-center gap-2 h-9 px-4 text-xs font-semibold transition-colors disabled:opacity-40"
            style={{
              borderRadius: 10,
              background: job.is_active ? '#FFFBEB' : '#F0FDF4',
              border: job.is_active ? '1px solid #FDE68A' : '1px solid #BBF7D0',
              color: job.is_active ? '#B45309' : '#15803D',
            }}
          >
            {job.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
            {toggle.isPending ? 'Updating…' : job.is_active ? 'Deactivate Job' : 'Activate Job'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
          <h3 className="text-sm font-bold mb-1 text-red-600">Danger Zone</h3>
          <p className="text-xs mb-3" style={{ color: colors.text.muted }}>
            Deleting a job is permanent and will also remove all associated applications.
          </p>
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 h-9 px-4 text-xs font-semibold transition-colors"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10 }}
          >
            <Trash2 size={13} /> Delete Job
          </button>
        </div>
      </div>

      <div className="flex gap-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: 16 }}>
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-1">Reporting not yet available</p>
          <p className="text-xs text-amber-700">
            Job flagging, suspicious content reports, and moderation history will be available in the support module.
          </p>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 24, maxWidth: 384, width: '100%' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: colors.text.ink }}>Delete "{job.title}"?</h3>
            <p className="text-sm mb-5" style={{ color: colors.text.muted }}>
              This will permanently delete the job and all {job.applicant_count} application{job.applicant_count !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 h-10 text-sm font-medium" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: colors.text.ink }}>
                Cancel
              </button>
              <button
                onClick={() => deleteJob.mutate(job.id, { onSuccess: () => { setShowDelete(false); navigate('/admin/jobs') } })}
                disabled={deleteJob.isPending}
                className="flex-1 h-10 text-sm font-semibold disabled:opacity-40"
                style={{ background: '#EF4444', color: '#fff', borderRadius: 10, border: 'none' }}
              >
                {deleteJob.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'info'
  const setTab = (t: string) => setSearchParams({ tab: t }, { replace: true })

  const { data: job, isLoading } = useAdminJobDetail(id ?? null)

  if (isLoading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  if (!job) return <Empty icon={Briefcase} text="Job not found" />

  const tabs: TabDef[] = TABS.map(t => ({
    ...t,
    count: t.key === 'applicants' ? job.applicant_count : undefined,
  }))

  return (
    <section className="flex flex-col gap-0">
      <Breadcrumb items={[{ label: 'Jobs', href: '/admin/jobs' }, { label: job.title }]} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Briefcase className="w-5 h-5" style={{ color: colors.text.ink }} />
        </div>
        <div className="min-w-0">
          <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>{job.title}</h1>
          <p className="text-xs" style={{ color: colors.text.muted }}>{job.company_name} · {job.sector}</p>
        </div>
        <div className="ml-auto">
          <Badge color={job.is_active ? 'green' : 'gray'}>{job.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Applicants',  value: job.applicant_count },
          { label: 'Min K-Score', value: job.min_k_score || '—' },
          { label: 'Status',      value: job.status },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 6 }}>{label}</p>
            <p className="capitalize" style={{ fontSize: 22, fontWeight: 800, color: colors.text.ink }}>{value}</p>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 'info'       && <InfoTab job={job} />}
      {activeTab === 'applicants' && <ApplicantsTab jobId={job.id} />}
      {activeTab === 'reports'    && <ReportsTab jobId={job.id} job={job} />}
      {activeTab === 'moderation' && <ModerationTab job={job} />}
    </section>
  )
}
