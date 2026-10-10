import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { colors, spacing } from '@/design-system/tokens'
import { iconForPath } from '@/shared/config/pageIcons'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional override. Normally omit it: the header picks the sidebar's icon for the route. */
  icon?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  /** Extra content below the title row (e.g. breadcrumbs on deep detail pages) */
  below?: ReactNode
}

// One look for every page: the icon's size and colour are fixed here, whatever
// a page passes in, so headers can't drift apart again.
const HEADER_CSS = `
.ph-icon svg { width: 16px !important; height: 16px !important; stroke: ${colors.brand.navy} !important; }
`

export default function PageHeader({ title, subtitle, icon, actions, back, below }: PageHeaderProps) {
  const { pathname } = useLocation()
  const Fallback = iconForPath(pathname)
  const shownIcon = icon ?? (Fallback ? <Fallback aria-hidden /> : null)

  return (
    <header style={{
      background: colors.surface.card,
      borderBottom: `1px solid ${colors.border.default}`,
      padding: `10px ${spacing.layout}px`,
      minHeight: spacing.header,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <style>{HEADER_CSS}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {back}
          {shownIcon && (
            <div className="ph-icon" style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: colors.surface.elevated,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {shownIcon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: 18, fontWeight: 700, color: colors.text.ink,
              margin: 0, lineHeight: 1.25, letterSpacing: '-0.2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '2px 0 0', lineHeight: 1.3 }}>
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
      {below && <div style={{ marginTop: 6 }}>{below}</div>}
    </header>
  )
}
