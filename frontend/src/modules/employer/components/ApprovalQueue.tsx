/**
 * Approval Queue — side panel showing draft jobs awaiting publish.
 * Employer managers can publish or discard directly from here.
 */
import { useState } from 'react'
import { X, CheckCircle2, Trash2, Briefcase, Clock, Building2, MapPin, AlertCircle } from 'lucide-react'
import { useEmployerDashboard, usePublishJob, useDeleteJob } from '../hooks/useJobs'
import type { JobPosting } from '@/api/jobs'

interface Props {
  onClose: () => void
}

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: 'rgba(245,158,11,0.08)', color: '#D97706', label: 'Draft' },
  paused:   { bg: 'rgba(100,116,139,0.08)', color: '#64748B', label: 'Paused' },
  pending:  { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', label: 'Pending' },
}

function QueueCard({ job, onPublish, onDelete, publishing, deleting }: {
  job: JobPosting
  onPublish: () => void
  onDelete: () => void
  publishing: boolean
  deleting: boolean
}) {
  const chip = STATUS_COLOR[job.status] ?? STATUS_COLOR.draft

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(30,58,95,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Briefcase size={15} color="#1E3A5F" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {job.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            {job.department_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94A3B8' }}>
                <Building2 size={9} />{job.department_name}
              </span>
            )}
            {job.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94A3B8' }}>
                <MapPin size={9} />{job.location}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} />{new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: chip.bg, color: chip.color, flexShrink: 0 }}>
          {chip.label}
        </span>
      </div>

      {job.description && (
        <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {job.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onPublish}
          disabled={publishing}
          style={{ flex: 1, height: 34, borderRadius: 9, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 700, cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <CheckCircle2 size={12} />{publishing ? 'Publishing…' : 'Publish now'}
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting ? 0.5 : 1 }}
        >
          <Trash2 size={12} color="#EF4444" />
        </button>
      </div>
    </div>
  )
}

export function ApprovalQueue({ onClose }: Props) {
  const { data: jobs } = useEmployerDashboard()
  const publishJob = usePublishJob()
  const deleteJob = useDeleteJob()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const queue = (jobs ?? []).filter(j => ['draft', 'paused', 'pending'].includes(j.status))

  const handlePublish = (id: string) => {
    setPublishingId(id)
    publishJob.mutate(id, { onSettled: () => setPublishingId(null) })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    deleteJob.mutate(id, { onSettled: () => { setDeletingId(null); setDeleteConfirm(null) } })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.3)' }} onClick={onClose} />

      {/* Drawer */}
      <div style={{ position: 'relative', width: 380, maxWidth: '100vw', height: '100%', background: 'linear-gradient(180deg, #F0F4FF 0%, #F8FAFC 100%)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: '#1E3A5F', margin: 0 }}>Approval Queue</h2>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                {queue.length} job{queue.length !== 1 ? 's' : ''} awaiting publish
              </p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(5,150,105,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle2 size={22} color="#059669" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F', margin: '0 0 4px' }}>All clear!</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No draft or paused jobs to review.</p>
            </div>
          ) : (
            queue.map(job => (
              <QueueCard
                key={job.id}
                job={job}
                onPublish={() => handlePublish(job.id)}
                onDelete={() => setDeleteConfirm(job.id)}
                publishing={publishingId === job.id}
                deleting={deletingId === job.id}
              />
            ))
          )}
        </div>

        {/* Tip */}
        {queue.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: 'rgba(255,255,255,0.7)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={13} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              Published jobs are immediately visible to UPSC candidates matching the job criteria.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 22, maxWidth: 320, width: '100%' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>Delete this job?</h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 36, borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={!!deletingId} style={{ flex: 1, height: 36, borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: deletingId ? 0.7 : 1 }}>
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
