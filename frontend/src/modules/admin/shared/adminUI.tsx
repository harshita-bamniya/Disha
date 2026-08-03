import { cn } from '@/lib/utils'
import { Download, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8' }

// ── Spinner ────────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return (
    <div className="flex justify-center py-10">
      <div className={cn(s, 'border-2 border-t-transparent rounded-full animate-spin')} style={{ borderColor: `${N.navy} transparent transparent transparent` }} />
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

export function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-10 h-10 mb-3" style={{ color: '#E2E8F0' }} />
      <p className="text-sm font-semibold" style={{ color: N.muted }}>{text}</p>
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────────

export function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    green:  'bg-green-50 text-green-700 border-green-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    navy:   'bg-[rgba(26,39,68,0.07)] text-[#1A2744] border-[rgba(26,39,68,0.12)]',
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    gray:   'bg-gray-50 text-gray-500 border-gray-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', cls[color] ?? cls.gray)}>
      {children}
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

export function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string; accent?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column' as const, gap: 0,
      transition: 'background 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
      onMouseOut={e => (e.currentTarget.style.background = '#fff')}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={18} color={N.ink} />
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: N.ink, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: N.muted, marginTop: 5 }}>{sub}</p>}
    </div>
  )
}

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

// ── Breadcrumb ─────────────────────────────────────────────────────────────────

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs mb-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#CBD5E1' }} />}
          {item.href
            ? <Link to={item.href} style={{ color: N.muted, fontWeight: 600 }} className="hover:text-gray-700 transition-colors">{item.label}</Link>
            : <span style={{ color: N.ink, fontWeight: 700 }}>{item.label}</span>
          }
        </span>
      ))}
    </nav>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

export interface TabDef { key: string; label: string; count?: number }

export function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto mb-6" style={{ borderBottom: '0.5px solid #E2E8F0' }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all"
            style={{
              borderBottomColor: isActive ? N.navy : 'transparent',
              color: isActive ? N.navy : '#64748B',
            }}
            onMouseOver={e => { if (!isActive) e.currentTarget.style.color = N.ink }}
            onMouseOut={e => { if (!isActive) e.currentTarget.style.color = '#64748B' }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: isActive ? 'rgba(26,39,68,0.08)' : '#F1F5F9',
                color: isActive ? N.navy : N.muted,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
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
