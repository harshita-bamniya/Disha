import { cn } from '@/lib/utils'
import { tokens } from '@/design-system'

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return (
    <div className="flex justify-center py-10">
      <div className={cn(s, 'border-2 border-t-transparent rounded-full animate-spin')} style={{ borderColor: `${tokens.color.brand.navy} transparent transparent transparent` }} />
    </div>
  )
}
