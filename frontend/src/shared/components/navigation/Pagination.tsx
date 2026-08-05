import { ChevronLeft, ChevronRight } from 'lucide-react'
import { tokens } from '@/design-system'

// Extracted verbatim from JobsPage's prev/next pager — same visual, now
// reusable (audit Phase 6.3 QW/Sprint 3: shared Pagination component).
export function Pagination({ page, total, limit, onPageChange }: {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}) {
  if (total <= limit) return null

  const totalPages = Math.ceil(total / limit)
  const atStart = page === 0
  const atEnd = (page + 1) * limit >= total

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 14px', fontSize: 12, border: `1px solid ${tokens.color.brand.border}`,
    borderRadius: 9, background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1, color: tokens.color.brand.inkSoft,
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
      <button disabled={atStart} onClick={() => onPageChange(page - 1)} style={btnStyle(atStart)}>
        <ChevronLeft size={14} /> Previous
      </button>
      <span style={{ fontSize: 12, color: tokens.color.brand.muted }}>
        Page {page + 1} of {totalPages}
      </span>
      <button disabled={atEnd} onClick={() => onPageChange(page + 1)} style={btnStyle(atEnd)}>
        Next <ChevronRight size={14} />
      </button>
    </div>
  )
}
