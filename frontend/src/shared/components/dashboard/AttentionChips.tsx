import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import { card, shortAge } from './styles'

export interface AttentionItem {
  key: string
  label: string
  count: number
  overdue: number
  level: 'urgent' | 'normal'
  oldest_age_hours: number | null
  parts: { label: string; count: number }[]
  note: string | null
  link: string
}

interface Props {
  rows: AttentionItem[] | undefined
  clearMessage?: string
  loading: boolean
  error: boolean
  onRetry: () => void
  /** The full sentence for a row, used as the chip's tooltip and accessible name. */
  describe: (row: AttentionItem) => string
}

/** Only what is waiting on a person. With nothing waiting it is a single calm line, not a card of empty queues. */
export default function AttentionChips({ rows, clearMessage = 'Nothing is waiting on you', loading, error, onRetry, describe }: Props) {
  const navigate = useNavigate()
  const shell = { ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, padding: '10px 14px', minHeight: 52 }

  if (loading) return <div style={shell} aria-busy="true"><span style={{ fontSize: 13, color: colors.text.muted }}>Checking what needs you…</span></div>
  if (error || !rows) {
    return (
      <div style={shell}>
        <span style={{ fontSize: 13, color: colors.text.inkSoft }}>Could not load this.</span>
        <button onClick={onRetry} style={{ background: 'none', border: 'none', color: colors.state.info, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div style={shell} role="status">
        <CheckCircle2 size={17} color={colors.state.success} aria-hidden />
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink }}>{clearMessage}</span>
      </div>
    )
  }

  return (
    <section aria-label="Needs attention" style={shell}>
      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, marginRight: 2 }}>Needs attention</span>
      {rows.map(row => {
        const urgent = row.level === 'urgent'
        return (
          <button
            key={row.key}
            onClick={() => navigate(row.link)}
            title={describe(row)}
            aria-label={describe(row)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, color: colors.text.ink,
              background: urgent ? colors.state.dangerBg : colors.surface.bg,
              border: `1px solid ${urgent ? 'rgba(220,38,38,0.28)' : colors.border.default}`,
            }}
          >
            {urgent && <AlertTriangle size={14} color={colors.state.danger} aria-hidden />}
            <strong style={{ fontWeight: 700 }}>{row.label}</strong>
            <span style={{ fontWeight: 700 }}>{row.count > 0 ? row.count : row.parts[0]?.count}</span>
            {row.note && row.key === 'interviews_today' && <span style={{ color: colors.text.muted }}>{row.note}</span>}
            {row.oldest_age_hours != null && row.key !== 'interviews_today' && <span style={{ color: colors.text.muted }}>oldest {shortAge(row.oldest_age_hours)}</span>}
            {row.overdue > 0 && <span style={{ color: colors.state.danger, fontWeight: 700 }}>{row.overdue} overdue</span>}
          </button>
        )
      })}
    </section>
  )
}
