import type { ReactNode } from 'react'
import { colors, spacing } from '@/design-system/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  /** Extra content below the title row (e.g. breadcrumbs, tabs) */
  below?: ReactNode
}

export default function PageHeader({ title, subtitle, icon, actions, back, below }: PageHeaderProps) {
  return (
    <header style={{
      background: colors.surface.card,
      borderBottom: `1px solid ${colors.border.default}`,
      padding: `0 ${spacing.layout}px`,
      minHeight: spacing.header,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 20,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {back}
          {icon && (
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: colors.surface.elevated,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: 18, fontWeight: 700, color: colors.text.ink,
              margin: 0, lineHeight: 1.2, letterSpacing: '-0.2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 12, color: colors.text.muted, margin: '2px 0 0', lineHeight: 1 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      {below}
    </header>
  )
}
