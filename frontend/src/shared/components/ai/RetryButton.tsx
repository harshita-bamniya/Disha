import { memo } from 'react'
import { RefreshCw } from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'

interface RetryButtonProps {
  onClick: () => void
  loading?: boolean
  label?: string
}

const RetryButton = memo(function RetryButton({ onClick, loading = false, label = 'Retry' }: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: radius.lg,
        border: `1px solid ${colors.border.default}`,
        background: colors.surface.card,
        fontSize: 12, fontWeight: 600, color: colors.text.inkSoft,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.background = colors.surface.elevated }}
      onMouseLeave={e => { e.currentTarget.style.background = colors.surface.card }}
    >
      <RefreshCw size={12} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
      {label}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
})

export default RetryButton
