import type { ReactNode, RefObject } from 'react'
import { X } from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number | string
  footer?: ReactNode
  /** Non-scrolling content rendered between the title row and the scroll container */
  header?: ReactNode
  /** Ref forwarded to the scroll container — useful when callers need to scroll-to-top on step changes */
  scrollRef?: RefObject<HTMLDivElement>
}

export default function Modal({ open, onClose, title, children, width = 480, footer, header, scrollRef }: ModalProps) {
  if (!open) return null
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width, maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 80px)',
        background: colors.surface.card,
        borderRadius: radius['2xl'],
        boxShadow: shadows.elevated,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px 14px',
            borderBottom: `1px solid ${colors.border.default}`,
            flexShrink: 0,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: colors.surface.elevated,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.text.muted,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {header && <div style={{ flexShrink: 0 }}>{header}</div>}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '14px 24px',
            borderTop: `1px solid ${colors.border.default}`,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
