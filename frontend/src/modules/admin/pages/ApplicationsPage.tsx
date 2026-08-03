import { useState, useMemo } from 'react'
import { FileText, Search } from 'lucide-react'
import { useAdminApplications } from '../hooks/useAdmin'
import { Spinner, Empty, Badge, ExportButton, STATUS_COLOR_MAP } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }
const STATUS_OPTIONS = ['all', 'applied', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn']

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 350)
  }

  const { data: apps, isLoading } = useAdminApplications(
    statusFilter !== 'all' ? statusFilter : undefined,
    debounced || undefined,
  )

  const byStatus = useMemo(() => {
    if (!apps) return {}
    return apps.reduce((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  }, [apps])

  const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const timeAgo = (ts: string) => {
    const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Applications</h1>

      <div className="flex flex-wrap gap-3">
        {STATUS_OPTIONS.filter(s => s !== 'all').map(s => (
          <button key={s} onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
            className="px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              borderRadius: 10,
              border: statusFilter === s ? 'none' : '1px solid rgba(0,0,0,0.08)',
              background: statusFilter === s ? N.navy : '#fff',
              color: statusFilter === s ? '#fff' : N.ink,
            }}>
            {fmt(s)} {byStatus[s] ? <span className="ml-1 opacity-75">({byStatus[s]})</span> : ''}
          </button>
        ))}
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="px-3 py-1.5 text-xs font-semibold" style={{ color: N.muted }}>Clear ×</button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 className="text-sm font-bold" style={{ color: N.ink }}>
            Applications {statusFilter !== 'all' ? `· ${fmt(statusFilter)}` : ''}
            {apps && <span className="ml-2 font-normal" style={{ color: N.muted }}>({apps.length})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: N.muted }} />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search aspirant, job, company…"
                className="pl-8 pr-3 h-8 text-xs bg-white outline-none w-64"
                style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, color: N.ink }}
                onFocus={e => (e.currentTarget.style.border = `1px solid ${N.navy}`)}
                onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)')} />
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

        {isLoading ? <Spinner /> : !apps || apps.length === 0 ? (
          <Empty icon={FileText} text="No applications found" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Aspirant', 'Job', 'Match', 'Status', 'Applied'].map((h, i) => (
                <span key={h} className={i >= 2 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {apps.slice(0, 200).map((app, idx) => (
              <div key={app.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
                style={{
                  background: idx % 2 === 0 ? '#fff' : N.cream,
                  borderBottom: idx < apps.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                }}
                onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{app.aspirant_name ?? 'Unknown'}</p>
                  <p className="text-xs truncate" style={{ color: N.muted }}>{app.aspirant_phone}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: '#475569' }}>{app.job_title}</p>
                  <p className="text-xs truncate" style={{ color: N.muted }}>{app.company_name}</p>
                </div>
                <span className={cn('text-sm font-black text-right', (app.match_score ?? 0) >= 70 ? 'text-green-600' : (app.match_score ?? 0) >= 45 ? 'text-amber-500' : '')} style={(app.match_score ?? 0) < 45 ? { color: N.muted } : {}}>
                  {app.match_score !== null ? `${app.match_score}%` : '—'}
                </span>
                <div className="text-right">
                  <Badge color={STATUS_COLOR_MAP[app.status] ?? 'gray'}>{fmt(app.status)}</Badge>
                </div>
                <span className="text-xs text-right whitespace-nowrap" style={{ color: N.muted }}>{timeAgo(app.applied_at)}</span>
              </div>
            ))}
            <div className="px-4 py-2.5" style={{ background: N.cream, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-xs" style={{ color: N.muted }}>{apps.length} application{apps.length !== 1 ? 's' : ''} shown</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
