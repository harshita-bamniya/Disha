import { useState } from 'react'
import { RotateCcw, X, Mail } from 'lucide-react'
import { useResendTeamInvite, useRevokeTeamInvite, useUpdateDepartment } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { DepartmentEntry, TeamInviteEntry } from '@/api/company'

/** The few fields of a team member this card needs, so it works with any list that has them. */
type PersonLike = { employer_profile_id: string; contact_person: string; email?: string | null }
import Button from '@/shared/components/primitives/Button'
import Avatar from '@/shared/components/data-display/Avatar'
import { RoleBadge, StatusPill, fmtDay } from './teamUi'
import { colors } from '@/design-system/tokens'

const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: `1px solid ${colors.border.default}`, overflow: 'hidden' }
const sel: React.CSSProperties = { height: 34, borderRadius: 8, border: `1px solid ${colors.border.medium}`, padding: '0 10px', fontSize: 13, background: '#fff', color: colors.text.ink }

/** Who leads this department: a person, someone who has been invited and hasn't accepted yet, or nobody.
 * Company-wide users can assign or clear the head from the people already in the department. */
export function DepartmentHeadCard({ dept, members, canAssign }: {
  dept: DepartmentEntry
  members: PersonLike[]
  canAssign: boolean
}) {
  const update = useUpdateDepartment()
  const [pick, setPick] = useState('')
  const [err, setErr] = useState('')
  const head = members.find(m => m.employer_profile_id === dept.head_employer_id)

  const save = (headId: string | null) =>
    update.mutate({ id: dept.id, payload: { head_employer_id: headId } }, {
      onSuccess: () => { setPick(''); setErr('') }, onError: e => setErr(getApiError(e)),
    })

  return (
    <div style={{ ...card, padding: '14px 20px' }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.text.muted }}>Department head</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {dept.head_name ? (
          <>
            <Avatar name={dept.head_name} size={36} shape="rounded" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text.ink }}>{dept.head_name}</p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: colors.text.muted }}>{head?.email ?? 'Leads this department'}</p>
            </div>
            {canAssign && (
              <Button variant="outline" size="sm" style={{ marginLeft: 'auto' }} loading={update.isPending} onClick={() => save(null)}>Remove as head</Button>
            )}
          </>
        ) : dept.head_pending_email ? (
          <>
            <StatusPill status="invited" />
            <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>
              <strong style={{ color: colors.text.ink }}>{dept.head_pending_email}</strong> was invited to lead this department and hasn’t accepted yet.
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>
            No head yet. The department still works; the owner covers it until you assign one.
          </p>
        )}
      </div>

      {canAssign && !dept.head_name && members.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Choose a head" style={sel}>
            <option value="">Choose from this department’s team…</option>
            {members.map(m => <option key={m.employer_profile_id} value={m.employer_profile_id}>{m.contact_person || m.email}</option>)}
          </select>
          <Button size="sm" disabled={!pick} loading={update.isPending} onClick={() => save(pick)}>Make head</Button>
        </div>
      )}
      {err && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#DC2626' }}>{err}</p>}
    </div>
  )
}

/** Invitations for this department that haven't been accepted yet. Not members; no account exists for them. */
export function DepartmentInvites({ invites }: { invites: TeamInviteEntry[] }) {
  const resend = useResendTeamInvite()
  const revoke = useRevokeTeamInvite()
  const [notice, setNotice] = useState('')
  if (invites.length === 0) return null
  return (
    <div style={card}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text.ink }}>Waiting to join</p>
        <span style={{ fontSize: 12, color: colors.text.muted }}>{invites.length} invited. They aren’t members until they accept.</span>
      </div>
      {invites.map((inv, i) => {
        const expired = inv.status === 'expired'
        return (
          <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 20px', borderBottom: i < invites.length - 1 ? `1px solid ${colors.border.default}` : 'none' }}>
            <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px dashed ${colors.border.strong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={14} color={colors.text.muted} />
            </span>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: colors.text.muted }}>
                Sent {fmtDay(inv.last_sent_at ?? inv.created_at)}{inv.expires_at ? ` · ${expired ? 'expired' : 'expires'} ${fmtDay(inv.expires_at)}` : ''}
              </p>
            </div>
            <RoleBadge role={inv.role_name} departmentScoped />
            <StatusPill status={expired ? 'expired' : 'invited'} />
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="outline" size="sm" disabled={resend.isPending}
                onClick={() => resend.mutate(inv.id, { onSuccess: () => setNotice(`Invitation sent again to ${inv.email}.`) })}>
                <RotateCcw size={12} />{expired ? 'Send again' : 'Resend'}
              </Button>
              <Button variant="ghost" size="icon" style={{ color: '#DC2626' }} aria-label={`Cancel invitation for ${inv.email}`} disabled={revoke.isPending}
                onClick={() => revoke.mutate(inv.id, { onSuccess: () => setNotice(`Invitation for ${inv.email} cancelled.`) })}>
                <X size={14} />
              </Button>
            </div>
          </div>
        )
      })}
      {notice && <p role="status" style={{ margin: 0, padding: '10px 20px', fontSize: 12, color: colors.text.inkSoft, borderTop: `1px solid ${colors.border.default}` }}>{notice}</p>}
    </div>
  )
}
