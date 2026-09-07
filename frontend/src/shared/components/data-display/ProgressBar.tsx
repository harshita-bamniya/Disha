import { memo } from 'react'
import { colors, radius } from '@/design-system/tokens'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  animate?: boolean
}

const ProgressBar = memo(function ProgressBar({
  value, max = 100, color, height = 6, showLabel = false, animate = true,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = color ?? colors.brand.navy

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height, borderRadius: radius.full,
        background: colors.surface.elevated, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor, borderRadius: radius.full,
          transition: animate ? 'width 0.6s cubic-bezier(0.34,1.1,0.64,1)' : undefined,
        }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, minWidth: 32, textAlign: 'right' }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
})

export default ProgressBar
