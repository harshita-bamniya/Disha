import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  compact?: boolean
}

const ErrorState = memo(function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? 8 : 12,
      padding: compact ? '24px 16px' : '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: compact ? 36 : 48,
        height: compact ? 36 : 48,
        borderRadius: radius.lg,
        background: colors.state.dangerBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <AlertTriangle size={compact ? 18 : 22} color={colors.state.danger} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{
          fontSize: compact ? 13 : 15,
          fontWeight: 700,
          color: colors.text.ink,
          margin: 0,
        }}>
          {title}
        </p>
        <p style={{
          fontSize: compact ? 12 : 13,
          color: colors.text.muted,
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 4,
            height: compact ? 32 : 36,
            padding: '0 20px',
            borderRadius: radius.lg,
            background: colors.brand.navy,
            color: '#fff',
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = colors.brand.navySoft)}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = colors.brand.navy)}
        >
          Try again
        </button>
      )}
    </div>
  )
})

export default ErrorState
