import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react'
import { colors } from '@/design-system/tokens'

type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

interface AlertBannerProps {
  variant?: AlertVariant
  title?: string
  message: string
  action?: React.ReactNode
  onDismiss?: () => void
  className?: string
}

const config: Record<AlertVariant, {
  bg: string; border: string; text: string; icon: React.ReactNode
}> = {
  info: {
    bg: colors.state.infoBg,
    border: '#BFDBFE',
    text: '#1E40AF',
    icon: <Info size={16} color={colors.state.info} />,
  },
  success: {
    bg: colors.state.successBg,
    border: '#BBF7D0',
    text: '#14532D',
    icon: <CheckCircle2 size={16} color={colors.state.success} />,
  },
  warning: {
    bg: colors.state.warningBg,
    border: '#FDE68A',
    text: '#92400E',
    icon: <AlertTriangle size={16} color={colors.state.warning} />,
  },
  danger: {
    bg: colors.state.dangerBg,
    border: '#FECACA',
    text: '#991B1B',
    icon: <XCircle size={16} color={colors.state.danger} />,
  },
}

export default function AlertBanner({ variant = 'info', title, message, action, onDismiss, className }: AlertBannerProps) {
  const c = config[variant]
  return (
    <div
      role="alert"
      className={className}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <p style={{ fontSize: 13, fontWeight: 700, color: c.text, margin: '0 0 2px' }}>{title}</p>
        )}
        <p style={{ fontSize: 13, color: c.text, margin: 0, lineHeight: 1.5 }}>{message}</p>
      </div>
      {action && (
        <div style={{ flexShrink: 0 }}>{action}</div>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: c.text,
            padding: 2,
            display: 'flex',
            opacity: 0.6,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
