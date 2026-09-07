import type { ReactNode } from 'react'
import { colors } from '@/design-system/tokens'

export interface TabItem {
  key: string
  label: string
  icon?: ReactNode
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
  /** 'underline' — bottom-border indicator (default); 'pill' — segmented capsule control */
  variant?: 'underline' | 'pill'
  style?: React.CSSProperties
}

export default function Tabs({ tabs, active, onChange, variant = 'underline', style }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div style={{
        display: 'inline-flex', gap: 2, background: colors.surface.elevated,
        borderRadius: 12, padding: 4, ...style,
      }}>
        {tabs.map(tab => {
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 9,
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                background: isActive ? colors.surface.card : 'transparent',
                color: isActive ? colors.text.ink : colors.text.inkSoft,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: isActive ? colors.surface.elevated : 'rgba(30,58,95,0.06)',
                  color: isActive ? colors.text.ink : colors.text.muted,
                  borderRadius: 99, padding: '1px 6px', lineHeight: 1.4,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 2, borderBottom: `1px solid ${colors.border.default}`,
      padding: '0 4px', ...style,
    }}>
      {tabs.map(tab => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: isActive ? colors.brand.navy : colors.text.muted,
              borderBottom: `2px solid ${isActive ? colors.brand.navy : 'transparent'}`,
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: isActive ? colors.brand.navy : colors.surface.elevated,
                color: isActive ? '#fff' : colors.text.muted,
                borderRadius: 99, padding: '1px 6px',
                lineHeight: 1.4,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
