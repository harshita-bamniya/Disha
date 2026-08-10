import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { colors } from '@/design-system/tokens'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <ChevronRight size={12} color={colors.text.muted} />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                style={{ fontSize: 12, color: colors.text.muted, textDecoration: 'none', fontWeight: 500 }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ fontSize: 12, color: isLast ? colors.text.ink : colors.text.muted, fontWeight: isLast ? 600 : 500 }}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
