import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Building2, Plus, Pencil, Trash2, X, Users, Briefcase, UserCheck, ChevronRight,
} from 'lucide-react'
import {
  useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  useTeamMembers, useHasPermission,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { DepartmentEntry } from '@/api/company'

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: number; label: string; color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: `${color}12` }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ── Department card ───────────────────────────────────────────────────────────

function DepartmentCard({
  dept, canManage, onEdit, onDelete,
}: {
  dept: DepartmentEntry
  canManage: boolean
  onEdit: (dept: DepartmentEntry) => void
  onDelete: (dept: DepartmentEntry) => void
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16,
      padding: '18px 20px', boxShadow: '0 2px 12px rgba(30,58,95,0.06)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(30,58,95,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={16} color="#1E3A5F" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>{dept.name}</p>
            {dept.head_name && (
              <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={10} /> {dept.head_name}
              </p>
            )}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => onEdit(dept)}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Pencil size={12} color="#64748B" />
            </button>
            <button
              onClick={() => onDelete(dept)}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={12} color="#EF4444" />
            </button>
          </div>
        )}
      </div>

      {dept.description && (
        <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{dept.description}</p>
      )}

      {/* stats row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatPill icon={Users} value={dept.member_count} label="members" color="#3B82F6" />
        <StatPill icon={Briefcase} value={dept.active_job_count} label="active jobs" color="#059669" />
        <StatPill icon={Users} value={dept.total_applicant_count} label="applicants" color="#7C3AED" />
      </div>
    </div>
  )
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function DeptModal({
  editing,
  teamMembers,
  onClose,
}: {
  editing: DepartmentEntry | null
  teamMembers: { employer_profile_id: string; contact_person: string }[]
  onClose: () => void
}) {
  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [headId, setHeadId] = useState(editing?.head_employer_id ?? '')
  const [err, setErr] = useState('')

  const busy = create.isPending || update.isPending

  const handleSave = () => {
    if (!name.trim()) { setErr('Department name is required'); return }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      head_employer_id: headId || undefined,
    }
    if (editing) {
      update.mutate({ id: editing.id, payload }, {
        onSuccess: onClose,
        onError: e => setErr(getApiError(e)),
      })
    } else {
      create.mutate(payload, {
        onSuccess: onClose,
        onError: e => setErr(getApiError(e)),
      })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>
            {editing ? 'Edit department' : 'New department'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
              Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErr('') }}
              placeholder="e.g. Engineering, Policy Research, HR"
              style={{ width: '100%', height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
              Description <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this department focus on?"
              rows={3}
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                Department Head <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span>
              </label>
              <select
                value={headId}
                onChange={e => setHeadId(e.target.value)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, background: 'white', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">— No head assigned —</option>
                {teamMembers.map(m => (
                  <option key={m.employer_profile_id} value={m.employer_profile_id}>
                    {m.contact_person}
                  </option>
                ))}
              </select>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              disabled={busy}
              style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              style={{ flex: 2, height: 40, borderRadius: 10, border: 'none', background: '#1E3A5F', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'white', opacity: busy ? 0.7 : 1 }}
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments()
  const { data: team } = useTeamMembers()
  const deleteDept = useDeleteDepartment()
  const canManage = useHasPermission('departments:write')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DepartmentEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DepartmentEntry | null>(null)
  const [deleteErr, setDeleteErr] = useState('')

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

  const totalMembers     = (departments ?? []).reduce((s, d) => s + d.member_count, 0)
  const totalActiveJobs  = (departments ?? []).reduce((s, d) => s + d.active_job_count, 0)
  const totalApplicants  = (departments ?? []).reduce((s, d) => s + d.total_applicant_count, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F0FE 50%, #F5F0FF 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/app/employer/company" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.95)', color: '#64748B', textDecoration: 'none' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E3A5F', margin: 0 }}>Departments</h1>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Organise your team and jobs by department</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={14} /> New department
            </button>
          )}
        </div>

        {/* Summary strip */}
        {(departments ?? []).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { icon: Building2, label: 'Departments', value: departments!.length, color: '#1E3A5F' },
              { icon: Users, label: 'Team members', value: totalMembers, color: '#3B82F6' },
              { icon: Briefcase, label: 'Active jobs', value: totalActiveJobs, color: '#059669' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#1E3A5F', margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 14 }}>Loading departments…</div>
        ) : !departments?.length ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(30,58,95,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Building2 size={26} color="#1E3A5F" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>No departments yet</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px' }}>Create departments to organise your hiring team and scope job visibility.</p>
            {canManage && (
              <button
                onClick={openCreate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} /> Create first department
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {departments.map(dept => (
              <DepartmentCard
                key={dept.id}
                dept={dept}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setDeleteConfirm}
              />
            ))}
          </div>
        )}

        {/* Link to team page */}
        {(departments ?? []).length > 0 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link
              to="/app/employer/company"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }}
            >
              Manage team members & assign departments <ChevronRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <DeptModal
          editing={editing}
          teamMembers={teamMembers}
          onClose={() => setShowModal(false)}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>Delete "{deleteConfirm.name}"?</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.5 }}>
              This cannot be undone. Departments with active jobs cannot be deleted.
            </p>
            {deleteErr && <p style={{ fontSize: 12, color: '#EF4444', margin: '0 0 12px' }}>{deleteErr}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteErr('') }}
                style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteDept.isPending}
                style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#EF4444', cursor: deleteDept.isPending ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'white', opacity: deleteDept.isPending ? 0.7 : 1 }}
              >
                {deleteDept.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
