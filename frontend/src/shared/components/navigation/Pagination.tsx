import { ChevronLeft, ChevronRight } from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const btn = (label: React.ReactNode, target: number, disabled: boolean, active = false) => (
    <button
      key={String(label)}
      onClick={() => !disabled && onChange(target)}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32, borderRadius: radius.md,
        border: active ? 'none' : `1px solid ${colors.border.default}`,
        background: active ? colors.brand.navy : colors.surface.card,
        color: active ? '#fff' : disabled ? colors.text.muted : colors.text.ink,
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 8px',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      {btn(<ChevronLeft size={14} />, page - 1, page === 1)}
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} style={{ fontSize: 13, color: colors.text.muted, padding: '0 4px' }}>…</span>
          : btn(p, p, false, p === page),
      )}
      {btn(<ChevronRight size={14} />, page + 1, page === totalPages)}
    </div>
  )
}
