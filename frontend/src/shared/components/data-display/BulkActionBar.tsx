import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'
import { colors, radius } from '@/design-system/tokens'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  /** Action buttons specific to the page (export, activate, revoke, etc.). */
  children: ReactNode
}

export default function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div style={{
      background: colors.surface.bg,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.xl,
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: colors.brand.navy }}>{count} selected</span>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      </div>
    </div>
  )
}
