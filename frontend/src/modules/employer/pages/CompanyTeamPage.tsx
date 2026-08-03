import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Users, MapPin, Briefcase as BriefcaseIcon,
  Activity, ShieldCheck, Plus, Trash2, Crown, X,
  Eye, EyeOff, CheckCircle, Pencil, ChevronRight,
  LayoutGrid, UserSquare2, Settings,
} from 'lucide-react'
import {
  useCompanyProfile, useUpdateCompanyProfile,
  useTeamMembers, useInviteTeamMember, useRemoveTeamMember, useTransferOwnership,
  useOffices, useCreateOffice, useDeleteOffice,
  useDepartments, useCreateDepartment, useDeleteDepartment, useAssignMemberDepartment,
  useHasPermission, useTeamActivity, useEmployerPermissions,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamInvitePayload } from '@/api/company'
import { DS, C, initials } from '../ds'

// ── Constants ──────────────────────────────────────────────────────────────────

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
  recruiter:      ['Post jobs (dept)', 'Edit jobs (dept)', 'View candidates in dept', 'Manage applications in dept'],
  hiring_manager: ['View candidates', 'Update stages', 'Add notes & ratings', 'Submit interview feedback'],
  interviewer:    ['Conduct interviews', 'Submit feedback', 'View assigned candidates only'],
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  employer:        { bg: '#FFF7ED', color: '#D97706' },
  employer_owner:  { bg: '#FFF7ED', color: '#D97706' },
  hr_manager:      { bg: C.accentBg, color: C.accent },
  hiring_manager:  { bg: '#F0FDF4', color: '#16A34A' },
  recruiter:       { bg: C.blueBg, color: C.blue },
  interviewer:     { bg: '#FAF5FF', color: '#7C3AED' },
}

