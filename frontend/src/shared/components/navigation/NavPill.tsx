import { memo } from 'react'
import { colors, radius } from '@/design-system/tokens'

export interface NavPillItem<T extends string = string> {
  key: T
  label: string
  count?: number
}

interface NavPillProps<T extends string = string> {
  items: NavPillItem<T>[]
  active: T
  onChange: (key: T) => void
  size?: 'sm' | 'md'
}

function NavPillInner<T extends string = string>({
  items,
  active,
  onChange,
  size = 'md',
}: NavPillProps<T>) {
  const h = size === 'sm' ? 28 : 32
  const px = size === 'sm' ? 10 : 14
  const fs = size === 'sm' ? 11 : 12
  const badgeFs = fs - 1

  return (
    <div style={{
      display: 'inline-flex',
      background: colors.surface.elevated,
      borderRadius: radius.lg,
      padding: 3,
      gap: 2,
    }}>
      {items.map(item => {
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              height: h,
              padding: `0 ${px}px`,
              borderRadius: radius.md,
              background: isActive ? colors.brand.navy : 'transparent',
              color: isActive ? '#fff' : colors.text.muted,
              fontSize: fs,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {item.label}
            {item.count !== undefined && (
              <span style={{
                fontSize: badgeFs,
                fontWeight: 700,
                background: isActive ? 'rgba(255,255,255,0.2)' : colors.surface.card,
                color: isActive ? '#fff' : colors.text.inkSoft,
                borderRadius: radius.full,
                padding: '1px 6px',
                lineHeight: '16px',
              }}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const NavPill = memo(NavPillInner) as typeof NavPillInner
export default NavPill
