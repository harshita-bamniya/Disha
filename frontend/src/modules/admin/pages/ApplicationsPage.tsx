import { useRef, useState, useMemo } from 'react'
import { FileText, Search } from 'lucide-react'
import { useAdminApplications } from '../hooks/useAdmin'
import { Badge, ExportButton, STATUS_COLOR_MAP } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'

const STATUS_OPTIONS = ['all', 'applied', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn']

const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

function timeAgo(ts: string) {
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

type AppRow = {
  id: string
  aspirant_name: string | null
  aspirant_phone: string
  job_title: string
  company_name: string
  match_score: number | null
  status: string
  applied_at: string
}

const COLUMNS: TableColumn<AppRow>[] = [
  {
    key: 'aspirant_name',
    header: 'Aspirant',
    sortable: true,
    render: row => (
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>{row.aspirant_name ?? 'Unknown'}</p>
        <p className="text-xs truncate" style={{ color: colors.text.muted }}>{row.aspirant_phone}</p>
      </div>
    ),
  },
  {
    key: 'job_title',
    header: 'Job',
    sortable: true,
    render: row => (
      <div className="min-w-0">
        <p className="text-sm truncate" style={{ color: colors.text.inkSoft }}>{row.job_title}</p>
        <p className="text-xs truncate" style={{ color: colors.text.muted }}>{row.company_name}</p>
      </div>
    ),
  },
  {
    key: 'match_score',
    header: 'Match',
    sortable: true,
    align: 'right',
    width: 80,
    render: row => (
      <span className={cn(
        'text-sm font-black',
        (row.match_score ?? 0) >= 70 ? 'text-green-600' :
        (row.match_score ?? 0) >= 45 ? 'text-amber-500' : '',
      )} style={(row.match_score ?? 0) < 45 ? { color: colors.text.muted } : {}}>
        {row.match_score !== null ? `${row.match_score}%` : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    width: 120,
    render: row => (
      <Badge color={STATUS_COLOR_MAP[row.status] ?? 'gray'}>{fmt(row.status)}</Badge>
    ),
  },
  {
    key: 'applied_at',
    header: 'Applied',
    sortable: true,
    align: 'right',
    width: 90,
    render: row => (
      <span className="text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>{timeAgo(row.applied_at)}</span>
    ),
  },
]

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebounced(v), 350)
  }

  const { data: apps, isLoading } = useAdminApplications(
    statusFilter !== 'all' ? statusFilter : undefined,
    debounced || undefined,
  )

  const byStatus = useMemo(() => {
    if (!apps) return {}
    return apps.reduce((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  }, [apps])

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Applications</h1>
        <p className="text-sm mt-1" style={{ color: colors.text.muted }}>All candidate applications across the platform.</p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.filter(s => s !== 'all').map(s => (
          <button key={s} onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
            className="px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A2744] focus-visible:ring-offset-1"
            style={{
              borderRadius: 10,
              border: statusFilter === s ? 'none' : `1px solid ${colors.border.default}`,
              background: statusFilter === s ? colors.brand.navy : colors.surface.card,
              color: statusFilter === s ? '#fff' : colors.text.ink,
            }}>
            {fmt(s)}{byStatus[s] ? <span className="ml-1 opacity-60">({byStatus[s]})</span> : null}
          </button>
        ))}
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="px-3 py-1.5 text-xs font-semibold" style={{ color: colors.text.muted }}>
            Clear ×
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: colors.text.inkSoft }}>
          {apps ? (
            <><span className="font-semibold">{apps.length}</span> application{apps.length !== 1 ? 's' : ''}{statusFilter !== 'all' ? ` · ${fmt(statusFilter)}` : ''}</>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: colors.text.muted }} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search aspirant, job, company…"
              aria-label="Search applications"
              className="pl-8 pr-3 h-9 text-xs bg-white outline-none w-64"
              style={{ border: `1px solid ${colors.border.default}`, borderRadius: 10, color: colors.text.ink }}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${colors.brand.navy}`)}
              onBlur={e => (e.currentTarget.style.border = `1px solid ${colors.border.default}`)}
            />
          </div>
          <ExportButton
            rows={(apps ?? []).map(a => ({
              aspirant_name: a.aspirant_name ?? '', aspirant_phone: a.aspirant_phone,
              job_title: a.job_title, company_name: a.company_name,
              status: a.status, match_score: a.match_score ?? '', applied_at: a.applied_at,
            }))}
            filename="applications.csv"
          />
        </div>
      </div>

      <DataTable<AppRow>
        columns={COLUMNS}
        rows={(apps ?? []) as AppRow[]}
        rowKey={r => r.id}
        loading={isLoading}
        emptyIcon={<FileText size={28} />}
        emptyTitle="No applications found"
        emptyDescription={statusFilter !== 'all' ? `No ${fmt(statusFilter)} applications match your search.` : 'No applications on the platform yet.'}
      />
    </section>
  )
}
