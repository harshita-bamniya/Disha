import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil, Trash2, X, ChevronRight, Check } from 'lucide-react'
import {
  useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  useTeamMembers, useHasPermission,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { DepartmentEntry } from '@/api/company'
import Button from '@/shared/components/primitives/Button'
import Avatar from '@/shared/components/data-display/Avatar'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import OrgFlowGuide from '../components/OrgFlowGuide'
import { StatusPill, roleLabel } from '../components/teamUi'

const COLS = 'minmax(200px, 1.5fr) minmax(190px, 1.2fr) 80px 90px 90px 110px'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Head cell ─────────────────────────────────────────────────────────────────

function HeadCell({ dept, canManage, onAssign }: { dept: DepartmentEntry; canManage: boolean; onAssign: (d: DepartmentEntry) => void }) {
  if (dept.head_name) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Avatar name={dept.head_name} size={26} shape="rounded" />
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.head_name}</span>
      </div>
    )
  }
  if (dept.head_pending_email) {
    return (
      <div style={{ minWidth: 0 }}>
        <StatusPill status="invited" />
        <span style={{ display: 'block', fontSize: 11.5, color: colors.text.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.head_pending_email}</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: colors.text.muted }}>Unassigned</span>
      {canManage && (
        <button
          onClick={e => { e.stopPropagation(); onAssign(dept) }}
          style={{ fontSize: 12, fontWeight: 600, color: colors.brand.navy, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >Assign</button>
      )}
    </div>
  )
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

type HeadMode = 'later' | 'member' | 'invite'

function DeptModal({
  editing, teamMembers, onClose,
}: {
  editing: DepartmentEntry | null
  teamMembers: { employer_profile_id: string; contact_person: string; role_name: string }[]
  onClose: () => void
}) {
  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [mode, setMode] = useState<HeadMode>(editing?.head_employer_id ? 'member' : 'later')
  const [headId, setHeadId] = useState(editing?.head_employer_id ?? '')
  const [headEmail, setHeadEmail] = useState('')
  const [err, setErr] = useState('')

  const busy = create.isPending || update.isPending

  const handleSave = () => {
    if (!name.trim()) { setErr('Give the department a name'); return }
    if (mode === 'member' && !headId) { setErr('Choose who should head it, or pick “Decide later”'); return }
    if (mode === 'invite' && !EMAIL_RE.test(headEmail.trim())) { setErr('Enter a valid email address for the head'); return }

    const base = { name: name.trim(), description: description.trim() || undefined }
    if (editing) {
      update.mutate(
        { id: editing.id, payload: { ...base, head_employer_id: mode === 'member' ? headId : null } },
        { onSuccess: onClose, onError: e => setErr(getApiError(e)) },
      )
    } else {
      create.mutate(
        { ...base, head_employer_id: mode === 'member' ? headId : undefined, head_email: mode === 'invite' ? headEmail.trim() : undefined },
        { onSuccess: onClose, onError: e => setErr(getApiError(e)) },
      )
    }
  }

  const input: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '0 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const options: { value: HeadMode; title: string; text: string; hidden?: boolean }[] = [
    { value: 'later', title: editing ? 'No head' : 'Decide later', text: editing ? 'The department runs without a head. You can assign one any time.' : 'The department works without a head. You can assign one any time.' },
    { value: 'member', title: 'Choose a team member', text: 'Pick someone who has already joined your team.' },
    { value: 'invite', title: 'Invite someone new by email', text: 'They get an email invitation and become the head when they accept. No account is created before that.', hidden: !!editing },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div role="dialog" aria-label={editing ? 'Edit department' : 'New department'} style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: 0 }}>{editing ? 'Edit department' : 'New department'}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted, padding: 4 }}><X size={18} /></button>
        </div>
        {!editing && (
          <p style={{ fontSize: 12.5, color: colors.text.inkSoft, margin: '0 0 18px', lineHeight: 1.5 }}>
            A department is part of your structure, like Engineering or Legal. Jobs and people belong to one. It doesn’t need anyone in it yet.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>Name <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); setErr('') }} placeholder="e.g. Engineering, Policy Research, HR" style={input} autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>
              Description <span style={{ color: colors.text.muted, fontWeight: 500 }}>(optional)</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this department focus on?" rows={2}
              style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${colors.border.default}`, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, padding: 0, marginBottom: 6 }}>
              Department head <span style={{ color: colors.text.muted, fontWeight: 500 }}>(optional)</span>
            </legend>
            <div role="radiogroup" style={{ display: 'grid', gap: 8 }}>
              {options.filter(o => !o.hidden).map(o => {
                const on = mode === o.value
                return (
                  <div key={o.value} style={{ border: `${on ? 2 : 1}px solid ${on ? colors.brand.navy : colors.border.medium}`, borderRadius: 10, background: on ? colors.surface.bg : '#fff' }}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => { setMode(o.value); setErr('') }}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'inherit' }}>
                      <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: `2px solid ${on ? colors.brand.navy : colors.border.strong}`, background: on ? colors.brand.navy : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Check size={10} color="#fff" />}
                      </span>
                      <span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{o.title}</span>
                        <span style={{ display: 'block', fontSize: 12, color: colors.text.inkSoft, marginTop: 1, lineHeight: 1.45 }}>{o.text}</span>
                      </span>
                    </button>
                    {on && o.value === 'member' && (
                      <div style={{ padding: '0 12px 12px 38px' }}>
                        {teamMembers.length > 0 ? (
                          <select value={headId} onChange={e => { setHeadId(e.target.value); setErr('') }} aria-label="Department head" style={{ ...input, height: 38, background: 'white' }}>
                            <option value="">Select a team member…</option>
                            {teamMembers.map(m => <option key={m.employer_profile_id} value={m.employer_profile_id}>{m.contact_person} · {roleLabel(m.role_name)}</option>)}
                          </select>
                        ) : (
                          <p style={{ margin: 0, fontSize: 12, color: colors.text.muted }}>
                            Nobody has joined yet. <Link to="/app/employer/company" style={{ color: colors.brand.navy, fontWeight: 600 }}>Invite people on the Team page</Link>, or choose another option.
                          </p>
                        )}
                      </div>
                    )}
                    {on && o.value === 'invite' && (
                      <div style={{ padding: '0 12px 12px 38px' }}>
                        <input type="email" value={headEmail} onChange={e => { setHeadEmail(e.target.value); setErr('') }} placeholder="head@company.com" aria-label="Head's email" style={{ ...input, height: 38 }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {editing && !editing.head_employer_id && editing.head_pending_email && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.text.muted }}>
                An invitation to <strong>{editing.head_pending_email}</strong> is still waiting. See it on the Team page.
              </p>
            )}
          </fieldset>

          {err && <p role="alert" style={{ fontSize: 12.5, color: '#EF4444', margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button className="flex-1" style={{ flex: 2 }} onClick={handleSave} loading={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : mode === 'invite' ? 'Create and send invitation' : 'Create department'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const navigate = useNavigate()
  const { data: departments, isLoading, isError, refetch } = useDepartments()
  const { data: team } = useTeamMembers()
  const deleteDept = useDeleteDepartment()
  // Backend guards department create/update/delete with companies:edit.
  const canManage  = useHasPermission('companies:edit')

  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState<DepartmentEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DepartmentEntry | null>(null)
  const [deleteErr, setDeleteErr]         = useState('')

  const teamMembers = (team ?? []).map(m => ({
    employer_profile_id: m.employer_profile_id, contact_person: m.contact_person || m.email || 'Member', role_name: m.role_name,
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

  const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Departments"
        subtitle="Your organisation’s structure: every job and every person belongs to a department"
        actions={canManage ? <Button size="sm" onClick={openCreate}><Plus size={14} />New department</Button> : undefined}
      />

      <main style={{ padding: '24px 28px', flex: 1, background: colors.surface.bg }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <OrgFlowGuide here="departments" />

          {isLoading ? (
            <p style={{ fontSize: 13, color: colors.text.muted }}>Loading…</p>
          ) : isError ? (
            <ErrorState title="Failed to load departments" onRetry={refetch} />
          ) : !departments?.length ? (
            <div style={{ textAlign: 'center', padding: '56px 20px', background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: colors.surface.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Building2 size={26} color={colors.brand.navy} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: '0 0 8px' }}>Start with your first department</h3>
              <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 auto 18px', lineHeight: 1.6, maxWidth: 440 }}>
                Departments are how you organise hiring, for example Engineering, Policy Research or HR. Create one, then
                invite the people who work in it and post its jobs. A department doesn’t need a head to start.
              </p>
              {canManage && <Button size="sm" onClick={openCreate}><Plus size={14} /> Create a department</Button>}
            </div>
          ) : (
            <div style={{ background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 14, overflow: 'hidden' }}>
              <div role="table" aria-label="Departments" style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 780 }}>
                  <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '8px 20px', background: colors.surface.elevated, borderBottom: `1px solid ${colors.border.default}` }}>
                    {['Department', 'Head', 'People', 'Active jobs', 'Applicants', ''].map(h => (
                      <span key={h || 'actions'} role="columnheader" style={{ fontSize: 10.5, fontWeight: 600, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
                    ))}
                  </div>
                  {departments.map((d, i) => (
                    <div key={d.id} role="row" onClick={() => navigate(`/app/employer/departments/${d.id}`)}
                      style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '13px 20px', cursor: 'pointer', borderBottom: i < departments.length - 1 ? `1px solid ${colors.border.default}` : 'none' }}
                      onMouseOver={e => { e.currentTarget.style.background = colors.surface.bg }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={15} color={colors.brand.navy} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text.ink, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          {d.description && <span style={{ fontSize: 12, color: colors.text.muted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</span>}
                        </div>
                      </div>
                      <div role="cell"><HeadCell dept={d} canManage={canManage} onAssign={openEdit} /></div>
                      <div role="cell" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: colors.text.ink }}>{d.member_count}</div>
                      <div role="cell" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: colors.text.ink }}>{d.active_job_count}</div>
                      <div role="cell" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: colors.text.ink }}>{d.total_applicant_count}</div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {canManage && (
                          <>
                            <button onClick={e => { e.stopPropagation(); openEdit(d) }} aria-label={`Edit ${d.name}`} style={iconBtn}><Pencil size={12} color={colors.text.inkSoft} /></button>
                            <button onClick={e => { e.stopPropagation(); setDeleteConfirm(d) }} aria-label={`Delete ${d.name}`} style={{ ...iconBtn, border: '1px solid #FEE2E2', background: '#FFF5F5' }}><Trash2 size={12} color="#EF4444" /></button>
                          </>
                        )}
                        <ChevronRight size={14} color={colors.text.muted} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: 12, color: colors.text.muted }}>
            People join a department from the <Link to="/app/employer/company" style={{ color: colors.brand.navy, fontWeight: 600 }}>Team page</Link> (invite them and pick this department).
            Open a department to post its jobs and see its team.
          </p>
        </div>
      </main>

      {showModal && <DeptModal editing={editing} teamMembers={teamMembers} onClose={() => setShowModal(false)} />}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.text.ink, margin: '0 0 8px' }}>Delete “{deleteConfirm.name}”?</h3>
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
