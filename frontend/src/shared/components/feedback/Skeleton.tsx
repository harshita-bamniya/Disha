import { cn } from '@/lib/utils'
import { tokens } from '@/design-system'

// Generic loading placeholder — for replacing `if (isLoading) return null`
// (a layout-shift flash from nothing to content) with something that holds
// the shape of what's coming (audit H-07, Sprint 1).
export function Skeleton({ width = '100%', height = 16, rounded = 8, className }: {
  width?: number | string
  height?: number | string
  rounded?: number
  className?: string
}) {
  return (
    <div
      className={cn('animate-pulse', className)}
      style={{ width, height, borderRadius: rounded, background: tokens.color.surface.elevated }}
    />
  )
}
