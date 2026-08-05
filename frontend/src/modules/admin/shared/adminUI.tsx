import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8' }

// Spinner, Empty, Badge, StatCard, Breadcrumb, and Tabs (as TabBar) now live
// in shared/components/ (audit QW-7 / Sprint 4) — re-exported here so
// existing admin page imports keep working.
export { Spinner } from '@/shared/components/feedback/Spinner'
export { Empty } from '@/shared/components/feedback/EmptyState'
export { Badge } from '@/shared/components/data-display/Badge'
export { StatCard } from '@/shared/components/data-display/StatCard'
export { Breadcrumb } from '@/shared/components/navigation/Breadcrumb'
export { Tabs as TabBar, type TabDef } from '@/shared/components/navigation/Tabs'

// ── Detail helpers ─────────────────────────────────────────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: N.muted, marginTop: 16, marginBottom: 8 }}>
      {children}
    </p>
  )
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-36 shrink-0" style={{ color: N.muted }}>{label}</span>
      <span style={{ color: N.ink, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: N.ink }}>{value}</span>
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
    <button
      onClick={() => downloadCSV(rows, filename)}
      disabled={rows.length === 0}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 12px', borderRadius: 10,
        border: '0.5px solid #E2E8F0', background: '#fff',
        fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseOver={e => (e.currentTarget.style.background = '#F4F5F7')}
      onMouseOut={e => (e.currentTarget.style.background = '#fff')}
      className="disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download size={12} /> Export CSV
    </button>
  )
}

// ── Billing formatter ──────────────────────────────────────────────────────────

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
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
