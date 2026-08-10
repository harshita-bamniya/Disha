import type { ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  showFilters: boolean
  onToggleFilters: () => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  /** Extra controls rendered at the end of the toolbar row (e.g. an export button). */
  actions?: ReactNode
  /** Filter panel body (selects, ranges, etc.), shown when showFilters is true. */
  children?: ReactNode
  resultCount?: number
  totalCount?: number
  resultLabel?: string
}

export default function FilterBar({
  search, onSearchChange, searchPlaceholder = 'Search…',
  showFilters, onToggleFilters, hasActiveFilters, onClearFilters,
  actions, children, resultCount, totalCount, resultLabel,
}: FilterBarProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} color={colors.text.muted} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              border: `0.5px solid ${search ? colors.brand.navy : colors.border.default}`,
              borderRadius: radius.md,
              background: colors.surface.card,
              color: colors.text.ink,
              outline: 'none',
              paddingLeft: 32, paddingRight: 12, height: 36, fontSize: 12, width: 240,
              boxShadow: search ? '0 0 0 3px rgba(26,39,68,0.07)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        </div>
        <button
          onClick={onToggleFilters}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: radius.md, cursor: 'pointer',
            border: `0.5px solid ${showFilters || hasActiveFilters ? colors.brand.navy : colors.border.default}`,
            background: showFilters || hasActiveFilters ? colors.brand.navy : colors.surface.card,
            color: showFilters || hasActiveFilters ? '#fff' : colors.text.ink,
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          <SlidersHorizontal size={13} />
          Filters
          {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.state.success, display: 'inline-block' }} />}
        </button>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              height: 36, padding: '0 12px', borderRadius: radius.md, cursor: 'pointer',
              border: `0.5px solid ${colors.border.default}`, background: colors.surface.card,
              fontSize: 12, fontWeight: 600, color: colors.text.muted,
            }}
          >
            <X size={11} /> Clear
          </button>
        )}
        {actions}
      </div>

      {showFilters && children && (
        <div style={{
          background: colors.surface.card, borderRadius: radius.xl,
          border: `1px solid ${colors.border.default}`,
          padding: '16px 20px',
          display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
        }}>
          {children}
          {resultCount !== undefined && (
            <p style={{ fontSize: 12, color: colors.text.muted, marginLeft: 'auto', alignSelf: 'center' }}>
              {resultCount} of {totalCount} {resultLabel}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
