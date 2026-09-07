import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'

export interface DropdownOption<T = string> {
  label: string
  value: T
  icon?: ReactNode
  disabled?: boolean
}

interface DropdownProps<T = string> {
  options: DropdownOption<T>[]
  value?: T
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  width?: number | string
  align?: 'left' | 'right'
}

export default function Dropdown<T = string>({
  options, value, onChange, placeholder = 'Select…',
  disabled = false, width, align = 'left',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', minWidth: 120,
          height: 36, padding: '0 12px',
          background: colors.surface.card,
          border: `1px solid ${open ? colors.brand.navy : colors.border.default}`,
          borderRadius: radius.lg, cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: selected ? 600 : 400,
          color: selected ? colors.text.ink : colors.text.muted,
          outline: 'none',
          transition: 'border-color 0.15s',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {selected?.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          color={colors.text.muted}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          [align]: 0,
          minWidth: '100%', zIndex: 500,
          background: colors.surface.card,
          border: `1px solid ${colors.border.default}`,
          borderRadius: radius.xl,
          boxShadow: shadows.elevated,
          overflow: 'hidden',
          animation: 'dropIn 0.12s ease both',
        }}>
          {options.map((opt, i) => {
            const isSelected = opt.value === value
            return (
              <button
                key={i}
                type="button"
                disabled={opt.disabled}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 14px', border: 'none',
                  background: isSelected ? colors.surface.elevated : 'transparent',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: isSelected ? 700 : 400,
                  color: opt.disabled ? colors.text.muted : isSelected ? colors.text.ink : colors.text.inkSoft,
                  textAlign: 'left', whiteSpace: 'nowrap',
                  opacity: opt.disabled ? 0.5 : 1,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!opt.disabled && !isSelected) e.currentTarget.style.background = colors.surface.elevated }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {opt.icon}
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      <style>{`@keyframes dropIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}
