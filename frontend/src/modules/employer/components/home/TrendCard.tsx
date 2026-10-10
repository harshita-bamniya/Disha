import { useMemo, useState } from 'react'
import { colors } from '@/design-system/tokens'
import type { KpiTile } from '@/shared/components/dashboard/KpiTiles'
import { card, cardSub, cardTitle } from '@/shared/components/dashboard/styles'

const W = 640, H = 236
const PAD = { l: 34, r: 10, t: 14, b: 26 }
const APP = '#4F46E5', HIRE = '#059669'

/** A round number just above the data, so the gridlines land on 0, half and the top. */
const niceMax = (n: number) => {
  if (n <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(n))
  const m = n / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
}

/** Applications over the period as an area, with each day's hires marked on top. Hover for the exact numbers. */
export default function TrendCard({ tiles, from, days }: { tiles: KpiTile[]; from: string; days: number }) {
  const apps = tiles.find(t => t.key === 'applications')
  const hires = tiles.find(t => t.key === 'hires')
  const a = apps?.series ?? [], h = hires?.series ?? []
  const [hover, setHover] = useState<number | null>(null)

  const dates = useMemo(() => {
    const start = new Date(`${from}T00:00:00`)
    return a.map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [from, a])
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  if (!apps || a.length === 0) return null
  const max = niceMax(Math.max(...a, ...h, 1))
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (a.length > 1 ? (i / (a.length - 1)) * iw : iw / 2)
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const line = a.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, max / 2, max]
  const labelIdx = [0, Math.floor((a.length - 1) / 2), a.length - 1]
  const total = a.reduce((s, v) => s + v, 0)
  const hired = h.reduce((s, v) => s + v, 0)

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PAD.l) / iw) * (a.length - 1))
    setHover(Math.min(a.length - 1, Math.max(0, i)))
  }

  return (
    <section style={{ ...card, padding: '18px 20px 12px' }} aria-labelledby="trend-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 id="trend-title" style={cardTitle}>Applications and hires</h2>
          <p style={cardSub}>Per day, last {days} days</p>
        </div>
        <div style={{ display: 'flex', gap: 22 }}>
          <div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.text.inkSoft }}><i aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: APP }} />Applications</span>
            <strong style={{ fontSize: 22, letterSpacing: '-0.5px', color: colors.text.ink }}>{total}</strong>
          </div>
          <div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.text.inkSoft }}><i aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: HIRE }} />Hires</span>
            <strong style={{ fontSize: 22, letterSpacing: '-0.5px', color: colors.text.ink }}>{hired}</strong>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${total} applications and ${hired} hires over the last ${days} days`}
          style={{ display: 'block', width: '100%', height: 'auto' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={APP} stopOpacity={0.24} /><stop offset="100%" stopColor={APP} stopOpacity={0} />
            </linearGradient>
          </defs>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(0,0,0,0.07)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={colors.text.muted}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          <polygon points={`${x(0)},${y(0)} ${line} ${x(a.length - 1)},${y(0)}`} fill="url(#trend-fill)" />
          <polyline points={line} fill="none" stroke={APP} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          {h.map((v, i) => v > 0 && (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(0)} y2={y(v)} stroke={HIRE} strokeWidth={2} strokeOpacity={0.55} />
              <circle cx={x(i)} cy={y(v)} r={4.5} fill="#fff" stroke={HIRE} strokeWidth={2.2} />
            </g>
          ))}
          {labelIdx.map((i, k) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} fontSize={11} fill={colors.text.muted}>{fmt(dates[i])}</text>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={y(0)} stroke={colors.brand.navy} strokeOpacity={0.25} />
              <circle cx={x(hover)} cy={y(a[hover])} r={5} fill={APP} stroke="#fff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover != null && (
          <div role="status" style={{
            position: 'absolute', top: 6, pointerEvents: 'none', padding: '8px 11px', borderRadius: 10, background: colors.brand.navy, color: '#fff', fontSize: 12, lineHeight: 1.5, whiteSpace: 'nowrap',
            left: `${(x(hover) / W) * 100}%`, transform: hover > a.length * 0.7 ? 'translateX(-108%)' : 'translateX(12px)', boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
          }}>
            <strong>{fmt(dates[hover])}</strong><br />
            {a[hover]} application{a[hover] === 1 ? '' : 's'}{h[hover] > 0 && <><br /><span style={{ color: '#6EE7B7' }}>{h[hover]} hire{h[hover] === 1 ? '' : 's'}</span></>}
          </div>
        )}
      </div>
    </section>
  )
}
