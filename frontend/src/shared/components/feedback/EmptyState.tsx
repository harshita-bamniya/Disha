import { tokens } from '@/design-system'

export function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-10 h-10 mb-3" style={{ color: '#E2E8F0' }} />
      <p className="text-sm font-semibold" style={{ color: tokens.color.brand.muted }}>{text}</p>
    </div>
  )
}
