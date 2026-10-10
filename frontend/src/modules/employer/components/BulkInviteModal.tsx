import { useMemo, useState } from 'react'
import { CheckCircle, XCircle, Mail, Check } from 'lucide-react'
import { useDepartments, useEmployerPermissions, useInviteTeamMembersBulk } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamBulkInviteResponse, TeamBulkInvitePayload } from '@/api/company'
import { ROLE_INFO } from './teamUi'
import { C } from '../ds'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import Modal from '@/shared/components/overlays/Modal'

type Role = TeamBulkInvitePayload['role_name']

const ROLE_ORDER: Role[] = ['recruiter', 'hiring_manager', 'interviewer', 'hr_manager']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fieldBox: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: `1px solid ${colors.border.medium}`, borderRadius: 8,
  fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box',
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: colors.text.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', background: colors.brand.navy, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
        {title}
      </p>
      {hint && <p style={{ margin: '0 0 8px 28px', fontSize: 12, color: colors.text.muted }}>{hint}</p>}
      <div style={{ marginLeft: 28 }}>{children}</div>
    </div>
  )
}

/** Invite one or many people. Each gets an emailed link to accept and choose their own password;
 *  no account exists until they do, and until then they show as "Invited" on the Team page. */
export default function BulkInviteModal({ onClose, departmentId, departmentName }: {
  onClose: () => void
  /** When set, everyone is invited into this department and the department picker is hidden. */
  departmentId?: string
  departmentName?: string
}) {
  const invite = useInviteTeamMembersBulk()
  const { data: departments } = useDepartments()
  const { data: perms } = useEmployerPermissions()
  // Only company-wide users appoint department heads; a head adds people to their own department.
  const canAppointHead = perms?.is_company_wide ?? false
  const roles = ROLE_ORDER.filter(r => canAppointHead || r !== 'hr_manager')

  const [raw, setRaw] = useState('')
  const [role, setRole] = useState<Role>('recruiter')
  const [deptId, setDeptId] = useState('')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<TeamBulkInviteResponse | null>(null)

  const chosenDeptId = departmentId || deptId
  const chosenDeptName = departmentName ?? departments?.find(d => d.id === deptId)?.name
  const roleTitle = (r: Role) =>
    r === 'hr_manager' ? (chosenDeptId ? 'Department Head' : 'HR Manager') : ROLE_INFO[r].label

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
      { emails, role_name: role, department_id: chosenDeptId || undefined },
      { onSuccess: setResult, onError: e => setErr(getApiError(e)) },
    )
  }

  if (result) {
    const failed = result.results.filter(r => !r.success)
    return (
      <Modal open onClose={onClose} title={result.created_count > 0 ? 'Invitations sent' : 'No one was invited'} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.created_count > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: colors.surface.bg, fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
              <strong style={{ color: C.ink1 }}>{result.created_count} {result.created_count === 1 ? 'person has' : 'people have'} been invited
              {chosenDeptName ? <> to <strong>{chosenDeptName}</strong></> : null} as {roleTitle(role)}.</strong><br />
              They show as <strong>Invited</strong> on the Team page until they open their email and accept. The link works for 7 days;
              you can resend or cancel it from the Team page.
            </div>
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
                  {!r.success && <p style={{ fontSize: 12, color: '#DC2626', margin: '2px 0 0' }}>{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
          {failed.length > 0 && result.created_count > 0 && (
            <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>The others were sent. Fix the {failed.length} above and invite them again.</p>
          )}
          <Button variant="primary" size="sm" fullWidth onClick={onClose}>Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={departmentName ? `Invite people to ${departmentName}` : 'Invite people to your team'} width={540}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        <Step n={1} title="Who are you inviting?" hint="Work email addresses. You can paste several at once.">
          <textarea
            value={raw}
            onChange={e => { setRaw(e.target.value); setErr('') }}
            placeholder={'priya@company.com, rahul@company.com'}
            rows={3}
            autoFocus
            style={{ ...fieldBox, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <p style={{ fontSize: 12, color: invalid.length ? '#DC2626' : C.ink3, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={11} />
            {emails.length === 0
              ? 'Separate addresses with commas, spaces or new lines.'
              : invalid.length
                ? `${invalid.length} not valid: ${invalid.slice(0, 2).join(', ')}${invalid.length > 2 ? '…' : ''}`
                : `${emails.length} ${emails.length === 1 ? 'person' : 'people'} to invite`}
          </p>
        </Step>

        <Step n={2} title="What will they do?" hint="This sets what they can see and change.">
          <div role="radiogroup" aria-label="Role" style={{ display: 'grid', gap: 8 }}>
            {roles.map(r => {
              const selected = role === r
              return (
                <button
                  key={r} type="button" role="radio" aria-checked={selected} onClick={() => setRole(r)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit',
                    border: `${selected ? 2 : 1}px solid ${selected ? colors.brand.navy : colors.border.medium}`,
                    background: selected ? colors.surface.bg : colors.surface.card,
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <span aria-hidden style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${selected ? colors.brand.navy : colors.border.strong}`,
                    background: selected ? colors.brand.navy : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{selected && <Check size={10} color="#fff" />}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.ink1 }}>{roleTitle(r)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.ink2, marginTop: 1 }}>
                      {r === 'hr_manager' && chosenDeptId ? `Leads ${chosenDeptName ?? 'this department'} and can invite its team` : ROLE_INFO[r].summary}
                    </span>
                    {selected && (
                      <span style={{ display: 'block', fontSize: 11.5, color: C.ink3, marginTop: 4 }}>
                        Can: {ROLE_INFO[r].can.join(' · ')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </Step>

        {!departmentId && canAppointHead && departments && departments.length > 0 && (
          <Step n={3} title="Which department?" hint="Recruiters, interviewers and managers only see their own department. Leave company-wide for people who work across all of them.">
            <select value={deptId} onChange={e => setDeptId(e.target.value)} style={{ ...fieldBox, cursor: 'pointer' }} aria-label="Department">
              <option value="">Company-wide (no specific department)</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Step>
        )}

        <div style={{ padding: '12px 14px', borderRadius: 10, background: colors.surface.bg, border: `1px solid ${colors.border.default}` }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: C.ink1 }}>What happens next</p>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.ink2, lineHeight: 1.7 }}>
            <li>Each person gets an email with a secure link (valid for 7 days).</li>
            <li>They choose their own name and password. You never see or send a password.</li>
            <li>Until they accept, they appear as <strong>Invited</strong> on the Team page, where you can resend or cancel.</li>
          </ol>
        </div>

        {err && <p role="alert" style={{ fontSize: 12.5, color: '#DC2626', margin: 0 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={invite.isPending}>Cancel</Button>
          <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit} loading={invite.isPending}>
            {emails.length > 1 ? `Send ${emails.length} invitations` : 'Send invitation'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
