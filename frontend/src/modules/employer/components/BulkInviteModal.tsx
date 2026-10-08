import { useMemo, useState } from 'react'
import { CheckCircle, XCircle, Mail } from 'lucide-react'
import { useDepartments, useEmployerPermissions, useInviteTeamMembersBulk } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamBulkInviteResponse, TeamBulkInvitePayload } from '@/api/company'
import { C } from '../ds'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import Modal from '@/shared/components/overlays/Modal'

type Role = TeamBulkInvitePayload['role_name']

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'recruiter',      label: 'Recruiter',      desc: 'Post jobs, manage candidates in their department' },
  { value: 'hiring_manager', label: 'Hiring Manager', desc: 'Review shortlists, submit scorecards' },
  { value: 'interviewer',    label: 'Interviewer',    desc: 'Conduct interviews, submit feedback' },
  { value: 'hr_manager',     label: 'HR Manager / Department Head', desc: 'Full access — company-wide, or leads one department if you pick one' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fieldBox: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 8,
  fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box',
}

/** Invite one or many people by email only. The system generates each
 *  password and emails it with the login link — nobody types a password. */
export default function BulkInviteModal({ onClose, departmentId, departmentName }: {
  onClose: () => void
  /** When set, everyone is added to this department and the picker is hidden. */
  departmentId?: string
  departmentName?: string
}) {
  const invite = useInviteTeamMembersBulk()
  const { data: departments } = useDepartments()
  const { data: perms } = useEmployerPermissions()
  // Only company-wide users appoint department heads; a head adds people to their own department.
  const canAppointHead = perms?.is_company_wide ?? false
  const roles = ROLES
    .filter(r => canAppointHead || r.value !== 'hr_manager')
    .map(r => r.value === 'hr_manager' && departmentId ? { ...r, label: 'Department Head', desc: 'Leads this department and can add its team members' } : r)
  const [raw, setRaw] = useState('')
  const [role, setRole] = useState<Role>('recruiter')
  const [deptId, setDeptId] = useState('')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<TeamBulkInviteResponse | null>(null)

  const emails = useMemo(
    () => Array.from(new Set(raw.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))),
    [raw],
  )
  const invalid = emails.filter(e => !EMAIL_RE.test(e))

  const handleSubmit = () => {
    if (emails.length === 0) { setErr('Add at least one email address'); return }
    if (emails.length > 25)  { setErr('You can invite up to 25 people at a time'); return }
    if (invalid.length > 0)  { setErr(`Not a valid email: ${invalid[0]}`); return }
    invite.mutate(
      { emails, role_name: role, department_id: departmentId || deptId || undefined },
      { onSuccess: setResult, onError: e => setErr(getApiError(e)) },
    )
  }

  if (result) {
    const failed = result.results.filter(r => !r.success)
    return (
      <Modal open onClose={onClose} title={result.created_count > 0 ? 'Invitations sent' : 'No one was invited'} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.created_count > 0 && (
            <p style={{ fontSize: 13, color: C.ink2, margin: 0, lineHeight: 1.6 }}>
              {result.created_count} {result.created_count === 1 ? 'person was' : 'people were'} added
              {departmentName ? <> to <strong>{departmentName}</strong></> : null}. Each will get an email with a
              system-generated password and the login link.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {result.results.map(r => (
              <div key={r.email} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8,
                background: r.success ? '#F0FDF4' : '#FEF2F2',
              }}>
                {r.success ? <CheckCircle size={15} color="#16A34A" style={{ marginTop: 1 }} /> : <XCircle size={15} color="#DC2626" style={{ marginTop: 1 }} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, wordBreak: 'break-all' }}>{r.email}</p>
                  {!r.success && <p style={{ fontSize: 11, color: '#DC2626', margin: '2px 0 0' }}>{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
          {failed.length > 0 && result.created_count > 0 && (
            <p style={{ fontSize: 11, color: C.ink3, margin: 0 }}>The others were added; fix the {failed.length} above and invite them again.</p>
          )}
          <Button variant="primary" size="sm" fullWidth onClick={onClose}>Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Invite team members" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {departmentName && <p style={{ fontSize: 12, color: C.ink2, margin: 0 }}>to <strong>{departmentName}</strong></p>}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>
            Email addresses <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <textarea
            value={raw}
            onChange={e => { setRaw(e.target.value); setErr('') }}
            placeholder={'priya@company.com, rahul@company.com\n(separate with commas, spaces or new lines)'}
            rows={4}
            autoFocus
            style={{ ...fieldBox, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <p style={{ fontSize: 11, color: invalid.length ? '#DC2626' : C.ink3, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={11} />
            {emails.length === 0
              ? 'We generate a password for each person and email it to them with the login link.'
              : invalid.length
                ? `${invalid.length} invalid: ${invalid.slice(0, 2).join(', ')}${invalid.length > 2 ? '…' : ''}`
                : `${emails.length} ${emails.length === 1 ? 'person' : 'people'} to invite`}
          </p>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value as Role)} style={{ ...fieldBox, cursor: 'pointer' }}>
            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p style={{ fontSize: 11, color: C.ink3, margin: '4px 0 0' }}>{roles.find(r => r.value === role)?.desc}</p>
        </div>

        {!departmentId && canAppointHead && departments && departments.length > 0 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Department</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)} style={{ ...fieldBox, cursor: 'pointer' }}>
              <option value="">— Company-wide —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button variant="outline" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={invite.isPending}>Cancel</Button>
          <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit} loading={invite.isPending}>
            {emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
