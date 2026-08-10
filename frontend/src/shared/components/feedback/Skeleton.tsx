import { colors } from '@/design-system/tokens'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: number
  className?: string
}

export function Skeleton({ width = '100%', height = 16, radius = 6 }: SkeletonProps) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${colors.surface.elevated} 25%, #e0e4ea 50%, ${colors.surface.elevated} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.4s ease infinite',
    }} />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: colors.surface.card,
      border: `1px solid ${colors.border.default}`,
      borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Skeleton height={18} width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? '40%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? '65%' : '100%'} />
      ))}
    </div>
  )
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-style')) {
  const s = document.createElement('style')
  s.id = 'skeleton-style'
  s.textContent = `@keyframes skeleton-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`
  document.head.appendChild(s)
}
