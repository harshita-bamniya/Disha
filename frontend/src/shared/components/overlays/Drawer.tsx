import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { colors, shadows } from '@/design-system/tokens'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Non-scrolling content rendered between the title row and the scroll container */
  header?: ReactNode
  children: ReactNode
  width?: number | string
  side?: 'right' | 'left'
}

export default function Drawer({ open, onClose, title, header, children, width = 420, side = 'right' }: DrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
          }}
        />
      )}
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, bottom: 0,
        [side]: 0,
        width, maxWidth: '100vw',
        zIndex: 901,
        background: colors.surface.card,
        boxShadow: shadows.elevated,
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : `translateX(${side === 'right' ? '100%' : '-100%'})`,
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: `1px solid ${colors.border.default}`,
            flexShrink: 0,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: colors.surface.elevated, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.text.muted,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {header && <div style={{ flexShrink: 0 }}>{header}</div>}
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  )
}
