import { memo } from 'react'
import { colors } from '@/design-system/tokens'

interface ScoreRingProps {
  /** 0–100 */
  value: number
  size?: number
  stroke?: number
  /** Overrides the colour derived from `value` */
  color?: string
  /** Small text under the number */
  label?: string
  /** Thresholds for green / amber; below `warn` is red */
  good?: number
  warn?: number
}

/** Circular score indicator. Colour follows the score unless `color` is given. */
const ScoreRing = memo(function ScoreRing({
  value, size = 96, stroke = 8, color, label, good = 65, warn = 45,
}: ScoreRingProps) {
  const v = Math.min(100, Math.max(0, Math.round(value)))
  const ring = color ?? (v >= good ? colors.state.success : v >= warn ? colors.state.warning : colors.state.danger)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  return (
    <div
      role="img"
      aria-label={`Score ${v} out of 100`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surface.elevated} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.1,0.64,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.32, fontWeight: 800, color: colors.text.ink, lineHeight: 1 }}>{v}</span>
        {label && (
          <span style={{ fontSize: Math.max(9, size * 0.11), fontWeight: 600, color: colors.text.muted, marginTop: 2 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
})

export default ScoreRing
