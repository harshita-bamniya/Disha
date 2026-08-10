/**
 * Admin UI primitives — thin re-export layer over shared components.
 * Existing admin pages import from here unchanged; no cascade refactor needed.
 */
import { cn } from '@/lib/utils'
import { Download, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import SharedBadge from '@/shared/components/data-display/Badge'
import SharedStatCard from '@/shared/components/data-display/StatCard'
import SharedSpinner from '@/shared/components/feedback/Spinner'
import SharedEmpty from '@/shared/components/feedback/EmptyState'
import SharedBreadcrumb from '@/shared/components/navigation/Breadcrumb'
import SharedTabs, { type TabItem } from '@/shared/components/navigation/Tabs'
import { colors } from '@/design-system/tokens'

// ── Spinner — re-exports shared ───���────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <SharedSpinner size={size} />
}

// ── Empty state — re-exports shared ───────────────────────────────────────────

export function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return <SharedEmpty icon={<Icon size={28} color={colors.surface.elevated} />} title={text} />
}

// ── Badge — re-exports shared ──────────────────────────────────────────────────

export function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const validColor = ['green', 'amber', 'red', 'navy', 'blue', 'gray', 'purple'].includes(color)
    ? color as 'green' | 'amber' | 'red' | 'navy' | 'blue' | 'gray' | 'purple'
    : 'gray'
  return <SharedBadge color={validColor}>{children}</SharedBadge>
}

// ── Stat card — re-exports shared ─────────────────────────────────────────────

export function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string; accent?: string
}) {
  return <SharedStatCard icon={Icon} label={label} value={value} sub={sub} accent={accent} />
}

// ── Detail helpers (admin-only, no shared equivalent) ─────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: colors.text.muted, marginTop: 16, marginBottom: 8 }}>
      {children}
    </p>
  )
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-36 shrink-0" style={{ color: colors.text.muted }}>{label}</span>
      <span style={{ color: colors.text.ink, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: colors.text.ink }}>{value}</span>
    </div>
  )
}

// ── CSV export ─────────────────────────────────────────────────────────────────

export function downloadCSV<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function ExportButton<T extends Record<string, unknown>>({ rows, filename }: { rows: T[]; filename: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => downloadCSV(rows, filename)}
      disabled={rows.length === 0}
    >
      <Download size={12} /> Export CSV
    </Button>
  )
}

// ── Billing formatter ──────────────────────────────────────────────────────────

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

// ── Breadcrumb — re-exports shared ────────────────────────────────────────────

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <SharedBreadcrumb items={items} />
}

// ── Tab bar — re-exports shared ───────────────────────────────────────────────

export interface TabDef { key: string; label: string; count?: number }

export function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  const tabItems: TabItem[] = tabs.map(t => ({ key: t.key, label: t.label, count: t.count }))
  return <SharedTabs tabs={tabItems} active={active} onChange={onChange} style={{ marginBottom: 24 }} />
}

// ── Status colour maps ─────────────────────────────────────────────────────────

export const STATUS_COLOR_MAP: Record<string, string> = {
  applied:      'green',
  under_review: 'navy',
  shortlisted:  'purple',
  rejected:     'red',
  hired:        'amber',
  withdrawn:    'gray',
}

export const VERIF_STATUS_COLOR: Record<string, string> = {
  pending:      'amber',
  under_review: 'navy',
  approved:     'green',
  rejected:     'red',
  resubmitted:  'purple',
}
