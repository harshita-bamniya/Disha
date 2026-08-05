import type { CSSProperties, ReactNode } from 'react'

// Shared centered-overlay dialog shell — extracted from ResumeUploadModal
// and JobAnalysisDrawer, which each hand-rolled the identical backdrop +
// click-outside-to-close + centered box mechanics with slightly different
// dimensions. Header/body content stays with each caller (they differ too
// much — icon+title vs. avatar+rich-info — to force into one shape); this
// only dedupes the actually-duplicated shell.
export function Modal({
  onClose,
  maxWidth = 520,
  radius = 20,
  overlayBg = 'rgba(15,23,42,0.5)',
  overlayPadding = 16,
  shadow = '0 24px 64px rgba(15,23,42,0.2)',
  flexColumn = false,
  overflow = 'auto',
  children,
}: {
  onClose: () => void
  maxWidth?: number
  radius?: number
  overlayBg?: string
  overlayPadding?: number
  shadow?: string
  flexColumn?: boolean
  overflow?: 'auto' | 'hidden'
  children: ReactNode
}) {
  const dialogStyle: CSSProperties = {
    background: 'white', borderRadius: radius,
    width: '100%', maxWidth, maxHeight: '90vh',
    overflow, boxShadow: shadow,
    ...(flexColumn ? { display: 'flex', flexDirection: 'column' } : null),
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: overlayBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: overlayPadding,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={dialogStyle}>
        {children}
      </div>
    </div>
  )
}
