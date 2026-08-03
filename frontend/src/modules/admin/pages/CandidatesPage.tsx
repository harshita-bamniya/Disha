import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, CheckCircle2, ChevronRight, Filter, X } from 'lucide-react'
import { useAdminUsers, useAdminStats } from '../hooks/useAdmin'
import { Spinner, Empty, Badge, ExportButton } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

type OnboardFilter = 'all' | 'completed' | 'in_progress'
type StatusFilter  = 'all' | 'active' | 'inactive'

export default function CandidatesPage() {
  const navigate = useNavigate()
  const [search, setSearch]       = useState('')
  const [debounced, setDebounced] = useState('')

  // Advanced filters
  const [filterCity, setFilterCity]           = useState('')
  const [filterOnboard, setFilterOnboard]     = useState<OnboardFilter>('all')
  const [filterStatus, setFilterStatus]       = useState<StatusFilter>('all')
  const [filterScoreMin, setFilterScoreMin]   = useState('')
  const [filterScoreMax, setFilterScoreMax]   = useState('')
  const [showFilters, setShowFilters]         = useState(false)

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 300)
  }

  const { data: stats } = useAdminStats()
  const { data: users, isLoading } = useAdminUsers(debounced || undefined)

  const cities = useMemo(() => {
    const set = new Set((users ?? []).map(u => u.city).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [users])

  const filtered = useMemo(() => {
    let list = users ?? []
    if (filterCity)     list = list.filter(u => u.city === filterCity)
    if (filterOnboard === 'completed')  list = list.filter(u => u.is_completed)
    if (filterOnboard === 'in_progress') list = list.filter(u => !u.is_completed)
    if (filterStatus === 'active')   list = list.filter(u => u.is_active)
    if (filterStatus === 'inactive') list = list.filter(u => !u.is_active)
    const min = filterScoreMin !== '' ? parseFloat(filterScoreMin) : null
    const max = filterScoreMax !== '' ? parseFloat(filterScoreMax) : null
    if (min !== null) list = list.filter(u => u.krs_composite !== null && u.krs_composite >= min)
    if (max !== null) list = list.filter(u => u.krs_composite !== null && u.krs_composite <= max)
    return list
  }, [users, filterCity, filterOnboard, filterStatus, filterScoreMin, filterScoreMax])

  const hasActiveFilters = filterCity || filterOnboard !== 'all' || filterStatus !== 'all' || filterScoreMin || filterScoreMax
  const clearFilters = () => {
    setFilterCity(''); setFilterOnboard('all'); setFilterStatus('all')
    setFilterScoreMin(''); setFilterScoreMax('')
  }

  const exportRows = filtered.map(u => ({
    user_id: u.user_id, phone: u.phone, email: u.email ?? '',
    full_name: u.full_name ?? '', city: u.city ?? '', state: u.state ?? '',
    is_completed: u.is_completed, is_active: u.is_active,
    krs_composite: u.krs_composite ?? '', application_count: u.application_count,
    registered_at: u.registered_at,
  }))

  const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px', marginBottom: 4 }}>Candidates</h1>
          <p className="text-sm" style={{ color: N.muted }}>Manage all aspirants registered on the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: N.muted }} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, phone, or email…"
              className="w-60 pl-8 pr-3 h-9 text-xs outline-none"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${N.navy}`)}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)')}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold transition-colors"
            style={{
              borderRadius: 10,
              background: showFilters || hasActiveFilters ? N.navy : '#fff',
              color: showFilters || hasActiveFilters ? '#fff' : N.ink,
              border: showFilters || hasActiveFilters ? 'none' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <Filter size={13} /> Filters
            {hasActiveFilters && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 h-9 px-3 text-xs font-semibold" style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: N.muted }}>
              <X size={12} /> Clear
            </button>
          )}
          <ExportButton rows={exportRows} filename="candidates.csv" />
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px' }} className="flex items-start gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>City</label>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
              className="h-8 text-xs px-2 outline-none min-w-[140px]"
              style={inputStyle}>
              <option value="">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>Onboarding</label>
            <select value={filterOnboard} onChange={e => setFilterOnboard(e.target.value as OnboardFilter)}
              className="h-8 text-xs px-2 outline-none min-w-[140px]"
              style={inputStyle}>
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>Account Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)}
              className="h-8 text-xs px-2 outline-none min-w-[130px]"
              style={inputStyle}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive/Suspended</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>KRS Score Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={100} placeholder="Min"
                value={filterScoreMin}
                onChange={e => setFilterScoreMin(e.target.value)}
                className="h-8 w-16 text-xs px-2 outline-none"
                style={inputStyle}
              />
              <span className="text-xs" style={{ color: N.muted }}>–</span>
              <input
                type="number" min={0} max={100} placeholder="Max"
                value={filterScoreMax}
                onChange={e => setFilterScoreMax(e.target.value)}
                className="h-8 w-16 text-xs px-2 outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-xs self-end pb-1 ml-auto" style={{ color: N.muted }}>
            {filtered.length} of {users?.length ?? 0} candidates
          </p>
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Candidates',  value: stats?.total_aspirants ?? '—' },
          { label: 'Onboarded',         value: stats?.completed_onboarding ?? '—' },
          { label: 'New (7 days)',       value: stats?.new_users_last_7d ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* Result count */}
      {!showFilters && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: N.muted }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          {hasActiveFilters && <span className="text-xs font-semibold" style={{ color: N.navy }}>{filtered.length} of {users?.length ?? 0} shown</span>}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {['Candidate', 'KRS', 'Apps', 'Status', ''].map((h, i) => (
            <span key={i} className={i >= 1 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
          ))}
        </div>

        {isLoading ? (
          <Spinner />
        ) : !filtered.length ? (
          <Empty icon={Users} text={hasActiveFilters ? 'No candidates match your filters' : debounced ? `No candidates matching "${debounced}"` : 'No candidates yet'} />
        ) : (
          filtered.map((user, idx) => (
            <button
              key={user.user_id}
              onClick={() => navigate(`/admin/candidates/${user.user_id}`)}
              className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
              style={{
                background: idx % 2 === 0 ? '#fff' : N.cream,
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
              }}
              onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{user.full_name ?? user.phone}</p>
                  {!user.is_active && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">Inactive</span>}
                </div>
                <p className="text-xs truncate" style={{ color: N.muted }}>
                  {user.phone}{user.email ? ` · ${user.email}` : ''}
                  {user.city ? ` · ${user.city}` : ''}
                </p>
              </div>
              <span className="text-xs font-bold text-right tabular-nums" style={{ color: N.ink }}>
                {user.krs_composite !== null ? user.krs_composite : '—'}
              </span>
              <span className="text-xs font-bold text-right tabular-nums" style={{ color: N.ink }}>
                {user.application_count}
              </span>
              <span className="text-right">
                {user.is_completed
                  ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle2 size={12} /> Done</span>
                  : <Badge color="amber">Step {user.current_step}/7</Badge>}
              </span>
              <ChevronRight size={14} className="shrink-0" style={{ color: N.muted }} />
            </button>
          ))
        )}
      </div>
    </section>
  )
}
