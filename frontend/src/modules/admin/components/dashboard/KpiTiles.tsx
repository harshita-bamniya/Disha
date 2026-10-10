import { ArrowDown, ArrowUp, Info, Minus } from 'lucide-react'
import type { MarketplaceTile } from '@/api/adminDashboard'
import { colors } from '@/design-system/tokens'
import { card } from './shared'

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 84, h = 32
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={colors.brand.navy} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
    </svg>
  )
}

/** The direction is written out ("Up 18%"), never left to colour or an arrow alone. */
function Change({ tile, days }: { tile: MarketplaceTile; days: number }) {
  const d = tile.delta
  if (!d) return null
  const amount = tile.kind === 'rate' ? (d.points ?? 0) : (d.abs ?? 0)
  const dir = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat'
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus
  const color = dir === 'up' ? colors.state.success : dir === 'down' ? colors.state.danger : colors.text.muted
  const size = tile.kind === 'rate' ? `${Math.abs(amount)} points` : d.pct != null ? `${Math.abs(Math.round(d.pct * 100))}%` : `${Math.abs(amount)}`
  const word = dir === 'flat' ? 'No change' : `${dir === 'up' ? 'Up' : 'Down'} ${size}`
  return (
    <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.45, color: colors.text.muted }}>
      <span style={{ color, fontWeight: 700, whiteSpace: 'nowrap' }}>
        <Icon size={12} aria-hidden style={{ verticalAlign: '-1px', marginRight: 3 }} />
        {tile.key === 'live_jobs' && dir !== 'flat' ? `New jobs ${word.toLowerCase()}` : word}
      </span>{' '}vs previous {days} days
    </p>
  )
}

function Tile({ tile, days }: { tile: MarketplaceTile; days: number }) {
  const rate = tile.kind === 'rate'
  // With too few people a percentage is noise (1 of 1 reads as 100%), so show the plain count.
  const big = tile.value == null ? '—'
    : rate && tile.low_sample ? `${tile.numerator ?? 0} of ${tile.denominator ?? 0}`
    : rate ? `${Math.round(tile.value * 100)}%`
    : tile.value.toLocaleString('en-IN')
  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.inkSoft }}>{tile.label}</span>
        <span title={tile.help} role="img" aria-label={`How ${tile.label.toLowerCase()} is calculated: ${tile.help}`} style={{ display: 'inline-flex', cursor: 'help' }}>
          <Info size={13} color={colors.text.muted} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.5px', color: colors.text.ink }}>{big}</span>
        {tile.series && <Sparkline values={tile.series} label={`${tile.label} per day over the last ${days} days`} />}
      </div>
      {tile.sub && !(rate && tile.low_sample) && <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.text.inkSoft }}>{tile.sub}</p>}
      {rate && tile.low_sample && <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.text.muted }}>Too few applications yet for a rate</p>}
      <Change tile={tile} days={days} />
    </div>
  )
}

export default function KpiTiles({ tiles, days }: { tiles: MarketplaceTile[]; days: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
      {tiles.map(t => <Tile key={t.key} tile={t} days={days} />)}
    </div>
  )
}
