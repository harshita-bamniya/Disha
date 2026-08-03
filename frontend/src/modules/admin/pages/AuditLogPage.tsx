import { useState } from 'react'
import { Activity, Search } from 'lucide-react'
import { useAuditLogs } from '../hooks/useAdmin'
import { Spinner, Empty, ExportButton } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 25
  const { data, isLoading } = useAuditLogs({ action: actionFilter || undefined, limit, offset })

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Audit Log</h1>
        <p className="text-sm mt-1" style={{ color: N.muted }}>Immutable record of all admin actions on the platform.</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 className="text-sm font-bold" style={{ color: N.ink }}>
            All Events
            {data && <span className="ml-2 font-normal text-xs" style={{ color: N.muted }}>({data.total} total)</span>}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: N.muted }} />
              <input
                value={actionFilter}
                onChange={e => { setActionFilter(e.target.value); setOffset(0) }}
                placeholder="Filter by action…"
                className="pl-8 pr-3 h-8 text-xs outline-none bg-white w-56"
                style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, color: N.ink }}
                onFocus={e => (e.currentTarget.style.border = `1px solid ${N.navy}`)}
                onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)')}
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

        {isLoading ? <Spinner /> : !data || data.items.length === 0 ? (
          <Empty icon={Activity} text="No audit log entries match this filter" />
        ) : (
          data.items.map((log, idx) => (
            <div
              key={log.id}
              className="px-4 py-3"
              style={{
                borderBottom: idx < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                background: idx % 2 === 0 ? '#fff' : N.cream,
              }}
              onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: N.ink }}>{log.action.replace(/[._]/g, ' ')}</span>
                <span className="text-xs whitespace-nowrap" style={{ color: N.muted }}>
                  {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: N.muted }}>
                {log.actor_email ?? log.actor_phone ?? 'System'}
                {log.resource ? ` · ${log.resource}${log.resource_id ? ` #${log.resource_id.slice(0, 8)}` : ''}` : ''}
                {log.ip_address ? ` · ${log.ip_address}` : ''}
              </p>
              {(log.previous_value || log.new_value) && (
                <div className="flex gap-4 mt-1.5 text-[11px]">
                  {log.previous_value && <span className="text-red-400">− {JSON.stringify(log.previous_value)}</span>}
                  {log.new_value && <span className="text-green-600">+ {JSON.stringify(log.new_value)}</span>}
                </div>
              )}
            </div>
          ))
        )}

        {data && data.total > limit && (
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: N.cream, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
              className="text-xs font-semibold disabled:opacity-40" style={{ color: N.ink }}>← Previous</button>
            <span className="text-xs" style={{ color: N.muted }}>{offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}</span>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= data.total}
              className="text-xs font-semibold disabled:opacity-40" style={{ color: N.ink }}>Next →</button>
          </div>
        )}
      </div>
    </section>
  )
}
