import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CheckCircle2, UserPlus } from 'lucide-react'
import { useAdminUsers, useAdminStats } from '../hooks/useAdmin'
import { Empty, Badge, ExportButton, StatCard } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import FilterBar from '@/shared/components/data-display/FilterBar'
import type { TableColumn } from '@/shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { colors } from '@/design-system/tokens'


type OnboardFilter = 'all' | 'completed' | 'in_progress'
type StatusFilter  = 'all' | 'active' | 'inactive'

type CandidateRow = {
  user_id: string
  phone: string
  email: string | null
  full_name: string | null
  city: string | null
  state: string | null
  is_completed: boolean
  is_active: boolean
  krs_composite: number | null
  application_count: number
  current_step: number
  registered_at: string
}

const COLUMNS = (navigate: ReturnType<typeof useNavigate>): TableColumn<CandidateRow>[] => [
  {
    key: 'full_name',
    header: 'Candidate',
    sortable: true,
    render: row => (
      <div
        className="min-w-0 cursor-pointer"
        onClick={() => navigate(`/admin/candidates/${row.user_id}`)}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>
            {row.full_name ?? row.phone}
          </p>
          {!row.is_active && (
            <span className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full"
              style={{ color: colors.state.danger, background: colors.state.dangerBg }}>
              Inactive
            </span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: colors.text.muted }}>
          {row.phone}{row.email ? ` · ${row.email}` : ''}
          {row.city ? ` · ${row.city}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'krs_composite',
    header: 'KRS',
    sortable: true,
    align: 'right',
    width: 60,
    render: row => (
      <span className="text-xs font-bold tabular-nums" style={{ color: colors.text.ink }}>
        {row.krs_composite !== null ? row.krs_composite : '—'}
      </span>
    ),
  },
  {
    key: 'application_count',
    header: 'Apps',
    sortable: true,
    align: 'right',
    width: 60,
    render: row => (
      <span className="text-xs font-bold tabular-nums" style={{ color: colors.text.ink }}>
        {row.application_count}
      </span>
    ),
  },
  {
    key: 'is_completed',
    header: 'Onboarding',
    sortable: true,
    width: 120,
    render: row =>
      row.is_completed
        ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: colors.state.success }}>
            <CheckCircle2 size={12} /> Done
          </span>
        )
        : <Badge color="amber">Step {row.current_step}/7</Badge>,
  },
]

const inputStyle: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 10,
  background: '#fff',
  color: colors.text.ink,
}

export default function CandidatesPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)

  const [filterCity, setFilterCity]         = useState('')
  const [filterOnboard, setFilterOnboard]   = useState<OnboardFilter>('all')
  const [filterStatus, setFilterStatus]     = useState<StatusFilter>('all')
  const [filterScoreMin, setFilterScoreMin] = useState('')
  const [filterScoreMax, setFilterScoreMax] = useState('')
  const [showFilters, setShowFilters]       = useState(false)

  const { data: stats } = useAdminStats()
  const { data: users, isLoading } = useAdminUsers(debounced || undefined)

  const cities = useMemo(() => {
    const set = new Set((users ?? []).map(u => u.city).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [users])

  const filtered = useMemo(() => {
    let list = users ?? []
    if (filterCity)                list = list.filter(u => u.city === filterCity)
    if (filterOnboard === 'completed')   list = list.filter(u => u.is_completed)
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

  const columns = useMemo(() => COLUMNS(navigate), [navigate])

  return (
    <section className="flex flex-col gap-6">
      {/* ── Page header ── */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px', marginBottom: 4 }}>
          Candidates
        </h1>
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Manage all aspirants registered on the platform.
        </p>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, phone, or email…"
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={!!hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={filtered.length}
        totalCount={users?.length ?? 0}
        resultLabel="candidates"
        actions={<ExportButton rows={exportRows} filename="candidates.csv" />}
      >
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>City</label>
          <select
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
            className="h-8 text-xs px-2 outline-none min-w-[140px]"
            style={inputStyle}
          >
            <option value="">All cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>Onboarding</label>
          <select
            value={filterOnboard}
            onChange={e => setFilterOnboard(e.target.value as OnboardFilter)}
            className="h-8 text-xs px-2 outline-none min-w-[140px]"
            style={inputStyle}
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>Account Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as StatusFilter)}
            className="h-8 text-xs px-2 outline-none min-w-[130px]"
            style={inputStyle}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive/Suspended</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>KRS Score Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={100} placeholder="Min"
              value={filterScoreMin}
              onChange={e => setFilterScoreMin(e.target.value)}
              className="h-8 w-16 text-xs px-2 outline-none"
              style={inputStyle}
            />
            <span className="text-xs" style={{ color: colors.text.muted }}>–</span>
            <input
              type="number" min={0} max={100} placeholder="Max"
              value={filterScoreMax}
              onChange={e => setFilterScoreMax(e.target.value)}
              className="h-8 w-16 text-xs px-2 outline-none"
              style={inputStyle}
            />
          </div>
        </div>
      </FilterBar>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Candidates" value={stats?.total_aspirants ?? '—'} />
        <StatCard icon={CheckCircle2} label="Onboarded" value={stats?.completed_onboarding ?? '—'} />
        <StatCard icon={UserPlus} label="New (7 days)" value={stats?.new_users_last_7d ?? '—'} />
      </div>

      {/* ── Result meta ── */}
      {!showFilters && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
          {hasActiveFilters && (
            <span className="text-xs font-semibold" style={{ color: colors.brand.navy }}>
              {filtered.length} of {users?.length ?? 0} shown
            </span>
          )}
        </div>
      )}

      {/* ── DataTable ── */}
      <DataTable<CandidateRow>
        columns={columns}
        rows={filtered as CandidateRow[]}
        rowKey={r => r.user_id}
        loading={isLoading}
        emptyIcon={<Users size={28} color={colors.surface.elevated} />}
        emptyTitle={
          hasActiveFilters
            ? 'No candidates match your filters'
            : debounced
              ? `No candidates matching "${debounced}"`
              : 'No candidates yet'
        }
      />
    </section>
  )
}
