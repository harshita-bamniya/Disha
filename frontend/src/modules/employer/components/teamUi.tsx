import { colors } from '@/design-system/tokens'
import { C } from '../ds'

/** Roles an employer can give a teammate, as one source of truth for the team page, the invite
 * popup and the department page. */
export interface RoleInfo {
  label: string
  /** One line: what this person is for. */
  summary: string
  /** What they can do, shown on the invite popup's role cards. */
  can: string[]
}

export const ROLE_INFO: Record<string, RoleInfo> = {
  hr_manager: {
    label: 'HR Manager',
    summary: 'Runs hiring: posts jobs, manages candidates, invites teammates',
    can: ['Post, edit and publish jobs', 'See and manage candidates', 'Invite teammates', 'View analytics'],
  },
  recruiter: {
    label: 'Recruiter',
    summary: 'Posts jobs and manages candidates in their department',
    can: ['Post and edit jobs in their department', 'See and manage that department’s candidates'],
  },
  hiring_manager: {
    label: 'Hiring Manager',
    summary: 'Reviews shortlisted candidates and decides',
    can: ['See candidates', 'Move candidates between stages', 'Add notes, ratings and scorecards'],
  },
  interviewer: {
    label: 'Interviewer',
    summary: 'Takes interviews and gives feedback',
    can: ['Run assigned interviews', 'Submit feedback', 'See only the candidates assigned to them'],
  },
}

export const roleLabel = (role: string, departmentScoped = false): string => {
  if (role === 'employer' || role === 'employer_owner') return 'Owner'
  if (role === 'hr_manager' && departmentScoped) return 'Department Head'
  return ROLE_INFO[role]?.label ?? role
}

export const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  employer:        { bg: '#FFF7ED', color: '#D97706' },
  employer_owner:  { bg: '#FFF7ED', color: '#D97706' },
  hr_manager:      { bg: C.accentBg, color: C.accent },
  hiring_manager:  { bg: '#F0FDF4', color: '#16A34A' },
  recruiter:       { bg: C.blueBg, color: C.blue },
  interviewer:     { bg: '#FAF5FF', color: '#7C3AED' },
}

export function RoleBadge({ role, departmentScoped = false }: { role: string; departmentScoped?: boolean }) {
  const rc = ROLE_COLORS[role] ?? { bg: C.bg, color: C.ink2 }
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: rc.bg, color: rc.color, whiteSpace: 'nowrap',
    }}>
      {roleLabel(role, departmentScoped)}
    </span>
  )
}

/** Active / Invited / Expired, the same three states Greenhouse, Lever and LinkedIn show. */
const STATUS_STYLE = {
  active:  { label: 'Active',  fg: '#15803D', bg: '#F0FDF4', dot: '#16A34A' },
  invited: { label: 'Invited', fg: '#B45309', bg: '#FFFBEB', dot: '#D97706' },
  expired: { label: 'Expired', fg: '#B91C1C', bg: '#FEF2F2', dot: '#DC2626' },
} as const
export type PersonStatus = keyof typeof STATUS_STYLE

export function StatusPill({ status }: { status: PersonStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
      padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  )
}

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

export const mutedText = { fontSize: 12, color: colors.text.muted } as const
