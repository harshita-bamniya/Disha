import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ShieldCheck, Plus, Trash2, Crown, CheckCircle, RotateCcw, X, Mail } from 'lucide-react'
import {
  useTeamMembers, useRemoveTeamMember,
  useTeamInvites, useResendTeamInvite, useRevokeTeamInvite,
  useDepartments, useAssignMemberDepartment,
  useHasPermission, useEmployerPermissions,
} from '../hooks/useJobs'
import BulkInviteModal from '../components/BulkInviteModal'
import OrgFlowGuide from '../components/OrgFlowGuide'
import { ROLE_INFO, RoleBadge, StatusPill, fmtDay, roleLabel, ROLE_COLORS, type PersonStatus } from '../components/teamUi'
import { C } from '../ds'
import { colors } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import Button from '@/shared/components/primitives/Button'
import Modal from '@/shared/components/overlays/Modal'
import Avatar from '@/shared/components/data-display/Avatar'
import Tabs from '@/shared/components/navigation/Tabs'
import type { TeamInviteEntry, TeamMemberEntry } from '@/api/company'

const selectStyle: React.CSSProperties = {
  appearance: 'none', WebkitAppearance: 'none', fontSize: 12, padding: '4px 26px 4px 10px', height: 30,
  border: `1px solid ${colors.border.default}`, borderRadius: 7, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
}

const COLS = 'minmax(220px, 1.6fr) 140px 170px 100px 150px'

type Filter = 'all' | 'active' | 'invited' | 'expired'
type Row =
  | { kind: 'member'; key: string; status: 'active'; member: TeamMemberEntry }
  | { kind: 'invite'; key: string; status: 'invited' | 'expired'; invite: TeamInviteEntry }

// ── "My access" popup for department-scoped people ────────────────────────────

