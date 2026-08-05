import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { tokens } from '@/design-system'

// Moved from admin/shared/adminUI.tsx (audit M-09/Sprint 4: no breadcrumb
// anywhere outside admin). Same markup, tokens instead of a local palette.
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs mb-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#CBD5E1' }} />}
          {item.href
            ? <Link to={item.href} style={{ color: tokens.color.brand.muted, fontWeight: 600 }} className="hover:text-gray-700 transition-colors">{item.label}</Link>
            : <span style={{ color: tokens.color.brand.ink, fontWeight: 700 }}>{item.label}</span>
          }
        </span>
      ))}
    </nav>
  )
}
