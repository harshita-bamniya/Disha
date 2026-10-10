import type { CSSProperties } from 'react'
import { colors, shadows } from '@/design-system/tokens'

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
