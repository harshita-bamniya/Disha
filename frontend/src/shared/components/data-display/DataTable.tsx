import { memo, useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, CheckSquare, Square, Minus } from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'
import type { TableColumn, SortDir } from '@/shared/types'
import EmptyState from '../feedback/EmptyState'
import { Skeleton } from '../feedback/Skeleton'
import Pagination from '../navigation/Pagination'

interface DataTableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  /** Controlled sort — provide both to enable server-side sort */
  sortKey?: string
  sortDir?: SortDir
  onSort?: (key: string, dir: SortDir) => void
  /** Controlled pagination */
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
  stickyHeader?: boolean
  /** Bulk selection — provide all three to enable checkbox column */
  selectedKeys?: Set<string | number>
  onToggleKey?: (key: string | number) => void
  onToggleAll?: () => void
}

function DataTable<T>({
  columns, rows, rowKey, loading = false,
  emptyIcon, emptyTitle = 'No results', emptyDescription,
  sortKey, sortDir, onSort,
  page, totalPages, onPageChange,
  onRowClick, stickyHeader = true,
  selectedKeys, onToggleKey, onToggleAll,
}: DataTableProps<T>) {
  const selectable = !!(selectedKeys && onToggleKey && onToggleAll)
  const [localSort, setLocalSort] = useState<{ key: string; dir: SortDir } | null>(null)

  const activeKey = sortKey ?? localSort?.key
  const activeDir = sortDir ?? localSort?.dir

  function handleSort(col: TableColumn<T>) {
    if (!col.sortable) return
    const newDir: SortDir = activeKey === col.key && activeDir === 'asc' ? 'desc' : 'asc'
    if (onSort) {
      onSort(col.key, newDir)
    } else {
      setLocalSort({ key: col.key, dir: newDir })
    }
  }

  // Client-side sort when no onSort handler provided
  let displayRows = rows
  if (!onSort && localSort) {
    displayRows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[localSort.key]
      const bv = (b as Record<string, unknown>)[localSort.key]
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'en-IN', { numeric: true })
      return localSort.dir === 'asc' ? cmp : -cmp
    })
  }

  // Selection state for checkbox column header icon
  const allRowKeys = displayRows.map(r => rowKey(r))
  const selectedCount = selectable ? allRowKeys.filter(k => selectedKeys!.has(k)).length : 0
  const allSelected = selectable && allRowKeys.length > 0 && selectedCount === allRowKeys.length
  const someSelected = selectable && selectedCount > 0 && !allSelected

  const checkboxThStyle: React.CSSProperties = {
    padding: '10px 10px 10px 14px',
    background: colors.surface.elevated,
    borderBottom: `1px solid ${colors.border.default}`,
    width: 40,
    position: stickyHeader ? 'sticky' : 'static',
    top: 0, zIndex: 1,
  }

  const checkboxTdStyle: React.CSSProperties = {
    padding: '12px 10px 12px 14px',
    borderBottom: `1px solid ${colors.border.default}`,
    verticalAlign: 'middle',
    width: 40,
  }

  const thStyle = (col: TableColumn<T>): React.CSSProperties => ({
    padding: '10px 14px',
    fontSize: 10, fontWeight: 700, letterSpacing: '1px',
    textTransform: 'uppercase', color: colors.text.muted,
    background: colors.surface.elevated,
    borderBottom: `1px solid ${colors.border.default}`,
    textAlign: col.align ?? 'left',
    width: col.width,
    cursor: col.sortable ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    position: stickyHeader ? 'sticky' : 'static',
    top: 0, zIndex: 1,
  })

  const tdStyle = (col: TableColumn<T>): React.CSSProperties => ({
    padding: '12px 14px',
    fontSize: 13, color: colors.text.ink,
    borderBottom: `1px solid ${colors.border.default}`,
    textAlign: col.align ?? 'left',
    verticalAlign: 'middle',
  })

  function SortIcon({ col }: { col: TableColumn<T> }) {
    if (!col.sortable) return null
    if (activeKey !== col.key) return <ChevronsUpDown size={12} color={colors.text.muted} style={{ marginLeft: 4 }} />
    return activeDir === 'asc'
      ? <ChevronUp size={12} color={colors.brand.navy} style={{ marginLeft: 4 }} />
      : <ChevronDown size={12} color={colors.brand.navy} style={{ marginLeft: 4 }} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        background: colors.surface.card,
        border: `1px solid ${colors.border.default}`,
        borderRadius: radius.xl,
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                {selectable && (
                  <th style={checkboxThStyle}>
                    <button
                      onClick={onToggleAll}
                      aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                      {allSelected
                        ? <CheckSquare size={15} color={colors.brand.navy} />
                        : someSelected
                          ? <Minus size={15} color={colors.brand.navy} />
                          : <Square size={15} color={colors.text.muted} />}
                    </button>
                  </th>
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={thStyle(col)}
                    onClick={() => handleSort(col)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {col.header}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {selectable && <td style={checkboxTdStyle}><Skeleton height={14} width={14} /></td>}
                    {columns.map(col => (
                      <td key={col.key} style={tdStyle(col)}>
                        <Skeleton height={13} width={col.align === 'right' ? '60%' : '80%'} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={selectable ? columns.length + 1 : columns.length}>
                    <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                displayRows.map(row => {
                  const key = rowKey(row)
                  const isSelected = selectable && selectedKeys!.has(key)
                  return (
                    <tr
                      key={key}
                      onClick={() => onRowClick?.(row)}
                      style={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        background: isSelected ? colors.surface.elevated : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => {
                        if (onRowClick || selectable)
                          (e.currentTarget as HTMLElement).style.background = colors.surface.elevated
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isSelected
                          ? colors.surface.elevated
                          : 'transparent'
                      }}
                    >
                      {selectable && (
                        <td style={checkboxTdStyle}>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onToggleKey!(key)
                            }}
                            aria-label={isSelected ? 'Deselect row' : 'Select row'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                          >
                            {isSelected
                              ? <CheckSquare size={15} color={colors.brand.navy} />
                              : <Square size={15} color={colors.text.muted} />}
                          </button>
                        </td>
                      )}
                      {columns.map(col => (
                        <td key={col.key} style={tdStyle(col)}>
                          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages !== undefined && onPageChange && (
        <div style={{ paddingTop: 16 }}>
          <Pagination page={page ?? 1} totalPages={totalPages} onChange={onPageChange} />
        </div>
      )}
    </div>
  )
}

export default memo(DataTable) as typeof DataTable
