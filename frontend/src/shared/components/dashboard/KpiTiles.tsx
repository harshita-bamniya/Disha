import { useId } from 'react'
import {
  ArrowDown, ArrowUp, Briefcase, FileText, Handshake, Info, Minus, Timer, UserCheck, Video, type LucideIcon,
} from 'lucide-react'
import { colors } from '@/design-system/tokens'
import { card } from './styles'
import { accents, type Accent } from './palette'

export interface KpiTile {
  key: string
  label: string
  kind: 'count' | 'rate' | 'days'
  /** A count, a 0 to 1 rate, or a number of days. Null when there is nothing to measure yet. */
  value: number | null
  sub: string | null
  numerator?: number
  denominator?: number
  /** Present only when compare is on and both periods are big enough to compare. */
  delta: { abs?: number; pct?: number | null; points?: number; days?: number } | null
  series: number[] | null
  low_sample: boolean
  help: string
}

/** For these a drop is the good direction (a faster hire), so the colours flip. */
const LOWER_IS_BETTER = new Set(['time_to_hire'])

const LOOK: Record<string, { icon: LucideIcon; accent: Accent }> = {
  open_jobs: { icon: Briefcase, accent: 'sky' },
  live_jobs: { icon: Briefcase, accent: 'sky' },
  applications: { icon: FileText, accent: 'indigo' },
  interview_rate: { icon: Video, accent: 'violet' },
  hires: { icon: UserCheck, accent: 'emerald' },
  time_to_hire: { icon: Timer, accent: 'amber' },
  offer_acceptance: { icon: Handshake, accent: 'teal' },
}

/** An area chart that fills the bottom of the card, so the trend is part of the tile instead of an afterthought. */
function AreaSpark({ values, color, label }: { values: number[]; color: string; label: string }) {
  const id = useId()
  const w = 200, h = 44
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 10)] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}
      style={{ display: 'block', width: '100%', height: 44, marginTop: 10 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A small pill with the direction written out ("Up 18%"), never left to colour or an arrow alone. */
function ChangePill({ tile, days }: { tile: KpiTile; days: number }) {
  const d = tile.delta
  if (!d) return null
  const amount = tile.kind === 'rate' ? (d.points ?? 0) : tile.kind === 'days' ? (d.days ?? 0) : (d.abs ?? 0)
  const dir = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat'
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus
  const lowerBetter = LOWER_IS_BETTER.has(tile.key)
  const good = lowerBetter ? dir === 'down' : dir === 'up'
  const bad = lowerBetter ? dir === 'up' : dir === 'down'
  const fg = good ? '#047857' : bad ? '#B91C1C' : colors.text.inkSoft
  const bg = good ? '#ECFDF5' : bad ? '#FEF2F2' : colors.surface.elevated
  const size = tile.kind === 'rate' ? `${Math.abs(amount)} pts`
    : tile.kind === 'days' ? `${Math.abs(amount)} days`
    : d.pct != null ? `${Math.abs(Math.round(d.pct * 100))}%` : `${Math.abs(amount)}`
  const word = dir === 'flat' ? 'No change' : `${dir === 'up' ? 'Up' : 'Down'} ${size}`
  const prefix = (tile.key === 'open_jobs' || tile.key === 'live_jobs') && dir !== 'flat' ? 'New jobs ' : ''
  return (
    <span title={`Compared with the previous ${days} days`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: bg, color: fg, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon size={12} aria-hidden strokeWidth={2.6} />{prefix}{prefix ? word.toLowerCase() : word}
    </span>
  )
}

function Tile({ tile, days }: { tile: KpiTile; days: number }) {
  const look = LOOK[tile.key] ?? { icon: FileText, accent: 'slate' as Accent }
  const Icon = look.icon
  const a = accents[look.accent]
  const rate = tile.kind === 'rate'
  // With too few people a percentage is noise (1 of 1 reads as 100%), so show the plain count.
  const big = tile.value == null ? '—'
    : rate && tile.low_sample ? `${tile.numerator ?? 0} of ${tile.denominator ?? 0}`
    : rate ? `${Math.round(tile.value * 100)}%`
    : tile.kind === 'days' ? `${tile.value}` : tile.value.toLocaleString('en-IN')
  const unit = tile.kind === 'days' && tile.value != null ? (tile.value === 1 ? 'day' : 'days') : null
  const note = rate && tile.low_sample ? `Too few ${tile.key === 'offer_acceptance' ? 'offers' : 'applications'} yet for a rate`
    : tile.kind === 'days' && tile.low_sample ? 'Too few hires yet to compare' : null

  return (
    <div style={{ ...card, padding: '16px 18px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: a.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} color={a.fg} strokeWidth={2.2} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.inkSoft }}>{tile.label}</span>
          <span title={tile.help} role="img" aria-label={`How ${tile.label.toLowerCase()} is calculated: ${tile.help}`} style={{ display: 'inline-flex', cursor: 'help' }}>
            <Info size={13} color={colors.text.muted} />
          </span>
        </div>
        <ChangePill tile={tile} days={days} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.8px', color: colors.text.ink }}>{big}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: colors.text.inkSoft }}>{unit}</span>}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.text.muted, minHeight: 16 }}>
        {note ?? (tile.sub && !(rate && tile.low_sample) ? tile.sub : ' ')}
      </p>
      {tile.series && <AreaSpark values={tile.series} color={a.fg} label={`${tile.label} per day over the last ${days} days`} />}
      {/* A rate with enough people behind it gets a bar, so the tile has a picture like the trend tiles do. */}
      {rate && !tile.low_sample && tile.value != null && (
        <div role="img" aria-label={`${Math.round(tile.value * 100)} percent`} style={{ marginTop: 14, height: 8, borderRadius: 4, background: a.bg, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(tile.value * 100)}%`, height: '100%', borderRadius: 4, background: a.fg }} />
        </div>
      )}
    </div>
  )
}

export default function KpiTiles({ tiles, days }: { tiles: KpiTile[]; days: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
      {tiles.map(t => <Tile key={t.key} tile={t} days={days} />)}
    </div>
  )
}
