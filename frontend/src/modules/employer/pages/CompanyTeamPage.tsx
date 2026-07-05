import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Users, Plus, Trash2, Crown, X, MapPin, Briefcase as BriefcaseIcon, ChevronRight, Activity, ShieldCheck } from 'lucide-react'
import {
  useCompanyProfile, useUpdateCompanyProfile,
  useTeamMembers, useInviteTeamMember, useRemoveTeamMember, useTransferOwnership,
  useOffices, useCreateOffice, useDeleteOffice,
  useDepartments, useCreateDepartment, useDeleteDepartment, useAssignMemberDepartment,
  useHasPermission, useTeamActivity, useEmployerPermissions,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamInvitePayload } from '@/api/company'

const ROLE_LABELS: Record<string, string> = {
  employer: 'Owner', employer_owner: 'Owner',
  hr_manager: 'HR Manager', hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter', interviewer: 'Interviewer',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  hr_manager:      'Full company-wide access to all jobs and candidates',
  recruiter:       'Access scoped to their assigned department',
  hiring_manager:  'Can review candidates and provide interview feedback',
  interviewer:     'Can conduct interviews and submit feedback only',
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  hr_manager:     ['Post jobs', 'Edit jobs', 'Publish jobs', 'View all candidates', 'Manage applications', 'Invite team members', 'View analytics'],
  recruiter:      ['Post jobs (department only)', 'Edit jobs (department only)', 'View candidates in department', 'Manage applications in department'],
  hiring_manager: ['View candidates', 'Update application stages', 'Add notes & ratings', 'Submit interview feedback'],
  interviewer:    ['Conduct interviews', 'Submit interview feedback', 'View assigned candidates only'],
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\./g, ' › ').replace(/\b\w/g, c => c.toUpperCase())
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteTeamMember()
  const { data: departments } = useDepartments()
  const [form, setForm] = useState<TeamInvitePayload>({ email: '', contact_person: '', role_name: 'recruiter' })

  const needsDept = form.role_name === 'recruiter' || form.role_name === 'hiring_manager'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Invite team member</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Full name</label>
            <input
              value={form.contact_person}
              onChange={e => setForm({ ...form, contact_person: e.target.value })}
              placeholder="Jane Smith"
              style={{ width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Email address</label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="jane@company.com"
              type="email"
              style={{ width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Role</label>
            <select
              value={form.role_name}
              onChange={e => setForm({ ...form, role_name: e.target.value as TeamInvitePayload['role_name'], department_id: undefined })}
              style={{ width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
            >
              <option value="hr_manager">HR Manager</option>
              <option value="hiring_manager">Hiring Manager</option>
              <option value="recruiter">Recruiter</option>
              <option value="interviewer">Interviewer</option>
            </select>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>{ROLE_DESCRIPTIONS[form.role_name]}</p>
          </div>
          {needsDept && departments && departments.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                Department <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span>
              </label>
              <select
                value={form.department_id ?? ''}
                onChange={e => setForm({ ...form, department_id: e.target.value || undefined })}
                style={{ width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="">— Company-wide —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {invite.isError && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{getApiError(invite.error)}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => form.email.trim() && form.contact_person.trim() && invite.mutate(form, { onSuccess: onClose })}
              disabled={!form.email.trim() || !form.contact_person.trim() || invite.isPending}
              style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: invite.isPending ? 0.6 : 1 }}
            >{invite.isPending ? 'Inviting…' : 'Send Invite'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OfficesAndDepartments({ canEdit }: { canEdit: boolean }) {
  const { data: offices } = useOffices()
  const createOffice = useCreateOffice()
  const deleteOffice = useDeleteOffice()
  const { data: departments } = useDepartments()
  const createDepartment = useCreateDepartment()
  const deleteDepartment = useDeleteDepartment()

  const [officeForm, setOfficeForm] = useState({ name: '', city: '' })
  const [deptName, setDeptName] = useState('')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
      {/* Offices */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
          <MapPin size={15} color="#3B82F6" />
          <h2 style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Offices</h2>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!offices || offices.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>No offices added yet.</p>
          ) : (
            offices.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {o.name}{o.is_headquarters && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.1)', padding: '1px 6px', borderRadius: 20 }}>HQ</span>}
                  </p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{[o.city, o.state].filter(Boolean).join(', ')}</p>
                </div>
                {canEdit && (
                  <button onClick={() => deleteOffice.mutate(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}><Trash2 size={13} /></button>
                )}
              </div>
            ))
          )}
          {canEdit && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={officeForm.name} onChange={e => setOfficeForm({ ...officeForm, name: e.target.value })} placeholder="Office name" style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 12 }} />
              <input value={officeForm.city} onChange={e => setOfficeForm({ ...officeForm, city: e.target.value })} placeholder="City" style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 12 }} />
              <button
                onClick={() => officeForm.name.trim() && officeForm.city.trim() && createOffice.mutate(officeForm, { onSuccess: () => setOfficeForm({ name: '', city: '' }) })}
                disabled={!officeForm.name.trim() || !officeForm.city.trim() || createOffice.isPending}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              ><Plus size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Departments */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BriefcaseIcon size={15} color="#3B82F6" />
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Departments</h2>
          </div>
          <Link to="/app/employer/departments" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }}>
            Manage <ChevronRight size={11} />
          </Link>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!departments || departments.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>No departments added yet. <Link to="/app/employer/departments" style={{ color: '#3B82F6', fontWeight: 600 }}>Create one →</Link></p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {departments.map(d => (
                <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#374151', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                  {d.name}
                  {canEdit && (
                    <button onClick={() => deleteDepartment.mutate(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex' }}><X size={11} /></button>
                  )}
                </span>
              ))}
            </div>
          )}
          {canEdit && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="e.g. Engineering" style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 12 }} />
              <button
                onClick={() => deptName.trim() && createDepartment.mutate({ name: deptName.trim() }, { onSuccess: () => setDeptName('') })}
                disabled={!deptName.trim() || createDepartment.isPending}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              ><Plus size={14} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MyPermissionsCard() {
  const { data: perms } = useEmployerPermissions()
  if (!perms || perms.is_company_wide) return null

  const rolePerms = ROLE_PERMISSIONS[perms.role_name] ?? []
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden', marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
        <ShieldCheck size={15} color="#6366F1" />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Your Access</h2>
        {perms.department_name && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#6366F1', background: 'rgba(99,102,241,0.08)', padding: '3px 10px', borderRadius: 20 }}>
            {perms.department_name}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 18px' }}>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 10px', fontWeight: 600 }}>
          Role: <span style={{ color: '#374151' }}>{ROLE_LABELS[perms.role_name] ?? perms.role_name}</span>
          {perms.department_name ? ` · Scoped to ${perms.department_name}` : ' · Company-wide'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {rolePerms.map(p => (
            <span key={p} style={{ fontSize: 11, fontWeight: 600, color: '#374151', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '3px 10px' }}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamActivityLog({ canView }: { canView: boolean }) {
  const { data: activity, isLoading } = useTeamActivity()
  if (!canView) return null

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden', marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
        <Activity size={15} color="#3B82F6" />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Team Activity</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>Last 50 actions</span>
      </div>
      {isLoading ? (
        <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
      ) : !activity || activity.length === 0 ? (
        <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>No team activity recorded yet.</p>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {activity.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 18px', borderBottom: idx < activity.length - 1 ? '1px solid #F8FAFC' : 'none',
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={12} color="#6366F1" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0 }}>{formatAction(entry.action)}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                  {entry.actor_name ?? entry.actor_email ?? 'Unknown'}
                  {entry.resource ? ` · ${entry.resource}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0 }}>
                {new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompanyTeamPage() {
  const { data: company, isLoading: companyLoading } = useCompanyProfile()
  const updateCompany = useUpdateCompanyProfile()
  const { data: team, isLoading: teamLoading } = useTeamMembers()
  const { data: departments } = useDepartments()
  const removeMember = useRemoveTeamMember()
  const transferOwnership = useTransferOwnership()
  const assignDept = useAssignMemberDepartment()
  const [showInvite, setShowInvite] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [description, setDescription] = useState(company?.description ?? '')

  const canInvite = useHasPermission('team:invite')
  const canRemove = useHasPermission('team:remove')
  const canTransferOwnership = useHasPermission('team:transfer_ownership')
  const canEditCompany = useHasPermission('companies:edit')
  const canManageDepts = useHasPermission('departments:write')

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/app/employer/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} />Back to dashboard
        </Link>

        {/* Company profile card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Building2 size={20} color="#3B82F6" />
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>{companyLoading ? 'Loading…' : company?.name}</h1>
          </div>
          {company && (
            <>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 14px' }}>
                {company.industry} · {company.company_size} employees
                {company.headquarters ? ` · ${company.headquarters}` : ''}
              </p>
              {editingDescription ? (
                <div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: 12, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => setEditingDescription(false)} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={() => updateCompany.mutate({ description }, { onSuccess: () => setEditingDescription(false) })}
                      disabled={updateCompany.isPending}
                      style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >{updateCompany.isPending ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => { if (canEditCompany) { setDescription(company.description ?? ''); setEditingDescription(true) } }}
                  style={{ fontSize: 13, color: company.description ? '#374151' : '#9CA3AF', cursor: canEditCompany ? 'pointer' : 'default', margin: 0 }}
                >
                  {company.description || (canEditCompany ? 'Click to add a company description…' : 'No description yet.')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Team */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#3B82F6" />
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Team Members</h2>
            </div>
            {canInvite && (
              <button
                onClick={() => setShowInvite(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              ><Plus size={13} />Invite</button>
            )}
          </div>

          {teamLoading ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : !team || team.length === 0 ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>No team members yet.</p>
          ) : (
            team.map((m, idx) => (
              <div
                key={m.employer_profile_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: idx < team.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{m.contact_person}</p>
                    {m.is_owner && <Crown size={13} color="#D97706" />}
                  </div>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{m.email ?? m.phone}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', padding: '3px 10px', borderRadius: 20 }}>
                    {ROLE_LABELS[m.role_name] ?? m.role_name}
                  </span>
                  {/* Dept badge / reassign */}
                  {departments && departments.length > 0 && canManageDepts ? (
                    <select
                      value={m.department_id ?? ''}
                      onChange={e => assignDept.mutate({ employerProfileId: m.employer_profile_id, departmentId: e.target.value || null })}
                      style={{ height: 26, borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 11, padding: '0 6px', background: '#F8FAFC', color: '#374151' }}
                    >
                      <option value="">No dept</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : m.department_name ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.07)', padding: '3px 9px', borderRadius: 20 }}>
                      {m.department_name}
                    </span>
                  ) : null}
                  {!m.is_owner && canTransferOwnership && (
                    <button
                      onClick={() => transferOwnership.mutate(m.employer_profile_id)}
                      disabled={transferOwnership.isPending}
                      title="Transfer ownership to this member"
                      style={{ fontSize: 11, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >Make owner</button>
                  )}
                  {!m.is_owner && canRemove && (
                    <button
                      onClick={() => removeMember.mutate(m.employer_profile_id)}
                      disabled={removeMember.isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                    ><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <OfficesAndDepartments canEdit={canEditCompany} />

        {/* Permissions card — visible to department-scoped sub-admins only */}
        <MyPermissionsCard />

        {/* Team activity log — visible to owners and HR managers who can invite */}
        <TeamActivityLog canView={canInvite} />
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
