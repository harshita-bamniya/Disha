import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeadphonesIcon, TicketIcon, Clock, CheckCircle2, AlertCircle,
  Search, ChevronRight, Filter, X,
} from 'lucide-react'
import { useAdminTickets } from '../hooks/useAdmin'
import type { TicketEntry } from '@/api/admin'
import { Spinner, Empty } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

type StatusTab = 'all' | 'open' | 'pending' | 'resolved' | 'closed'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low:    'bg-gray-100 text-gray-500',
}

const STATUS_COLORS: Record<string, string> = {
  open:     'bg-blue-50 text-blue-700',
  pending:  'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  closed:   'bg-gray-100 text-gray-500',
}

function slaClass(deadline: string | null, status: string): string {
  if (!deadline || status === 'resolved' || status === 'closed') return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) return 'text-red-600 font-bold'
  if (diff < 4 * 60 * 60 * 1000) return 'text-orange-600 font-semibold'
  return 'text-gray-400'
}

function formatSla(deadline: string | null, status: string): string {
  if (!deadline || status === 'resolved' || status === 'closed') return '—'
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff < 0) return 'Breached'
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.floor(diff / 60_000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function SupportPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useAdminTickets(tab !== 'all' ? { status: tab } : {})
  const tickets = data?.items ?? []

  const filtered = useMemo(() => {
    let list = tickets
    if (search)          list = list.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()) || t.reporter_name?.toLowerCase().includes(search.toLowerCase()))
    if (filterPriority)  list = list.filter(t => t.priority === filterPriority)
    if (filterEntity)    list = list.filter(t => t.entity_type === filterEntity)
    if (filterCategory)  list = list.filter(t => t.category === filterCategory)
    return list
  }, [tickets, search, filterPriority, filterEntity, filterCategory])

  const counts = useMemo(() => ({
    open:     tickets.filter(t => t.status === 'open').length,
    pending:  tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed:   tickets.filter(t => t.status === 'closed').length,
    sla_warn: tickets.filter(t => {
      if (!t.sla_deadline || t.status === 'resolved' || t.status === 'closed') return false
      const diff = new Date(t.sla_deadline).getTime() - Date.now()
      return diff < 4 * 60 * 60 * 1000
    }).length,
  }), [tickets])

  const hasFilters = filterPriority || filterEntity || filterCategory

  const TABS: { key: StatusTab; label: string; count?: number }[] = [
    { key: 'all',      label: 'All' },
    { key: 'open',     label: 'Open',     count: counts.open },
    { key: 'pending',  label: 'Pending',  count: counts.pending },
    { key: 'resolved', label: 'Resolved', count: counts.resolved },
    { key: 'closed',   label: 'Closed',   count: counts.closed },
  ]

  const selectStyle = { height: 32, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, color: N.ink, padding: '0 8px', outline: 'none', background: '#fff', minWidth: 130 }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px', marginBottom: 4 }}>Support</h1>
        <p style={{ fontSize: 14, color: N.muted }}>Manage employer and candidate support tickets, SLA compliance, and escalations.</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: TicketIcon,   label: 'Open Tickets',     value: counts.open },
          { icon: Clock,        label: 'Pending Response', value: counts.pending },
          { icon: AlertCircle,  label: 'SLA Warnings',     value: counts.sla_warn },
          { icon: CheckCircle2, label: 'Resolved',         value: counts.resolved },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: N.creamDk, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon className="w-4 h-4" style={{ color: N.ink }} />
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{value}</p>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginTop: 4 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: N.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, color: N.ink, outline: 'none' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-1.5"
          style={{
            height: 36, padding: '0 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none',
            background: (showFilters || hasFilters) ? N.navy : '#fff',
            color: (showFilters || hasFilters) ? '#fff' : N.ink,
            border: (showFilters || hasFilters) ? 'none' : '1px solid rgba(0,0,0,0.08)',
          } as React.CSSProperties}
        >
          <Filter size={13} /> Filters
        </button>
        {hasFilters && (
          <button
            onClick={() => { setFilterPriority(''); setFilterEntity(''); setFilterCategory('') }}
            className="flex items-center gap-1"
            style={{ height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, fontWeight: 600, color: N.muted, background: '#fff' }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Priority</label>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Entity type</label>
            <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              <option value="employer">Employer</option>
              <option value="candidate">Candidate</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
              <option value="">All categories</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="account">Account</option>
              <option value="jobs">Jobs</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
      )}

      {/* Tabs + table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Tab bar as pills */}
        <div style={{ display: 'flex', gap: 2, padding: '12px 16px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? N.ink : N.muted,
                marginBottom: tab === t.key ? -1 : 0,
                borderBottom: tab === t.key ? '2px solid ' + N.navy : 'none',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  fontSize: 10, padding: '0 6px', borderRadius: 9999, fontWeight: 700,
                  background: tab === t.key ? N.creamDk : N.cream,
                  color: tab === t.key ? N.navy : N.muted,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)', fontSize: 10, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Subject</span>
          <span>Status</span>
          <span>Priority</span>
          <span>SLA</span>
          <span>Messages</span>
          <span />
        </div>

        {isLoading ? <Spinner /> : !filtered.length ? (
          <Empty icon={HeadphonesIcon} text="No tickets found" />
        ) : (
          filtered.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin/support/${t.id}`)}
              className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
              style={{
                background: idx % 2 === 0 ? '#fff' : N.cream,
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
            >
              <div className="min-w-0">
                <p style={{ fontSize: 14, fontWeight: 600, color: N.ink }} className="truncate">{t.subject}</p>
                <p style={{ fontSize: 12, color: N.muted }} className="truncate">
                  {t.reporter_name ?? 'Unknown reporter'}
                  {t.entity_type !== 'general' && ` · ${t.entity_type}`}
                </p>
              </div>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[t.status])}>
                {t.status}
              </span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', PRIORITY_COLORS[t.priority])}>
                {t.priority}
              </span>
              <span className={cn('text-xs tabular-nums', slaClass(t.sla_deadline, t.status))}>
                {formatSla(t.sla_deadline, t.status)}
              </span>
              <span style={{ fontSize: 12, color: N.muted, textAlign: 'right', tabularNums: true } as React.CSSProperties}>{t.message_count}</span>
              <ChevronRight size={14} style={{ color: N.muted, flexShrink: 0 }} />
            </button>
          ))
        )}
      </div>
    </section>
  )
}
