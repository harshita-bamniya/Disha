import type { ReactNode, CSSProperties } from 'react'
import { colors, radius, shadows } from '@/design-system/tokens'

interface CardProps {
  children: ReactNode
  padding?: number | string
  hoverable?: boolean
  onClick?: () => void
  style?: CSSProperties
  className?: string
}

export default function Card({ children, padding = 20, hoverable = false, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: colors.surface.card,
        border: `1px solid ${colors.border.default}`,
        borderRadius: radius.xl,
        padding,
        boxShadow: shadows.card,
        transition: hoverable ? 'box-shadow 0.2s, transform 0.2s, border-color 0.2s' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={hoverable ? e => {
        e.currentTarget.style.boxShadow = shadows.cardHover
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = colors.border.medium
      } : undefined}
      onMouseLeave={hoverable ? e => {
        e.currentTarget.style.boxShadow = shadows.card
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = colors.border.default
      } : undefined}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 16, marginBottom: 16,
      borderBottom: `1px solid ${colors.border.default}`,
      ...style,
    }}>
      {children}
    </div>
  )
}
