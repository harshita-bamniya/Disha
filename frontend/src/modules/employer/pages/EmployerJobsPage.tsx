import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, X, Users, Briefcase,
  Rocket, PauseCircle, PlayCircle, XCircle, Archive, Copy,
  FileSignature, Upload, Download, ChevronRight, Search, ClipboardList,
} from 'lucide-react'
import {
  useEmployerDashboard, useCreateJob, useUpdateJob, useDeleteJob,
  usePublishJob, usePauseJob, useCloseJob, useReopenJob, useArchiveJob, useDuplicateJob,
  useHasPermission, useBulkImportJobs, useDepartments, useEmployerPermissions,
} from '../hooks/useJobs'
import JobForm from '../components/JobForm'
import { CommandBar } from '../components/CommandBar'
import { ApprovalQueue } from '../components/ApprovalQueue'
import type { JobPosting, JobPostingPayload } from '@/api/jobs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import { getApiError } from '@/api/client'
import NotificationBell from '@/components/NotificationBell'
import { DS, C, statusDot, fmtDate } from '../ds'
import Button from '@/components/ui/Button'

type View = 'list' | 'new' | { edit: JobPosting }

// ── Status dot + label ─────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const s = statusDot(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Bulk import ────────────────────────────────────────────────────────────────
const BULK_CSV =
  'title,description,sector,required_skills,job_type,location,employment_type,expires_at,min_k_score,salary_min,salary_max,growth_outlook\n' +
  '"Policy Research Associate","Support senior analysts on policy research.","Government & Civil Services","Policy Research;Data Analysis","hybrid","New Delhi","full_time","2026-12-31",40,8,14,medium\n'