function PermissionsModal({ onClose }: { onClose: () => void }) {
  const { data: perms } = useEmployerPermissions()
  if (!perms) return null
  const info = ROLE_INFO[perms.role_name]
  const rc = ROLE_COLORS[perms.role_name] ?? { bg: C.bg, color: C.ink2 }
  return (
    <Modal open title="Your access" onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={20} color={rc.color} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink1, margin: 0 }}>{roleLabel(perms.role_name, !perms.is_company_wide)}</p>
          <p style={{ fontSize: 12, color: C.ink2, margin: '2px 0 0' }}>
            {perms.department_name ? `Limited to ${perms.department_name}` : 'Can see every department'}
          </p>
        </div>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink2, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>What you can do</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(info?.can ?? []).map(p => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8 }}>
            <CheckCircle size={14} color="#16A34A" />
            <span style={{ fontSize: 13, color: C.ink1 }}>{p}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyTeamPage() {
  const { data: team, isLoading: teamLoading } = useTeamMembers()
  const { data: departments } = useDepartments()
  const { data: perms } = useEmployerPermissions()

  const canInvite      = useHasPermission('team:invite')
  const canRemove      = useHasPermission('team:remove')
  const canManageDepts = useHasPermission('companies:edit')
  const { data: invites } = useTeamInvites(canInvite)

  const removeMember = useRemoveTeamMember()
  const assignDept = useAssignMemberDepartment()
  const resend = useResendTeamInvite()
  const revoke = useRevokeTeamInvite()

  const [filter, setFilter] = useState<Filter>('all')
  const [showInvite, setShowInvite] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const [notice, setNotice] = useState('')

  const rows: Row[] = useMemo(() => {
    const members: Row[] = (team ?? []).map(m => ({ kind: 'member', key: `m-${m.employer_profile_id}`, status: 'active', member: m }))
    const waiting: Row[] = (invites ?? []).map(i => ({ kind: 'invite', key: `i-${i.id}`, status: i.status === 'expired' ? 'expired' : 'invited', invite: i }))
    return [...members, ...waiting]
  }, [team, invites])

  const count = (s: PersonStatus) => rows.filter(r => r.status === s).length
  const visible = rows.filter(r => filter === 'all' || r.status === filter)
  const showMyPerms = perms && !perms.is_company_wide

  const tabs = [
    { key: 'all', label: 'Everyone', count: rows.length },
    { key: 'active', label: 'Active', count: count('active') },
    { key: 'invited', label: 'Invited', count: count('invited') },
    { key: 'expired', label: 'Expired', count: count('expired') },
  ]

  const deptCell = (deptId: string | null, deptName: string | null, editableFor?: TeamMemberEntry) => {
    if (editableFor && departments && departments.length > 0 && canManageDepts && !editableFor.is_owner) {
      return (
        <select
          aria-label={`Department for ${editableFor.contact_person || editableFor.email}`}
          value={deptId ?? ''}
          onChange={e => assignDept.mutate({ employerProfileId: editableFor.employer_profile_id, departmentId: e.target.value || null })}
          style={selectStyle}
        >
          <option value="">Company-wide</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )
    }
    return deptName
      ? <span style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>{deptName}</span>
      : <span style={{ fontSize: 12, color: C.ink3 }}>Company-wide</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Team"
        subtitle="The people who can sign in to your hiring workspace, and what each of them can do"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {showMyPerms && (
              <Button variant="outline" size="sm" onClick={() => setShowPerms(true)}><ShieldCheck size={13} />My access</Button>
            )}
            {canInvite && (
              <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}><Plus size={13} />Invite people</Button>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, padding: '24px 28px', background: colors.surface.bg }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <OrgFlowGuide here="team" />

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Tabs tabs={tabs} active={filter} onChange={k => setFilter(k as Filter)} variant="pill" />
              <span style={{ fontSize: 12, color: C.ink3 }}>
                Invited people aren’t members until they accept. No account exists for them before that.
              </span>
            </div>

            {teamLoading ? (
              <p style={{ padding: 24, fontSize: 13, color: C.ink3 }}>Loading…</p>
            ) : visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '44px 24px' }}>
                <Users size={28} color={C.ink3} style={{ marginBottom: 10 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: '0 0 6px' }}>
                  {filter === 'all' ? 'Nobody here yet' : `No ${filter} people`}
                </p>
                <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 16px' }}>
                  {filter === 'all' ? 'Invite your first teammate. They will get an email to set up their own account.' : 'Change the filter to see everyone.'}
                </p>
                {canInvite && filter === 'all' && (
                  <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}><Plus size={13} />Invite people</Button>
                )}
              </div>
            ) : (
              <div role="table" aria-label="Team members and invitations" style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '8px 20px', background: colors.surface.elevated, borderBottom: `1px solid ${C.border}` }}>
                    {['Person', 'Role', 'Department', 'Status', ''].map(h => (
                      <span key={h || 'actions'} role="columnheader" style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
                    ))}
                  </div>

                  {visible.map((r, idx) => {
                    const last = idx === visible.length - 1
                    const base: React.CSSProperties = {
                      display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '12px 20px',
                      borderBottom: last ? 'none' : `1px solid ${C.borderLight}`,
                    }
                    if (r.kind === 'member') {
                      const m = r.member
                      return (
                        <div key={r.key} role="row" style={base}>
                          <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <Avatar name={m.contact_person || m.email || '?'} size={36} shape="rounded" />
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.contact_person || m.email}</span>
                                {m.is_owner && <Crown size={13} color={C.amber} style={{ flexShrink: 0 }} />}
                              </span>
                              <span style={{ fontSize: 12, color: C.ink2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email ?? m.phone}</span>
                            </div>
                          </div>
                          <div role="cell"><RoleBadge role={m.role_name} departmentScoped={!!m.department_id && !m.is_owner} /></div>
                          <div role="cell">{deptCell(m.department_id, m.department_name, m)}</div>
                          <div role="cell"><StatusPill status="active" /></div>
                          <div role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {!m.is_owner && canRemove && (
                              <Button variant="ghost" size="icon" style={{ color: C.red }} disabled={removeMember.isPending}
                                aria-label={`Remove ${m.contact_person || 'member'}`}
                                onClick={() => { if (window.confirm(`Remove ${m.contact_person || m.email}? They will lose access immediately.`)) removeMember.mutate(m.employer_profile_id) }}>
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    }
                    const inv = r.invite
                    const expired = r.status === 'expired'
                    return (
                      <div key={r.key} role="row" style={{ ...base, background: expired ? '#FFFBFB' : undefined }}>
                        <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px dashed ${colors.border.strong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Mail size={15} color={C.ink3} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
                            <span style={{ fontSize: 12, color: C.ink3, display: 'block' }}>
                              Sent {fmtDay(inv.last_sent_at ?? inv.created_at)}{inv.invited_by_name ? ` by ${inv.invited_by_name}` : ''}
                              {inv.expires_at ? ` · ${expired ? 'expired' : 'expires'} ${fmtDay(inv.expires_at)}` : ''}
                            </span>
                          </div>
                        </div>
                        <div role="cell"><RoleBadge role={inv.role_name} departmentScoped={!!inv.department_id} /></div>
                        <div role="cell">{deptCell(inv.department_id, inv.department_name)}</div>
                        <div role="cell"><StatusPill status={expired ? 'expired' : 'invited'} /></div>
                        <div role="cell" style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <Button variant="outline" size="sm" disabled={resend.isPending}
                            onClick={() => resend.mutate(inv.id, { onSuccess: () => setNotice(`Invitation sent again to ${inv.email}.`) })}>
                            <RotateCcw size={12} />{expired ? 'Send again' : 'Resend'}
                          </Button>
                          <Button variant="ghost" size="icon" style={{ color: C.red }} disabled={revoke.isPending}
                            aria-label={`Cancel invitation for ${inv.email}`}
                            onClick={() => revoke.mutate(inv.id, { onSuccess: () => setNotice(`Invitation for ${inv.email} cancelled.`) })}>
                            <X size={14} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {notice && <p role="status" style={{ margin: 0, padding: '10px 20px', fontSize: 12, color: C.ink2, borderTop: `1px solid ${C.borderLight}` }}>{notice}</p>}
          </div>

          <details style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 18px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.ink1 }}>What can each role do?</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
              {(['hr_manager', 'recruiter', 'hiring_manager', 'interviewer'] as const).map(role => (
                <div key={role} style={{ padding: '10px 12px', borderRadius: 10, background: colors.surface.bg }}>
                  <RoleBadge role={role} />
                  <p style={{ margin: '6px 0 4px', fontSize: 12, color: C.ink2 }}>{ROLE_INFO[role].summary}</p>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: C.ink3, lineHeight: 1.6 }}>
                    {ROLE_INFO[role].can.map(c => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: C.ink3 }}>
              An HR Manager placed in a department becomes that department’s head. Everyone except company-wide people
              only sees their own department.
            </p>
          </details>

          <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
            Looking for your org structure? See <Link to="/app/employer/departments" style={{ color: colors.brand.navy, fontWeight: 600 }}>Departments</Link>.
            Branding and offices live in <Link to="/app/employer/profile" style={{ color: colors.brand.navy, fontWeight: 600 }}>Company Profile</Link>.
          </p>
        </div>
      </div>

      {showInvite && <BulkInviteModal onClose={() => setShowInvite(false)} />}
      {showPerms  && <PermissionsModal onClose={() => setShowPerms(false)} />}
    </div>
  )
}
