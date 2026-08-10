import type { ReactNode } from 'react'
import { colors } from '@/design-system/tokens'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: colors.surface.elevated,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, color: colors.text.muted,
        }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 13, color: colors.text.muted, marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}
