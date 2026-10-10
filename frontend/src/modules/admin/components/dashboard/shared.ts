import type { AttentionResponse, AttentionRow } from '@/api/adminDashboard'
import { shortAge } from '@/shared/components/dashboard/styles'

export { card, cardSub, cardTitle, plural, shortAge } from '@/shared/components/dashboard/styles'

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