function formatAction(a: string) {
  return a.replace(/_/g, ' ').replace(/\./g, ' › ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const bg = ['#EEF2FF','#F0FDF4','#FFF7ED','#FAF5FF','#EFF6FF']
  const fg = [C.accent, '#16A34A', '#D97706', '#7C3AED', C.blue]
  const idx = (name?.charCodeAt(0) ?? 0) % 5
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: bg[idx], color: fg[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  )
}

// ── Modal shell ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 480 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, width: '100%', maxWidth: width,
        border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink1 }}>{title}</span>
          <button onClick={onClose} style={{ ...DS.btnIcon, border: 'none' }}>
            <X size={15} />
          </button>
        </div>
        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteTeamMember()
  const { data: departments } = useDepartments()
  const [form, setForm] = useState<TeamInvitePayload>({ email: '', contact_person: '', role_name: 'recruiter' })
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const needsDept = form.role_name === 'recruiter' || form.role_name === 'hiring_manager'

  const handleSubmit = () => {
    if (!form.email.trim())          { setErr('Email is required'); return }
    if (!form.contact_person.trim()) { setErr('Full name is required'); return }
    if (!password || password.length < 6) { setErr('Password must be at least 6 characters'); return }
    invite.mutate({ ...form, password }, {
      onSuccess: () => setDone(true),
      onError: e => setErr(getApiError(e)),
    })
  }

  if (done) return (
    <Modal title="Member added" onClose={onClose} width={420}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: '#F0FDF4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <CheckCircle size={28} color="#16A34A" />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.ink1, margin: '0 0 6px' }}>Account created!</p>
        <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 20px', lineHeight: 1.6 }}>
          Share these credentials with <strong>{form.contact_person}</strong>:
        </p>
        <div style={{
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '14px 16px', textAlign: 'left', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.ink2, fontWeight: 600 }}>Email</span>
            <span style={{ fontSize: 12, color: C.ink1, fontWeight: 700 }}>{form.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.ink2, fontWeight: 600 }}>Password</span>
            <span style={{ fontSize: 12, color: C.ink1, fontWeight: 700, fontFamily: 'monospace' }}>{password}</span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.ink3, margin: '0 0 20px' }}>
          They can change their password after login from Security Settings.
        </p>
        <button onClick={onClose} style={{ ...DS.btnPrimary, width: '100%', justifyContent: 'center' }}>Done</button>
      </div>
    </Modal>
  )

  return (
    <Modal title="Invite team member" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name">
          <input
            value={form.contact_person}
            onChange={e => { setForm({ ...form, contact_person: e.target.value }); setErr('') }}
            placeholder="Jane Smith"
            autoFocus
            style={DS.input}
          />
        </Field>
        <Field label="Email address">
          <input
            value={form.email}
            onChange={e => { setForm({ ...form, email: e.target.value }); setErr('') }}
            placeholder="jane@company.com"
            type="email"
            style={DS.input}
          />
        </Field>
        <Field label="Password" hint="You set this — share it with them after creating the account.">
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setErr('') }}
              placeholder="Min. 6 characters"
              style={{ ...DS.input, paddingRight: 36 }}
            />
            <button type="button" onClick={() => setShowPw(s => !s)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.ink3 }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <Field label="Role" hint={ROLE_DESCRIPTIONS[form.role_name]}>
          <select
            value={form.role_name}
            onChange={e => setForm({ ...form, role_name: e.target.value as TeamInvitePayload['role_name'], department_id: undefined })}
            style={{ ...DS.select, width: '100%' }}
          >
            <option value="hr_manager">HR Manager</option>
            <option value="hiring_manager">Hiring Manager</option>
            <option value="recruiter">Recruiter</option>
            <option value="interviewer">Interviewer</option>
          </select>
        </Field>
        {needsDept && departments && departments.length > 0 && (
          <Field label="Department" hint="Optional — leave blank for company-wide access.">
            <select
              value={form.department_id ?? ''}
              onChange={e => setForm({ ...form, department_id: e.target.value || undefined })}
              style={{ ...DS.select, width: '100%' }}
            >
              <option value="">— Company-wide —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button onClick={onClose} style={{ ...DS.btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={invite.isPending}
            style={{ ...DS.btnPrimary, flex: 1, justifyContent: 'center', opacity: invite.isPending ? 0.6 : 1 }}>
            {invite.isPending ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Offices Modal ──────────────────────────────────────────────────────────────

function OfficesModal({ onClose }: { onClose: () => void }) {
  const { data: offices } = useOffices()
  const createOffice = useCreateOffice()
  const deleteOffice = useDeleteOffice()
  const [form, setForm] = useState({ name: '', city: '' })
  const [err, setErr] = useState('')

  const handleAdd = () => {
    if (!form.name.trim() || !form.city.trim()) { setErr('Both office name and city are required'); return }
    createOffice.mutate(form, {
      onSuccess: () => { setForm({ name: '', city: '' }); setErr('') },
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <Modal title="Manage Offices" onClose={onClose} width={480}>
      {/* List */}
      <div style={{ marginBottom: 24 }}>
        {!offices || offices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.ink3, fontSize: 13 }}>
            No offices added yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offices.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: C.bg, borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: C.blueBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <MapPin size={16} color={C.blue} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>{o.name}</span>
                    {o.is_headquarters && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: C.amberBg, padding: '1px 6px', borderRadius: 20 }}>HQ</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: C.ink2 }}>{[o.city, o.state].filter(Boolean).join(', ')}</span>
                </div>
                <button onClick={() => deleteOffice.mutate(o.id)} style={{ ...DS.btnIcon, color: C.red, border: 'none' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: '0 0 12px' }}>Add new office</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            value={form.name}
            onChange={e => { setForm({ ...form, name: e.target.value }); setErr('') }}
            placeholder="Office name (e.g. Mumbai HQ)"
            style={{ ...DS.input, flex: 1 }}
          />
          <input
            value={form.city}
            onChange={e => { setForm({ ...form, city: e.target.value }); setErr('') }}
            placeholder="City"
            style={{ ...DS.input, flex: 1 }}
          />
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px' }}>{err}</p>}
        <button
          onClick={handleAdd}
          disabled={createOffice.isPending}
          style={{ ...DS.btnPrimary, width: '100%', justifyContent: 'center' }}
        >
          <Plus size={14} />
          {createOffice.isPending ? 'Adding…' : 'Add Office'}
        </button>
      </div>
    </Modal>
  )
}

// ── Departments Modal ──────────────────────────────────────────────────────────

function DepartmentsModal({ onClose }: { onClose: () => void }) {
  const { data: departments } = useDepartments()
  const createDepartment = useCreateDepartment()
  const deleteDepartment = useDeleteDepartment()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const handleAdd = () => {
    if (!name.trim()) { setErr('Department name is required'); return }
    createDepartment.mutate({ name: name.trim() }, {
      onSuccess: () => { setName(''); setErr('') },
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <Modal title="Manage Departments" onClose={onClose} width={440}>
      {/* List */}
      <div style={{ marginBottom: 24 }}>
        {!departments || departments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.ink3, fontSize: 13 }}>
            No departments yet. Add one below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {departments.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: C.accentBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <BriefcaseIcon size={14} color={C.accent} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>{d.name}</span>
                </div>
                <button onClick={() => deleteDepartment.mutate(d.id)} style={{ ...DS.btnIcon, color: C.red, border: 'none' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: '0 0 12px' }}>Add new department</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setErr('') }}
            placeholder="e.g. Engineering, Design, Sales"
            style={{ ...DS.input, flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px' }}>{err}</p>}
        <button
          onClick={handleAdd}
          disabled={createDepartment.isPending}
          style={{ ...DS.btnPrimary, width: '100%', justifyContent: 'center' }}
        >
          <Plus size={14} />
          {createDepartment.isPending ? 'Adding…' : 'Add Department'}
        </button>
      </div>
    </Modal>
  )
}

// ── Edit Description Modal ─────────────────────────────────────────────────────

function EditDescriptionModal({ current, onClose }: { current: string; onClose: () => void }) {
  const updateCompany = useUpdateCompanyProfile()
  const [val, setVal] = useState(current)
  const [err, setErr] = useState('')

  const save = () => {
    updateCompany.mutate({ description: val }, {
      onSuccess: onClose,
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <Modal title="Company Description" onClose={onClose} width={480}>
      <Field label="Description" hint="Tell candidates what your company is about.">
        <textarea
          value={val}
          onChange={e => setVal(e.target.value)}
          rows={5}
          style={{ ...DS.input, resize: 'vertical' }}
          placeholder="Describe your company culture, mission, and what makes it a great place to work…"
        />
      </Field>
      {err && <p style={{ fontSize: 12, color: C.red, margin: '10px 0 0' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...DS.btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
        <button onClick={save} disabled={updateCompany.isPending}
          style={{ ...DS.btnPrimary, flex: 1, justifyContent: 'center' }}>
          {updateCompany.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

// ── Permissions Modal ──────────────────────────────────────────────────────────

function PermissionsModal({ onClose }: { onClose: () => void }) {
  const { data: perms } = useEmployerPermissions()
  if (!perms) return null
  const rolePerms = ROLE_PERMISSIONS[perms.role_name] ?? []
  const rc = ROLE_COLORS[perms.role_name] ?? { bg: C.bg, color: C.ink2 }

  return (
    <Modal title="Your Access & Permissions" onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: rc.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ShieldCheck size={20} color={rc.color} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink1, margin: 0 }}>
            {ROLE_LABELS[perms.role_name] ?? perms.role_name}
          </p>
          <p style={{ fontSize: 12, color: C.ink2, margin: '2px 0 0' }}>
            {perms.department_name ? `Scoped to ${perms.department_name}` : 'Company-wide access'}
          </p>
        </div>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink2, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        What you can do
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rolePerms.map(p => (
          <div key={p} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', background: '#F0FDF4', borderRadius: 8,
          }}>
            <CheckCircle size={14} color="#16A34A" />
            <span style={{ fontSize: 13, color: C.ink1 }}>{p}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, count, sub, onClick, color = C.accent,
}: {
  icon: React.ReactNode; label: string; count: number | string
  sub?: string; onClick?: () => void; color?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '16px 18px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        flex: 1, minWidth: 0, transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {onClick && <ChevronRight size={15} color={C.ink3} />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: C.ink1, margin: '0 0 2px' }}>{count}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink2, margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: C.ink3, margin: '2px 0 0' }}>{sub}</p>}
    </button>
  )
}

// ── Field helper ───────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: C.ink3, margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'team' | 'activity'

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid size={13} /> },
    { id: 'team',     label: 'Team',     icon: <UserSquare2 size={13} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={13} /> },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 0 0 0', marginBottom: 20,
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', border: 'none', cursor: 'pointer',
            background: 'none', fontSize: 13, fontWeight: active === t.id ? 700 : 500,
            color: active === t.id ? C.accent : C.ink2,
            borderBottom: `2px solid ${active === t.id ? C.accent : 'transparent'}`,
            marginBottom: -1,
          }}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CompanyTeamPage() {
  const { data: company, isLoading: companyLoading } = useCompanyProfile()
  const { data: team, isLoading: teamLoading } = useTeamMembers()
  const { data: offices } = useOffices()
  const { data: departments } = useDepartments()
  const { data: activity, isLoading: activityLoading } = useTeamActivity()
  const { data: perms } = useEmployerPermissions()
  const removeMember = useRemoveTeamMember()
  const transferOwnership = useTransferOwnership()
  const assignDept = useAssignMemberDepartment()

  const canInvite         = useHasPermission('team:invite')
  const canRemove         = useHasPermission('team:remove')
  const canTransfer       = useHasPermission('team:transfer_ownership')
  const canEditCompany    = useHasPermission('companies:edit')
  const canManageDepts    = useHasPermission('departments:write')
  const isOwnerOrHR       = canInvite

  const [tab, setTab] = useState<Tab>('overview')
  const [showInvite, setShowInvite] = useState(false)
  const [showOffices, setShowOffices] = useState(false)
  const [showDepts, setShowDepts] = useState(false)
  const [showEditDesc, setShowEditDesc] = useState(false)
  const [showPerms, setShowPerms] = useState(false)

  const showMyPerms = perms && !perms.is_company_wide

  return (
    <div style={{ ...DS.pageWrap }}>
      {/* Top bar */}
      <div style={DS.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: C.accentBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={15} color={C.accent} />
          </div>
          <div>
            <p style={DS.pageTitle}>{companyLoading ? 'Loading…' : (company?.name ?? 'Company')}</p>
            {company && (
              <p style={DS.pageSub}>{[company.industry, company.company_size ? `${company.company_size} employees` : null].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {showMyPerms && (
            <button onClick={() => setShowPerms(true)} style={DS.btnSecondary}>
              <ShieldCheck size={13} />My Access
            </button>
          )}
          {canEditCompany && (
            <button onClick={() => setShowEditDesc(true)} style={DS.btnSecondary}>
              <Pencil size={13} />Edit Company
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ ...DS.content, padding: '24px' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>

          {/* Company description */}
          {company?.description && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '14px 18px', marginBottom: 20, fontSize: 13, color: C.ink2, lineHeight: 1.6,
            }}>
              {company.description}
            </div>
          )}

          <TabBar active={tab} onChange={setTab} />

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Stat row */}
              <div style={{ display: 'flex', gap: 12 }}>
                <StatCard
                  icon={<Users size={16} color={C.accent} />}
                  label="Team Members"
                  count={team?.length ?? '—'}
                  sub="Active members"
                  onClick={() => setTab('team')}
                  color={C.accent}
                />
                <StatCard
                  icon={<MapPin size={16} color={C.blue} />}
                  label="Offices"
                  count={offices?.length ?? 0}
                  sub={offices && offices.length > 0 ? offices.map(o => o.city).join(', ') : 'No offices added'}
                  onClick={() => setShowOffices(true)}
                  color={C.blue}
                />
                <StatCard
                  icon={<BriefcaseIcon size={16} color="#7C3AED" />}
                  label="Departments"
                  count={departments?.length ?? 0}
                  sub={departments && departments.length > 0 ? departments.slice(0, 2).map(d => d.name).join(', ') + (departments.length > 2 ? '…' : '') : 'No departments added'}
                  onClick={() => setShowDepts(true)}
                  color="#7C3AED"
                />
              </div>

              {/* Manage cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* Offices card */}
                <div style={{ ...DS.card }}>
                  <div style={DS.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <MapPin size={14} color={C.blue} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Offices</span>
                      {offices && offices.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, background: C.blueBg, padding: '1px 7px', borderRadius: 20 }}>
                          {offices.length}
                        </span>
                      )}
                    </div>
                    {canEditCompany && (
                      <button onClick={() => setShowOffices(true)} style={{ ...DS.btnSecondary, fontSize: 12, padding: '4px 10px' }}>
                        <Settings size={12} />Manage
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {!offices || offices.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <p style={{ fontSize: 12, color: C.ink3, margin: '0 0 10px' }}>No office locations added yet.</p>
                        {canEditCompany && (
                          <button onClick={() => setShowOffices(true)} style={{ ...DS.btnPrimary, fontSize: 12, padding: '6px 14px' }}>
                            <Plus size={12} />Add Office
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {offices.slice(0, 3).map(o => (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.ink1 }}>{o.name}</span>
                            {o.is_headquarters && <span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>HQ</span>}
                            <span style={{ fontSize: 11, color: C.ink3, marginLeft: 'auto' }}>{o.city}</span>
                          </div>
                        ))}
                        {offices.length > 3 && (
                          <button onClick={() => setShowOffices(true)} style={{ ...DS.btnGhost, fontSize: 11, paddingLeft: 0 }}>
                            +{offices.length - 3} more locations
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Departments card */}
                <div style={{ ...DS.card }}>
                  <div style={DS.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <BriefcaseIcon size={14} color="#7C3AED" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Departments</span>
                      {departments && departments.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#FAF5FF', padding: '1px 7px', borderRadius: 20 }}>
                          {departments.length}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to="/app/employer/departments" style={{ ...DS.btnSecondary, fontSize: 12, padding: '4px 10px', textDecoration: 'none' }}>
                        Full view <ChevronRight size={11} />
                      </Link>
                      {canManageDepts && (
                        <button onClick={() => setShowDepts(true)} style={{ ...DS.btnSecondary, fontSize: 12, padding: '4px 10px' }}>
                          <Settings size={12} />Manage
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {!departments || departments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <p style={{ fontSize: 12, color: C.ink3, margin: '0 0 10px' }}>No departments set up yet.</p>
                        {canManageDepts && (
                          <button onClick={() => setShowDepts(true)} style={{ ...DS.btnPrimary, fontSize: 12, padding: '6px 14px' }}>
                            <Plus size={12} />Add Department
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {departments.map(d => (
                          <span key={d.id} style={{
                            fontSize: 12, fontWeight: 600, color: '#7C3AED',
                            background: '#FAF5FF', border: '1px solid #E9D5FF',
                            borderRadius: 20, padding: '4px 12px',
                          }}>
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Permissions — for scoped users only */}
              {showMyPerms && perms && (
                <div style={{ ...DS.card }}>
                  <div style={DS.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ShieldCheck size={14} color={C.accent} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Your Access</span>
                    </div>
                    <button onClick={() => setShowPerms(true)} style={{ ...DS.btnSecondary, fontSize: 12, padding: '4px 10px' }}>
                      View details
                    </button>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      ...(ROLE_COLORS[perms.role_name] ?? { background: C.bg, color: C.ink2 }),
                    }}>
                      {ROLE_LABELS[perms.role_name] ?? perms.role_name}
                    </span>
                    <span style={{ fontSize: 12, color: C.ink2 }}>
                      {perms.department_name ? `Scoped to ${perms.department_name}` : 'Company-wide access'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TEAM TAB ── */}
          {tab === 'team' && (
            <div style={DS.card}>
              <div style={DS.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Users size={14} color={C.accent} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Team Members</span>
                  {team && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentBg, padding: '1px 7px', borderRadius: 20 }}>
                      {team.length}
                    </span>
                  )}
                </div>
                {canInvite && (
                  <button onClick={() => setShowInvite(true)} style={DS.btnPrimary}>
                    <Plus size={13} />Invite Member
                  </button>
                )}
              </div>

              {teamLoading ? (
                <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>Loading…</p>
              ) : !team || team.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                  <Users size={28} color={C.ink3} style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: '0 0 6px' }}>No team members yet</p>
                  <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 16px' }}>Invite your team to start collaborating on hiring.</p>
                  {canInvite && (
                    <button onClick={() => setShowInvite(true)} style={DS.btnPrimary}>
                      <Plus size={13} />Invite First Member
                    </button>
                  )}
                </div>
              ) : (
                team.map((m, idx) => {
                  const rc = ROLE_COLORS[m.role_name] ?? { bg: C.bg, color: C.ink2 }
                  return (
                    <div
                      key={m.employer_profile_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px',
                        borderBottom: idx < team.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                      }}
                    >
                      <Avatar name={m.contact_person} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>{m.contact_person}</span>
                          {m.is_owner && <Crown size={13} color={C.amber} />}
                        </div>
                        <span style={{ fontSize: 12, color: C.ink2 }}>{m.email ?? m.phone}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {/* Role badge */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: rc.bg, color: rc.color,
                        }}>
                          {ROLE_LABELS[m.role_name] ?? m.role_name}
                        </span>

                        {/* Dept selector / badge */}
                        {departments && departments.length > 0 && canManageDepts ? (
                          <select
                            value={m.department_id ?? ''}
                            onChange={e => assignDept.mutate({ employerProfileId: m.employer_profile_id, departmentId: e.target.value || null })}
                            style={{ ...DS.select, fontSize: 12, padding: '3px 8px', height: 28 }}
                          >
                            <option value="">No dept</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        ) : m.department_name ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#FAF5FF', padding: '3px 9px', borderRadius: 20 }}>
                            {m.department_name}
                          </span>
                        ) : null}

                        {/* Actions */}
                        {!m.is_owner && canTransfer && (
                          <button
                            onClick={() => transferOwnership.mutate(m.employer_profile_id)}
                            disabled={transferOwnership.isPending}
                            style={{ ...DS.btnGhost, fontSize: 11, color: C.amber, fontWeight: 600 }}
                          >
                            Make owner
                          </button>
                        )}
                        {!m.is_owner && canRemove && (
                          <button
                            onClick={() => removeMember.mutate(m.employer_profile_id)}
                            disabled={removeMember.isPending}
                            style={{ ...DS.btnIcon, color: C.red, border: 'none' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {tab === 'activity' && (
            <div style={DS.card}>
              <div style={DS.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Activity size={14} color={C.blue} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Team Activity</span>
                </div>
                <span style={{ fontSize: 11, color: C.ink3 }}>Last 50 actions</span>
              </div>
              {activityLoading ? (
                <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>Loading…</p>
              ) : !activity || activity.length === 0 ? (
                <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>No team activity recorded yet.</p>
              ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {activity.map((entry, idx) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 16px',
                        borderBottom: idx < activity.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: C.accentBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Activity size={13} color={C.accent} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0 }}>
                          {formatAction(entry.action)}
                        </p>
                        <p style={{ fontSize: 11, color: C.ink2, margin: '2px 0 0' }}>
                          {entry.actor_name ?? entry.actor_email ?? 'Unknown'}
                          {entry.resource ? ` · ${entry.resource}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, color: C.ink3, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showInvite     && <InviteModal onClose={() => setShowInvite(false)} />}
      {showOffices    && <OfficesModal onClose={() => setShowOffices(false)} />}
      {showDepts      && <DepartmentsModal onClose={() => setShowDepts(false)} />}
      {showEditDesc   && <EditDescriptionModal current={company?.description ?? ''} onClose={() => setShowEditDesc(false)} />}
      {showPerms      && <PermissionsModal onClose={() => setShowPerms(false)} />}
    </div>
  )
}
