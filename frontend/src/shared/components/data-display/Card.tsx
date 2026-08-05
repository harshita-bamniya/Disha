import type { CSSProperties, ReactNode } from 'react'
import { tokens } from '@/design-system'

// Generic card shell — border/radius/padding/shadow default to the
// design-system tokens (audit Sprint 3: "Create Card.tsx primitive").
// Existing cards each have their own established radius/padding (14px,
// 18px, 20px...) and hover/section variations; this is for new usage,
// not a forced retrofit of what's already there — see JobCard/
// JobSpotlight for an example of that being a deliberate, confirmed
// per-case decision rather than a silent swap.
export function Card({
  padding = tokens.space[5],
  radius = tokens.radius.xl,
  shadow = tokens.shadow.card,
  border = true,
  style,
  children,
}: {
  padding?: number | string
  radius?: number
  shadow?: string
  border?: boolean
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div style={{
      background: tokens.color.surface.card,
      borderRadius: radius,
      border: border ? `1px solid ${tokens.color.brand.border}` : undefined,
      boxShadow: shadow,
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}
