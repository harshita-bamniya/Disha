import type { CSSProperties, ReactNode } from 'react'
import Badge from '@/shared/components/data-display/Badge'
import { C } from '../../ds'
import type { ReferralStatus, RewardStatus } from '@/api/referrals'

export const money = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const REFERRAL_LABEL: Record<ReferralStatus, string> = {
  invited: 'Invited', applied: 'Applied', in_process: 'In process', hired: 'Hired', rejected: 'Not selected', withdrawn: 'Withdrew',
}
const REFERRAL_COLOR: Record<ReferralStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  invited: 'gray', applied: 'blue', in_process: 'amber', hired: 'green', rejected: 'red', withdrawn: 'gray',
}
export const ReferralBadge = ({ status }: { status: ReferralStatus }) =>
  <Badge color={REFERRAL_COLOR[status]}>{REFERRAL_LABEL[status]}</Badge>

const REWARD_LABEL: Record<RewardStatus, string> = {
  pending: 'In retention period', eligible: 'Ready to approve', approved: 'Approved', paid: 'Paid', rejected: 'Declined', cancelled: 'Cancelled',
}
const REWARD_COLOR: Record<RewardStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'navy'> = {
  pending: 'gray', eligible: 'amber', approved: 'blue', paid: 'green', rejected: 'red', cancelled: 'red',
}
export const RewardBadge = ({ status }: { status: RewardStatus }) =>
  <Badge color={REWARD_COLOR[status]}>{REWARD_LABEL[status]}</Badge>

export const EVENT_LABEL: Record<string, string> = {
  created: 'Referral recorded', status_changed: 'Status changed', reward_created: 'Bonus created', reward_eligible: 'Bonus became payable',
  reward_approved: 'Bonus approved', reward_paid: 'Bonus paid', reward_rejected: 'Bonus declined', reward_cancelled: 'Bonus cancelled',
}

export function Card({ children, style, pad = 20 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: pad, ...style }}>
      {children}
    </section>
  )
}

export const H = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div style={{ marginBottom: 12 }}>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink1 }}>{children}</h3>
    {sub && <p style={{ margin: '3px 0 0', fontSize: 12, color: C.ink2 }}>{sub}</p>}
  </div>
)

export const selectStyle: CSSProperties = {
  height: 34, fontSize: 13, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.ink1,
}

export const inputStyle: CSSProperties = { ...selectStyle, minWidth: 0 }

export function Th({ cols, template }: { cols: string[]; template: string }) {
  return (
    <div role="row" style={{ display: 'grid', gridTemplateColumns: template, gap: 12, padding: '8px 16px', background: '#EAECF0', borderBottom: `1px solid ${C.border}` }}>
      {cols.map(c => (
        <span key={c || 'x'} role="columnheader" style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c}</span>
      ))}
    </div>
  )
}

export const rowStyle = (template: string, last: boolean): CSSProperties => ({
  display: 'grid', gridTemplateColumns: template, gap: 12, alignItems: 'center', padding: '11px 16px',
  borderBottom: last ? 'none' : `1px solid ${C.borderLight}`, fontSize: 13, color: C.ink1,
})

export const ellipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }
