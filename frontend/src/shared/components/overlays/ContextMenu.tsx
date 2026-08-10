import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  dividerAfter?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
}

export default function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp to viewport
  const top  = Math.min(position.y, window.innerHeight - 8)
  const left = Math.min(position.x, window.innerWidth  - 8)

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        background: 'white',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        padding: '4px 0',
        minWidth: 180,
        outline: 'none',
      }}
    >
      {items.map((item, i) => (
        <div key={i}>
          <button
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              fontSize: 13,
              color: item.disabled ? '#94A3B8' : item.danger ? '#DC2626' : '#1E3A5F',
              textAlign: 'left',
              transition: 'background 0.12s',
            }}
            onMouseOver={e => { if (!item.disabled) e.currentTarget.style.background = '#F4F5F7' }}
            onMouseOut={e => { e.currentTarget.style.background = 'none' }}
          >
            {item.icon && <span style={{ flexShrink: 0 }}>{item.icon}</span>}
            {item.label}
          </button>
          {item.dividerAfter && (
            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
          )}
        </div>
      ))}
    </div>
  )
}
