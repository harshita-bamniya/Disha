import { memo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeColor = 'green' | 'amber' | 'red' | 'blue' | 'navy' | 'purple' | 'gray'

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  className?: string
}

const variants: Record<BadgeColor, string> = {
  green:  'bg-green-50 text-green-700 border-green-100',
  amber:  'bg-amber-50 text-amber-700 border-amber-100',
  red:    'bg-red-50 text-red-700 border-red-100',
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  navy:   'bg-[rgba(26,39,68,0.07)] text-[#1A2744] border-[rgba(26,39,68,0.12)]',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  gray:   'bg-gray-50 text-gray-500 border-gray-100',
}

const Badge = memo(function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
      variants[color],
      className,
    )}>
      {children}
    </span>
  )
})

export default Badge
