import { useState } from 'react'
import { Activity, Search } from 'lucide-react'
import { useAuditLogs } from '../hooks/useAdmin'
import { ExportButton } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import { colors } from '@/design-system/tokens'

const LIMIT = 25

type AuditRow = {
  id: string
  action: string
  actor_email: string | null
  actor_phone: string | null
  resource: string | null
  resource_id: string | null
  ip_address: string | null
  previous_value: unknown
  new_value: unknown
  created_at: string
}

const COLUMNS: TableColumn<AuditRow>[] = [
  {
    key: 'action',
    header: 'Action',
    sortable: true,
    render: row => (
      <div>
        <p className="text-sm font-semibold" style={{ color: colors.text.ink }}>
          {row.action.replace(/[._]/g, ' ')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
          {row.actor_email ?? row.actor_phone ?? 'System'}
          {row.resource ? ` · ${row.resource}${row.resource_id ? ` #${row.resource_id.slice(0, 8)}` : ''}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'previous_value',
    header: 'Changes',
    width: 240,
    render: row => (row.previous_value || row.new_value) ? (
      <div className="flex flex-col gap-0.5 text-[11px]">
        {row.previous_value && <span className="text-red-400 truncate">− {JSON.stringify(row.previous_value)}</span>}
        {row.new_value && <span className="text-green-600 truncate">+ {JSON.stringify(row.new_value)}</span>}
      </div>
    ) : <span style={{ color: colors.text.muted }}>—</span>,
  },
  {
    key: 'ip_address',
    header: 'IP',
    width: 130,
    render: row => (
      <span className="text-xs font-mono" style={{ color: colors.text.muted }}>
        {row.ip_address ?? '—'}
      </span>
    ),
  },
  {
    key: 'created_at',
    header: 'Time',
    sortable: true,
    align: 'right',
    width: 120,
    render: row => (
      <span className="text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>
        {new Date(row.created_at).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })}
      </span>
    ),
  },
]

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const offset = (page - 1) * LIMIT

  const { data, isLoading } = useAuditLogs({ action: actionFilter || undefined, limit: LIMIT, offset })

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0

  const handleFilterChange = (v: string) => {
    setActionFilter(v)
    setPage(1)
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Audit Log</h1>
        <p className="text-sm mt-1" style={{ color: colors.text.muted }}>Immutable record of all admin actions on the platform.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: colors.text.inkSoft }}>
          {data ? <><span className="font-semibold">{data.total}</span> events total</> : null}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: colors.text.muted }} />
            <input
              value={actionFilter}
              onChange={e => handleFilterChange(e.target.value)}
              placeholder="Filter by action…"
              aria-label="Filter audit log by action"
              className="pl-8 pr-3 h-9 text-xs outline-none bg-white w-56"
              style={{ border: `1px solid ${colors.border.default}`, borderRadius: 10, color: colors.text.ink }}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${colors.brand.navy}`)}
              onBlur={e => (e.currentTarget.style.border = `1px solid ${colors.border.default}`)}
            />
          </div>
          <ExportButton
            rows={(data?.items ?? []).map(log => ({
              action: log.action,
              actor: log.actor_email ?? log.actor_phone ?? 'System',
              resource: log.resource ?? '',
              resource_id: log.resource_id ?? '',
              ip_address: log.ip_address ?? '',
              created_at: log.created_at,
            }))}
            filename="audit_log.csv"
          />
        </div>
      </div>

      <DataTable<AuditRow>
        columns={COLUMNS}
        rows={(data?.items ?? []) as AuditRow[]}
        rowKey={r => r.id}
        loading={isLoading}
        emptyIcon={<Activity size={28} />}
        emptyTitle="No audit log entries"
        emptyDescription={actionFilter ? `No events matching "${actionFilter}".` : 'No events have been recorded yet.'}
        page={page}
        totalPages={totalPages > 1 ? totalPages : undefined}
        onPageChange={p => setPage(p)}
      />
    </section>
  )
}
