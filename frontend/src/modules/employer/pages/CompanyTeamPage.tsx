import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, ShieldCheck, Plus, Trash2, Crown,
  Eye, EyeOff, CheckCircle, ChevronRight, Building2,
} from 'lucide-react'
import {
  useTeamMembers, useInviteTeamMember, useRemoveTeamMember, useTransferOwnership,
  useDepartments, useAssignMemberDepartment,
  useHasPermission, useEmployerPermissions,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamInvitePayload } from '@/api/company'
import { DS, C } from '../ds'
import { colors, radius } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import Button from '@/shared/components/primitives/Button'
import Modal from '@/shared/components/overlays/Modal'
import Avatar from '@/shared/components/data-display/Avatar'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer' }
// Native <select> chevrons render inconsistently across browsers — this
// mirrors the shared Select primitive's look (flat arrow, no default icon)
// so the per-row department picker doesn't stick out from the rest of the UI.
const deptSelectStyle: React.CSSProperties = {
  ...selectStyle, fontSize: 12, padding: '3px 26px 3px 10px', height: 28,
  appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  employer: 'Owner', employer_owner: 'Owner',
  hr_manager: 'HR Manager', hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter', interviewer: 'Interviewer',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  hr_manager:      'Full access to jobs and candidates — company-wide, or scoped to one department if you assign it (the "department head" role)',
  recruiter:       'Access scoped to their assigned department',
  hiring_manager:  'Can review candidates and provide interview feedback',
  interviewer:     'Can conduct interviews and submit feedback only',
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  hr_manager:     ['Post jobs', 'Edit jobs', 'Publish jobs', 'View all/dept candidates', 'Manage applications', 'Invite team members', 'View analytics'],
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

// ── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteTeamMember()
  const { data: departments } = useDepartments()
  const [form, setForm] = useState<TeamInvitePayload>({ email: '', contact_person: '', role_name: 'recruiter' })
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const needsDept = form.role_name === 'recruiter' || form.role_name === 'hiring_manager' || form.role_name === 'hr_manager'

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
    <Modal open={true} title="Member added" onClose={onClose} width={420}>
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
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: radius.xl,
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
        <Button variant="primary" size="sm" fullWidth onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )

  return (
    <Modal open={true} title="Invite team member" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name">
          <input
            value={form.contact_person}
            onChange={e => { setForm({ ...form, contact_person: e.target.value }); setErr('') }}
            placeholder="Jane Smith"
            autoFocus
            style={inputStyle}
          />
        </Field>
        <Field label="Email address">
          <input
            value={form.email}
            onChange={e => { setForm({ ...form, email: e.target.value }); setErr('') }}
            placeholder="jane@company.com"
            type="email"
            style={inputStyle}
          />
        </Field>
        <Field label="Password" hint="You set this — share it with them after creating the account.">
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setErr('') }}
              placeholder="Min. 6 characters"
              style={{ ...inputStyle, paddingRight: 36 }}
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
            style={{ ...selectStyle, width: '100%' }}
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
              style={{ ...selectStyle, width: '100%' }}
            >
              <option value="">— Company-wide —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="outline" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit} loading={invite.isPending}>
            Create account
          </Button>
        </div>
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
    <Modal open={true} title="Your Access & Permissions" onClose={onClose} width={420}>
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CompanyTeamPage() {
  const { data: team, isLoading: teamLoading } = useTeamMembers()
  const { data: departments } = useDepartments()
  const { data: perms } = useEmployerPermissions()
  const removeMember = useRemoveTeamMember()
  const transferOwnership = useTransferOwnership()
  const assignDept = useAssignMemberDepartment()

  const canInvite         = useHasPermission('team:invite')
  const canRemove         = useHasPermission('team:remove')
  const canTransfer       = useHasPermission('team:transfer_ownership')
  const canManageDepts    = useHasPermission('companies:edit')

  const [showInvite, setShowInvite] = useState(false)
  const [showPerms, setShowPerms] = useState(false)

  const showMyPerms = perms && !perms.is_company_wide

  const ownerCount    = (team ?? []).filter(m => m.is_owner).length
  const deptScoped    = (team ?? []).filter(m => m.department_id).length
  const companyWide   = (team ?? []).length - deptScoped

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Team"
        subtitle="Manage roles and access for your hiring team"
        actions={showMyPerms && (
          <Button variant="outline" size="sm" onClick={() => setShowPerms(true)}>
            <ShieldCheck size={13} />My Access
          </Button>
        )}
      />

      <div style={{ flex: 1, padding: '24px 28px', background: colors.surface.bg }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary strip */}
          {!teamLoading && team && team.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { icon: Users,       label: 'Total members',   value: team.length,  color: C.accent },
                { icon: Crown,       label: 'Owners',          value: ownerCount,   color: C.amber },
                { icon: ShieldCheck, label: 'Company-wide',    value: companyWide,  color: C.green },
                { icon: Building2,   label: 'Dept-scoped',     value: deptScoped,   color: '#7C3AED' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: radius.lg,
                  boxShadow: '0 1px 3px rgba(16,24,40,0.04)', padding: '12px 14px',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.ink1, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    <p style={{ fontSize: 11, color: C.ink3, margin: '3px 0 0', fontWeight: 500 }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Permissions — for scoped users only */}
          {showMyPerms && perms && (
            <div style={{ ...DS.card }}>
              <div style={DS.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ShieldCheck size={14} color={C.accent} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Your Access</span>
                </div>
                <Button variant="outline" size="sm" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowPerms(true)}>
                  View details
                </Button>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/app/employer/dashboard#activity" className="inline-flex items-center gap-1 border-[1.5px] border-[#1A2744] text-[#1A2744] font-semibold hover:bg-[#1A2744] hover:text-white transition-all duration-200 active:scale-[0.98] rounded-lg no-underline text-xs px-[10px] py-1">
                  View activity <ChevronRight size={11} />
                </Link>
                {canInvite && (
                  <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
                    <Plus size={13} />Invite Member
                  </Button>
                )}
              </div>
            </div>

            {teamLoading ? (
              <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>Loading…</p>
            ) : !team || team.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <Users size={28} color={C.ink3} style={{ marginBottom: 10 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: '0 0 6px' }}>No team members yet</p>
                <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 16px' }}>Invite your team to start collaborating on hiring.</p>
                {canInvite && (
                  <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
                    <Plus size={13} />Invite First Member
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'minmax(160px, 1.4fr) 120px minmax(120px, 160px) auto',
                  gap: 12, padding: '8px 20px', background: colors.surface.elevated,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {['Member', 'Role', 'Department', ''].map(col => (
                    <span key={col} style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</span>
                  ))}
                </div>
                {team.map((m, idx) => {
                const rc = ROLE_COLORS[m.role_name] ?? { bg: C.bg, color: C.ink2 }
                return (
                  <div
                    key={m.employer_profile_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(160px, 1.4fr) 120px minmax(120px, 160px) auto',
                      alignItems: 'center', gap: 12,
                      padding: '13px 20px',
                      borderBottom: idx < team.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = colors.surface.elevated }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Member */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <Avatar name={m.contact_person || m.email || '?'} size={38} shape="rounded" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.contact_person || m.email || m.phone}
                          </span>
                          {m.is_owner && <Crown size={13} color={C.amber} style={{ flexShrink: 0 }} />}
                        </div>
                        <span style={{ fontSize: 12, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {m.email ?? m.phone}
                        </span>
                      </div>
                    </div>

                    {/* Role badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                      textAlign: 'center', ...rc, justifySelf: 'start',
                    }}>
                      {ROLE_LABELS[m.role_name] ?? m.role_name}
                    </span>

                    {/* Dept selector / badge */}
                    <div style={{ justifySelf: 'start' }}>
                      {departments && departments.length > 0 && canManageDepts ? (
                        <select
                          value={m.department_id ?? ''}
                          onChange={e => assignDept.mutate({ employerProfileId: m.employer_profile_id, departmentId: e.target.value || null })}
                          style={deptSelectStyle}
                        >
                          <option value="">No dept</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : m.department_name ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#FAF5FF', padding: '3px 9px', borderRadius: 20 }}>
                          {m.department_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: C.ink3 }}>Company-wide</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, justifySelf: 'end' }}>
                      {!m.is_owner && canTransfer && (
                        <Button
                          variant="ghost" size="sm"
                          style={{ fontSize: 11, color: C.amber, fontWeight: 600, whiteSpace: 'nowrap' }}
                          onClick={() => transferOwnership.mutate(m.employer_profile_id)}
                          disabled={transferOwnership.isPending}
                        >
                          Make owner
                        </Button>
                      )}
                      {!m.is_owner && canRemove && (
                        <Button
                          variant="ghost" size="icon"
                          style={{ color: C.red }}
                          onClick={() => removeMember.mutate(m.employer_profile_id)}
                          disabled={removeMember.isPending}
                          aria-label={`Remove ${m.contact_person || 'member'}`}
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink3 }}>
            Looking for branding, offices, or org structure? See{' '}
            <Link to="/app/employer/profile" style={{ color: colors.state.info, fontWeight: 600, textDecoration: 'none' }}>Company Profile</Link>
            {' '}or{' '}
            <Link to="/app/employer/departments" style={{ color: colors.state.info, fontWeight: 600, textDecoration: 'none' }}>Departments</Link>.
          </div>

        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {showPerms  && <PermissionsModal onClose={() => setShowPerms(false)} />}
    </div>
  )
}
