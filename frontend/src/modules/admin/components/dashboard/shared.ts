import type { CSSProperties } from 'react'
import { colors, shadows } from '@/design-system/tokens'
import type { AttentionResponse, AttentionRow } from '@/api/adminDashboard'

export const card: CSSProperties = {
  background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 16, boxShadow: shadows.card,
}

export const cardTitle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: colors.text.ink }
export const cardSub: CSSProperties = { margin: '2px 0 0', fontSize: 12, color: colors.text.muted }

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "16d", "5h", "under 1h": short enough for a chip. */
export function shortAge(hours: number | null): string {
  if (hours == null) return ''
  if (hours < 1) return 'under 1h'
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

/** The full sentence for a queue (used as the chip's tooltip and accessible name). */
export function describeQueue(row: AttentionRow, t: AttentionResponse['targets']): string {
  const noun: Record<string, string> = {
    verifications: 'waiting for review', tickets: 'open', safety: 'not reviewed yet', appeals: 'open', payments: 'past due',
  }
  const bits: string[] = []
  if (row.count > 0) bits.push(`${row.count} ${noun[row.key]}`)
  for (const p of row.parts) bits.push(`${p.count} ${p.label}`)
  if (row.oldest_age_hours != null) bits.push(`oldest ${shortAge(row.oldest_age_hours)}`)
  if (row.overdue > 0) {
    bits.push(row.key === 'verifications'
      ? `${row.overdue} past the ${t.verification_days}-day target`
      : `${row.overdue} with no reply after ${t.ticket_first_response_hours} hours`)
  }
  if (row.note) bits.push(row.note)
  return `${row.label}: ${bits.join(', ')}`
}
