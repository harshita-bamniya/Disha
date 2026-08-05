import { memo } from 'react'
import { cn } from '@/lib/utils'

export const Badge = memo(function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    green:  'bg-green-50 text-green-700 border-green-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    navy:   'bg-[rgba(26,39,68,0.07)] text-[#1A2744] border-[rgba(26,39,68,0.12)]',
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    gray:   'bg-gray-50 text-gray-500 border-gray-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', cls[color] ?? cls.gray)}>
      {children}
    </span>
  )
})