function downloadTemplate() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([BULK_CSV], { type: 'text/csv' }))
  a.download = 'job_import_template.csv'; a.click()
}

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const bulk = useBulkImportJobs()
  const [file, setFile] = useState<File | null>(null)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 460, width: '100%', border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.ink1, margin: 0 }}>Bulk import jobs</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={16} /></Button>
        </div>
        <p style={{ fontSize: 13, color: C.ink2, marginBottom: 14, lineHeight: 1.5 }}>
          Upload a CSV to create multiple job postings at once. All saved as <strong>drafts</strong>.
        </p>
        <Button variant="ghost" size="sm" onClick={downloadTemplate} style={{ marginBottom: 14, color: C.accent, background: C.accentBg }}>
          <Download size={13} />Download template
        </Button>
        <input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ width: '100%', fontSize: 12, marginBottom: 14 }} />
        {bulk.isError && <p style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{getApiError(bulk.error, 'Import failed.')}</p>}
        {bulk.data && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{bulk.data.created} job{bulk.data.created !== 1 ? 's' : ''} created as drafts.</p>
            {bulk.data.failed.length > 0 && (
              <div style={{ background: C.redBg, borderRadius: 6, padding: 10, marginTop: 8 }}>
                {bulk.data.failed.map(f => <p key={f.row} style={{ fontSize: 11, color: C.red, margin: '2px 0' }}>Row {f.row}: {f.error}</p>)}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={onClose} fullWidth>{bulk.data ? 'Done' : 'Cancel'}</Button>
          {!bulk.data && (
            <Button variant="primary" size="sm" onClick={() => file && bulk.mutate(file)}
              disabled={!file || bulk.isPending} loading={bulk.isPending} fullWidth>
              {bulk.isPending ? 'Importing…' : 'Import'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Job row ────────────────────────────────────────────────────────────────────
const COLS = '1fr 96px 120px 68px 96px 88px 148px'

function JobRow({
  job, onEdit, onDelete, onPublish, onPause, onClose, onReopen, onArchive, onDuplicate, isMutating,
}: {
  job: JobPosting; onEdit: () => void; onDelete: () => void; onPublish: () => void
  onPause: () => void; onClose: () => void; onReopen: () => void
  onArchive: () => void; onDuplicate: () => void; isMutating?: boolean
}) {
  const canEdit    = useHasPermission('jobs:edit')
  const canPublish = useHasPermission('jobs:publish')
  const canCreate  = useHasPermission('jobs:create')
  const canDelete  = useHasPermission('jobs:delete')
  const [hovered, setHovered] = useState(false)

  const spin: React.CSSProperties = { animation: 'spin 0.7s linear infinite', borderRadius: '50%', width: 10, height: 10, border: `2px solid ${C.ink3}`, borderTopColor: 'transparent', display: 'inline-block' }

  const primaryBtn = (label: string, fn: () => void, color = C.accent) => (
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
      style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: hovered ? '#FAFAFA' : '#fff', transition: 'background 0.1s', opacity: job.status === 'archived' ? 0.6 : 1 }}
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
        {formatSalary(job.salary_min, job.salary_max) ? `₹${formatSalary(job.salary_min, job.salary_max)} LPA` : '—'}
      </span>

      {/* Posted */}
      <span style={{ fontSize: 12, color: C.ink3 }}>{fmtDate(job.created_at)}</span>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {job.status === 'draft'     && canPublish && primaryBtn('Publish', onPublish, C.green)}
        {job.status === 'published' && canPublish && primaryBtn('Pause',   onPause,   C.amber)}
        {job.status === 'paused'    && canPublish && primaryBtn('Resume',  onReopen,  C.green)}
        {job.status === 'closed'    && canPublish && primaryBtn('Reopen',  onReopen,  C.accent)}
        {(job.status === 'published' || job.status === 'paused') && canPublish && iconBtn(<XCircle size={12} />, onClose, 'Close', true)}
        {canEdit    && iconBtn(<Pencil size={12} />,  onEdit,    'Edit')}
        {canCreate  && iconBtn(<Copy size={12} />,    onDuplicate, 'Duplicate')}
        <Link to={`/app/employer/jobs/${job.id}/form-builder`} title="Application Form Builder" style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
          <ClipboardList size={12} />
        </Link>
        {canDelete  && iconBtn(<Trash2 size={12} />,  onDelete,  'Delete', true)}
      </div>
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
  const { data, isLoading } = useEmployerDashboard()
  const createJob   = useCreateJob()
  const updateJob   = useUpdateJob()
  const deleteJob   = useDeleteJob()
  const publishJob  = usePublishJob()
  const pauseJob    = usePauseJob()
  const closeJob    = useCloseJob()
  const reopenJob   = useReopenJob()
  const archiveJob  = useArchiveJob()
  const duplicateJob = useDuplicateJob()
  const canCreateJob = useHasPermission('jobs:create')
  const { data: myPerms } = useEmployerPermissions()
  const { data: departments } = useDepartments()

  const [view, setView]               = useState<View>('list')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showApprovalQueue, setShowApprovalQueue] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [mutatingId, setMutatingId]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [deptFilter, setDeptFilter]   = useState('all')
  const [search, setSearch]           = useState('')

  const handleCreate = (payload: JobPostingPayload) =>
    createJob.mutate(payload, { onSuccess: () => setView('list') })

  const handleUpdate = (id: string, payload: JobPostingPayload) =>
    updateJob.mutate({ id, data: payload }, { onSuccess: () => setView('list') })

  const handleDelete = (id: string) =>
    deleteJob.mutate(id, { onSuccess: () => setConfirmDelete(null) })

  const run = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setMutatingId(id); try { await fn(id) } finally { setMutatingId(null) }
  }

  const jobs: JobPosting[] = data?.jobs ?? []
  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (deptFilter !== 'all' && j.department_id !== deptFilter) return false
    if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (view === 'new') return (
    <div style={DS.pageWrap}>
      <header style={DS.topbar}>
        <div><h1 style={DS.pageTitle}>New Job Posting</h1></div>
        <Button variant="outline" size="sm" onClick={() => setView('list')}><X size={14} />Cancel</Button>
      </header>
      <div style={{ ...DS.content, padding: '24px' }}>
        <JobForm onSubmit={handleCreate} isLoading={createJob.isPending} error={createJob.isError ? getApiError(createJob.error) : undefined} />
      </div>
    </div>
  )

  if (typeof view === 'object' && 'edit' in view) return (
    <div style={DS.pageWrap}>
      <header style={DS.topbar}>
        <div><h1 style={DS.pageTitle}>Edit: {view.edit.title}</h1></div>
        <Button variant="outline" size="sm" onClick={() => setView('list')}><X size={14} />Cancel</Button>
      </header>
      <div style={{ ...DS.content, padding: '24px' }}>
        <JobForm job={view.edit} onSubmit={p => handleUpdate(view.edit.id, p)} isLoading={updateJob.isPending} error={updateJob.isError ? getApiError(updateJob.error) : undefined} />
      </div>
    </div>
  )

  return (
    <div style={DS.pageWrap}>

      {/* Top bar */}
      <header style={DS.topbar}>
        <div>
          <h1 style={DS.pageTitle}>Jobs</h1>
          <p style={DS.pageSub}>{data?.active_jobs ?? 0} active · {data?.total_jobs ?? 0} total</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CommandBar onPostJob={() => setView('new')} />
          <Button variant="outline" size="sm" onClick={() => setShowApprovalQueue(true)}>
            <FileSignature size={13} />Approvals
          </Button>
          <NotificationBell />
          {data?.is_approved && canCreateJob && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
                <Upload size={13} />Import
              </Button>
              <Button variant="primary" size="sm" onClick={() => setView('new')}>
                <Plus size={13} strokeWidth={2.5} />Post a Job
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Dept scope notice */}
      {myPerms && !myPerms.is_company_wide && myPerms.department_name && (
        <div style={{ padding: '8px 24px', background: C.accentBg, borderBottom: `1px solid #C7D2FE`, fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Briefcase size={12} />
          Scoped to <strong>{myPerms.department_name}</strong>
        </div>
      )}

      {/* Toolbar */}
      <div style={DS.toolbar}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.ink3, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            style={{ ...DS.input, width: 200, paddingLeft: 30 }}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 7, padding: 3 }}>
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
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={DS.select}>
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ ...DS.content, padding: '16px 24px' }}>
        <div style={DS.card}>
          {/* Header */}
          <div style={{ ...DS.tHead, gridTemplateColumns: COLS }}>
            {['Job', 'Status', 'Department', 'Candidates', 'Salary', 'Posted', 'Actions'].map(h => (
              <span key={h}>{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.ink3 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Briefcase size={28} color={C.ink3} strokeWidth={1.5} />
              <p style={{ fontSize: 13, color: C.ink2, margin: 0, fontWeight: 500 }}>No jobs found</p>
              <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>
                {data?.is_approved ? 'Post your first job to start receiving applications.' : 'Complete verification to start posting jobs.'}
              </p>
              {data?.is_approved && canCreateJob && (
                <Button variant="primary" size="sm" onClick={() => setView('new')} style={{ marginTop: 8 }}><Plus size={13} />Post a Job</Button>
              )}
            </div>
          ) : (
            filtered.map(job => (
              <JobRow
                key={job.id}
                job={job}
                onEdit={() => setView({ edit: job })}
                onDelete={() => setConfirmDelete(job.id)}
                onPublish={() => run(job.id, id => publishJob.mutateAsync(id))}
                onPause={() => run(job.id, id => pauseJob.mutateAsync(id))}
                onClose={() => run(job.id, id => closeJob.mutateAsync(id))}
                onReopen={() => run(job.id, id => reopenJob.mutateAsync(id))}
                onArchive={() => run(job.id, id => archiveJob.mutateAsync(id))}
                onDuplicate={() => run(job.id, id => duplicateJob.mutateAsync(id))}
                isMutating={mutatingId === job.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} />}
      {showApprovalQueue && <ApprovalQueue onClose={() => setShowApprovalQueue(false)} />}

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 380, width: '100%', border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.ink1, margin: '0 0 8px' }}>Delete job posting?</h3>
            <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 20px' }}>This cannot be undone. All applicants for this job will lose access.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} fullWidth>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(confirmDelete)}
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
