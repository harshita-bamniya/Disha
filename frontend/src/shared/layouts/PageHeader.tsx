import type { ReactNode } from 'react'
import { tokens } from '@/design-system'

// Standardized sticky page-title bar. Replaces the per-page <header> element
// every aspirant page previously hand-rolled with drifting height/padding/
// typography (audit findings H-02, H-03).
export default function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header style={{
      background: tokens.color.surface.card,
      borderBottom: `1px solid ${tokens.color.brand.border}`,
      padding: `0 ${tokens.space.layout}px`,
      height: tokens.space.header,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 20,
      flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontSize: tokens.typography.pageTitle.size, fontWeight: tokens.typography.pageTitle.weight, color: '#111827', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: tokens.color.brand.muted, margin: 0 }}>{subtitle}</p>
        )}
      </div>
      {actions}
    </header>
  )
}
