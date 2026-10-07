import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2, Plus, Pencil, Trash2, X, Users, Briefcase,
  UserCheck, FileText, ChevronRight,
} from 'lucide-react'
import {
  useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  useTeamMembers, useHasPermission,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { DepartmentEntry } from '@/api/company'
import Button from '@/shared/components/primitives/Button'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'

const CARD_MIN_HEIGHT = 212

// ── Department card ───────────────────────────────────────────────────────────

function DepartmentCard({
  dept, canManage, onEdit, onDelete,
}: {
  dept: DepartmentEntry
  canManage: boolean
  onEdit: (d: DepartmentEntry) => void
  onDelete: (d: DepartmentEntry) => void
}) {
  const navigate = useNavigate()
  const stats = [
    { label: 'Members',     value: dept.member_count,          icon: Users },
    { label: 'Active jobs', value: dept.active_job_count,       icon: Briefcase },
    { label: 'Total jobs',  value: dept.total_job_count,        icon: FileText },
    { label: 'Applicants',  value: dept.total_applicant_count,  icon: UserCheck },
  ]
  return (
    <div
      onClick={() => navigate(`/app/employer/departments/${dept.id}`)}
      style={{
        background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 16,
        boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
        display: 'flex', flexDirection: 'column', minHeight: CARD_MIN_HEIGHT,
        cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.15s',
        overflow: 'hidden',
      }}
      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(16,24,40,0.09)'; e.currentTarget.style.borderColor = colors.border.medium; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(16,24,40,0.04)'; e.currentTarget.style.borderColor = colors.border.default; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ padding: '18px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, rgba(30,58,95,0.08), rgba(59,130,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={17} color="#1E3A5F" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.name}</p>
              <p style={{ fontSize: 11, color: colors.text.muted, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={10} /> {dept.head_name ?? 'No head assigned'}
              </p>
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={e => { e.stopPropagation(); onEdit(dept) }} aria-label={`Edit ${dept.name}`} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pencil size={12} color={colors.text.inkSoft} />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(dept) }} aria-label={`Delete ${dept.name}`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={12} color="#EF4444" />
              </button>
            </div>
          )}
        </div>

        <p style={{
          fontSize: 12, color: colors.text.inkSoft, margin: 0, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: dept.description ? undefined : 0,
        }}>
          {dept.description || ' '}
        </p>
      </div>

      {/* Stat grid — replaces the old multi-colour badge row with a clean,
          monochrome grid that matches the dashboard's own stat tiles. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${colors.border.default}`, background: colors.surface.bg }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{
            padding: '10px 6px', textAlign: 'center',
            borderRight: i < stats.length - 1 ? `1px solid ${colors.border.default}` : 'none',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
            <p style={{ fontSize: 9.5, color: colors.text.muted, margin: '2px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '9px 20px', fontSize: 11.5, color: colors.state.info, fontWeight: 700,
        borderTop: `1px solid ${colors.border.default}`,
      }}>
        Open workspace <ChevronRight size={12} />
      </div>
    </div>
  )
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function DeptModal({
  editing, teamMembers, onClose,
}: {
  editing: DepartmentEntry | null
  teamMembers: { employer_profile_id: string; contact_person: string }[]
  onClose: () => void
}) {
  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const [name, setName]               = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [headId, setHeadId]           = useState(editing?.head_employer_id ?? '')
  const [err, setErr]                 = useState('')

  const busy = create.isPending || update.isPending

  const handleSave = () => {
    if (!name.trim()) { setErr('Department name is required'); return }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      head_employer_id: headId || undefined,
    }
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: onClose, onError: e => setErr(getApiError(e)) })
    } else {
      create.mutate(payload, { onSuccess: onClose, onError: e => setErr(getApiError(e)) })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>
            {editing ? 'Edit department' : 'New department'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>
              Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErr('') }}
              placeholder="e.g. Engineering, Policy Research, HR"
              style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>
              Description <span style={{ color: colors.text.muted, fontWeight: 500 }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this department focus on?"
              rows={3}
              style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>
                Department Head <span style={{ color: colors.text.muted, fontWeight: 500 }}>(optional)</span>
              </label>
              <select value={headId} onChange={e => setHeadId(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '0 12px', fontSize: 13, background: 'white', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— No head assigned —</option>
                {teamMembers.map(m => (
                  <option key={m.employer_profile_id} value={m.employer_profile_id}>{m.contact_person}</option>
                ))}
              </select>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button className="flex-1" style={{ flex: 2 }} onClick={handleSave} loading={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { data: departments, isLoading, isError, refetch } = useDepartments()
  const { data: team } = useTeamMembers()
  const deleteDept = useDeleteDepartment()
  // Backend guards department create/update/delete with companies:edit, not a
  // separate departments:* permission (which doesn't exist in the system) —
  // check the same one the API actually enforces.
  const canManage  = useHasPermission('companies:edit')

  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<DepartmentEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DepartmentEntry | null>(null)
  const [deleteErr, setDeleteErr]       = useState('')

  const teamMembers = (team ?? []).map(m => ({
    employer_profile_id: m.employer_profile_id,
    contact_person: m.contact_person,
  }))

  const openCreate = () => { setEditing(null); setShowModal(true) }
  const openEdit   = (d: DepartmentEntry) => { setEditing(d); setShowModal(true) }

  const handleDelete = () => {
    if (!deleteConfirm) return
    deleteDept.mutate(deleteConfirm.id, {
      onSuccess: () => { setDeleteConfirm(null); setDeleteErr('') },
      onError: e => setDeleteErr(getApiError(e)),
    })
  }

  const totalMembers    = (departments ?? []).reduce((s, d) => s + d.member_count, 0)
  const totalActiveJobs = (departments ?? []).reduce((s, d) => s + d.active_job_count, 0)
  const totalApplicants = (departments ?? []).reduce((s, d) => s + d.total_applicant_count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Departments"
        subtitle="Manage your organization structure"
        actions={canManage ? <Button size="sm" onClick={openCreate}><Plus size={14} />New Department</Button> : undefined}
      />

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {/* Summary strip */}
          {(departments ?? []).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { icon: Building2, label: 'Departments',   value: departments!.length, color: '#1E3A5F' },
                { icon: Users,     label: 'Team members',  value: totalMembers,        color: colors.brand.navy },
                { icon: Briefcase, label: 'Active jobs',   value: totalActiveJobs,     color: '#059669' },
                { icon: Users,     label: 'Applicants',    value: totalApplicants,     color: '#7C3AED' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 12px rgba(30,58,95,0.05)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#1E3A5F', margin: 0, lineHeight: 1, fontFamily: 'Hind, sans-serif' }}>{value}</p>
                    <p style={{ fontSize: 10, color: '#94A3B8', margin: '3px 0 0', fontWeight: 600 }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 16, padding: 20, height: CARD_MIN_HEIGHT }}>
                  <div style={{ width: '60%', height: 16, borderRadius: 6, background: '#E5E7EB', marginBottom: 10 }} />
                  <div style={{ width: '40%', height: 11, borderRadius: 6, background: '#F1F5F9', marginBottom: 20 }} />
                  <div style={{ width: '100%', height: 11, borderRadius: 6, background: '#F1F5F9', marginBottom: 8 }} />
                  <div style={{ width: '80%', height: 11, borderRadius: 6, background: '#F1F5F9' }} />
                </div>
              ))}
            </div>
          ) : isError ? (
            <ErrorState title="Failed to load departments" onRetry={refetch} />
          ) : !departments?.length ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(30,58,95,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Building2 size={28} color="#1E3A5F" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>No departments yet</h3>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px', lineHeight: 1.6 }}>
                Create departments to organise your team and scope job visibility.<br />
                Each department gets its own workspace with jobs, applicants, and analytics.
              </p>
              {canManage && (
                <Button size="sm" onClick={openCreate}><Plus size={14} /> Create first department</Button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {departments.map(dept => (
                  <DepartmentCard key={dept.id} dept={dept} canManage={canManage} onEdit={openEdit} onDelete={setDeleteConfirm} />
                ))}

                {/* Create new tile */}
                {canManage && (
                  <button onClick={openCreate} style={{
                    background: 'transparent', border: '2px dashed rgba(30,58,95,0.18)',
                    borderRadius: 16, padding: '18px 20px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    minHeight: CARD_MIN_HEIGHT, transition: 'border-color 0.2s, background 0.2s',
                  }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(26,39,68,0.3)'; e.currentTarget.style.background = 'rgba(26,39,68,0.03)' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(30,58,95,0.18)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(26,39,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={18} color={colors.brand.navy} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: colors.brand.navy, margin: 0 }}>New Department</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>Add another department</p>
                  </button>
                )}
              </div>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Link to="/app/employer/company" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.state.info, fontWeight: 600, textDecoration: 'none' }}>
                  Manage team members & assign departments <ChevronRight size={12} />
                </Link>
              </div>
            </>
          )}
        </main>

      {/* Modals */}
      {showModal && (
        <DeptModal editing={editing} teamMembers={teamMembers} onClose={() => setShowModal(false)} />
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>Delete "{deleteConfirm.name}"?</h3>
            <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 0 16px', lineHeight: 1.5 }}>
              This cannot be undone. Departments with active jobs cannot be deleted.
            </p>
            {deleteErr && <p style={{ fontSize: 12, color: '#EF4444', margin: '0 0 12px' }}>{deleteErr}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteConfirm(null); setDeleteErr('') }}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} loading={deleteDept.isPending}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
