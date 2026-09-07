import { colors } from '@/design-system/tokens'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  color?: string
}

const SIZES = { sm: 16, md: 24, lg: 40 }

export default function Spinner({ size = 'md', centered = true, color }: SpinnerProps) {
  const px = SIZES[size]
  const spinner = (
    <div style={{
      width: px, height: px, borderRadius: '50%',
      border: `2px solid ${colors.surface.elevated}`,
      borderTopColor: color ?? colors.brand.navy,
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
  if (!centered) return spinner
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      {spinner}
    </div>
  )
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const s = document.createElement('style')
  s.id = 'spinner-style'
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
  document.head.appendChild(s)
}
