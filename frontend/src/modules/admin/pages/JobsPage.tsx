import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, CheckCircle2, Users, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { useAdminJobs, useToggleAdminJob, useDeleteAdminJob } from '../hooks/useAdmin'
import { Empty, Badge, ExportButton, downloadCSV, StatCard } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import FilterBar from '@/shared/components/data-display/FilterBar'
import BulkActionBar from '@/shared/components/data-display/BulkActionBar'
import NavPill from '@/shared/components/navigation/NavPill'
import Modal from '@/shared/components/overlays/Modal'
import type { TableColumn } from '@/shared/types'
import type { AdminJobEntry } from '@/api/admin'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { colors } from '@/design-system/tokens'
import Button from '@/components/ui/Button'


type StatusFilter = 'all' | 'active' | 'inactive'
type JobRow = AdminJobEntry

const fmt = (s: string | null) =>
  s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'

function buildColumns(
  navigate: ReturnType<typeof useNavigate>,
  toggle: { mutate: (id: string) => void; isPending: boolean },
  onDelete: (job: AdminJobEntry) => void,
): TableColumn<JobRow>[] {
  return [
    {
      key: 'title',
      header: 'Job',
      sortable: true,
      render: row => (
        <button
          onClick={() => navigate(`/admin/jobs/${row.id}`)}
          className="min-w-0 text-left"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onMouseEnter={e => { const p = (e.currentTarget as HTMLElement).querySelector('p')!; p.style.color = colors.brand.navy }}
          onMouseLeave={e => { const p = (e.currentTarget as HTMLElement).querySelector('p')!; p.style.color = colors.text.ink }}
        >
          <p className="text-sm font-bold truncate" style={{ color: colors.text.ink }}>
            {row.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {row.company_name} · {row.sector}
          </p>
          {row.location && (
            <p className="text-xs" style={{ color: colors.text.muted }}>{row.location}</p>
          )}
        </button>
      ),
    },
    {
      key: 'employment_type',
      header: 'Type',
      sortable: true,
      align: 'right',
      width: 100,
      render: row => (
        <span className="text-xs whitespace-nowrap" style={{ color: colors.text.inkSoft }}>
          {fmt(row.employment_type)}
        </span>
      ),
    },
    {
      key: 'applicant_count',
      header: 'Applicants',
      sortable: true,
      align: 'right',
      width: 90,
      render: row => (
        <span className="text-sm font-black" style={{ color: row.applicant_count > 0 ? colors.brand.navy : colors.text.muted }}>
          {row.applicant_count}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      align: 'right',
      width: 90,
      render: row => row.is_active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 80,
      render: row => (
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={e => { e.stopPropagation(); toggle.mutate(row.id) }}
            disabled={toggle.isPending}
            aria-label={row.is_active ? 'Deactivate job' : 'Activate job'}
            title={row.is_active ? 'Deactivate' : 'Activate'}
            style={{
              height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: row.is_active ? '#FFFBEB' : '#F0FDF4',
              color: row.is_active ? '#B45309' : '#15803D',
              opacity: toggle.isPending ? 0.5 : 1,
            }}
          >
            {row.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(row) }}
            aria-label="Delete job"
            title="Delete"
            style={{
              height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, background: colors.state.dangerBg, border: 'none',
              color: colors.state.danger, cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]
}

export default function JobsPage() {
  const navigate   = useNavigate()
  const [search, setSearch]           = useState('')
  const debounced                     = useDebounce(search, 350)
  const [statusTab, setStatusTab]     = useState<StatusFilter>('all')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSector, setFilterSector]   = useState('')
  const [showFilters, setShowFilters]     = useState(false)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget]   = useState<AdminJobEntry | null>(null)

  const { data: jobs, isLoading } = useAdminJobs(debounced || undefined)
  const toggle    = useToggleAdminJob()
  const deleteJob = useDeleteAdminJob()

  const companies = useMemo(() => {
    const set = new Set((jobs ?? []).map(j => j.company_name))
    return Array.from(set).sort()
  }, [jobs])

  const sectors = useMemo(() => {
    const set = new Set((jobs ?? []).map(j => j.sector).filter(Boolean))
    return Array.from(set).sort()
  }, [jobs])

  const filtered = useMemo(() => {
    let list = jobs ?? []
    if (statusTab === 'active')   list = list.filter(j => j.is_active)
    if (statusTab === 'inactive') list = list.filter(j => !j.is_active)
    if (filterCompany) list = list.filter(j => j.company_name === filterCompany)
    if (filterSector)  list = list.filter(j => j.sector === filterSector)
    return list
  }, [jobs, statusTab, filterCompany, filterSector])

  const activeCount = useMemo(() => (jobs ?? []).filter(j => j.is_active).length, [jobs])
  const totalApps   = useMemo(() => (jobs ?? []).reduce((s, j) => s + j.applicant_count, 0), [jobs])

  const hasActiveFilters = !!(filterCompany || filterSector)
  const clearFilters = () => { setFilterCompany(''); setFilterSector('') }

  const allIds = filtered.map(j => j.id)
  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(allIds)
    })
  }, [allIds])

  const toggleOne = useCallback((key: string | number) => {
    setSelected(prev => {
      const next = new Set(prev)
      const id = String(key)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectedJobs     = filtered.filter(j => selected.has(j.id))
  const activeSelected   = selectedJobs.filter(j => j.is_active)
  const inactiveSelected = selectedJobs.filter(j => !j.is_active)

  const handleBulkExport = () => {
    downloadCSV(
      selectedJobs.map(j => ({
        title: j.title, company_name: j.company_name, sector: j.sector,
        location: j.location ?? '', employment_type: j.employment_type ?? '',
        is_active: j.is_active, applicant_count: j.applicant_count,
        created_at: j.created_at,
      })),
      'jobs_selected.csv',
    )
  }

  const STATUS_TABS = [
    { key: 'all',      label: 'All',      count: jobs?.length ?? 0 },
    { key: 'active',   label: 'Active',   count: activeCount },
    { key: 'inactive', label: 'Inactive', count: (jobs?.length ?? 0) - activeCount },
  ]

  const columns = useMemo(
    () => buildColumns(navigate, toggle, setDeleteTarget),
    [navigate, toggle],
  )

  const inputStyle: React.CSSProperties = {
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 10,
    background: '#fff',
    color: colors.text.ink,
  }

  return (
    <section className="flex flex-col gap-6">
      {/* ── Page header ── */}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
        Jobs
      </h1>

      {/* ── Filter bar ── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, company, sector…"
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={filtered.length}
        totalCount={jobs?.length ?? 0}
        resultLabel="jobs"
        actions={
          <ExportButton
            rows={filtered.map(j => ({
              title: j.title, company_name: j.company_name, sector: j.sector,
              location: j.location ?? '', employment_type: j.employment_type ?? '',
              salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '',
              is_active: j.is_active, applicant_count: j.applicant_count,
              created_at: j.created_at, expires_at: j.expires_at ?? '',
            }))}
            filename="job_postings.csv"
          />
        }
      >
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>Employer</label>
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className="h-8 text-xs px-2 outline-none min-w-[180px]" style={inputStyle}>
            <option value="">All employers</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>Sector</label>
          <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
            className="h-8 text-xs px-2 outline-none min-w-[160px]" style={inputStyle}>
            <option value="">All sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </FilterBar>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Briefcase} label="Total job postings" value={jobs?.length ?? '—'} />
        <StatCard icon={CheckCircle2} label="Active postings" value={activeCount} />
        <StatCard icon={Users} label="Total applications" value={totalApps} />
      </div>

      {/* ── Bulk action bar ── */}
      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button variant="outline" size="sm" onClick={handleBulkExport}>Export CSV</Button>
        {inactiveSelected.length > 0 && (
          <Button
            size="sm"
            loading={toggle.isPending}
            onClick={() => Promise.all(inactiveSelected.map(j => toggle.mutateAsync(j.id))).then(() => setSelected(new Set()))}
            style={{ background: '#22C55E' }}
          >
            Activate {inactiveSelected.length}
          </Button>
        )}
        {activeSelected.length > 0 && (
          <Button
            size="sm"
            loading={toggle.isPending}
            onClick={() => Promise.all(activeSelected.map(j => toggle.mutateAsync(j.id))).then(() => setSelected(new Set()))}
            style={{ background: '#F59E0B' }}
          >
            Deactivate {activeSelected.length}
          </Button>
        )}
      </BulkActionBar>

      {/* ── Status tabs + table ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <NavPill
            items={STATUS_TABS}
            active={statusTab}
            onChange={(key) => { setStatusTab(key as StatusFilter); setSelected(new Set()) }}
            size="sm"
          />
          <p className="text-xs" style={{ color: colors.text.muted }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <DataTable<JobRow>
          columns={columns}
          rows={filtered}
          rowKey={r => r.id}
          loading={isLoading}
          emptyIcon={<Briefcase size={28} color={colors.surface.elevated} />}
          emptyTitle="No job postings found"
          selectedKeys={selected}
          onToggleKey={toggleOne}
          onToggleAll={toggleAll}
        />

        {filtered.length > 0 && (
          <p className="text-xs mt-2.5" style={{ color: colors.text.muted }}>
            {filtered.length} job{filtered.length !== 1 ? 's' : ''}
            {selected.size > 0 ? ` · ${selected.size} selected` : ''} · click title to view detail
          </p>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete job posting?"
        width={400}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" size="md" fullWidth onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              fullWidth
              loading={deleteJob.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteJob.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          <span className="font-semibold" style={{ color: colors.text.ink }}>
            "{deleteTarget?.title}"
          </span>{' '}
          and all its applications will be permanently deleted.
        </p>
      </Modal>
    </section>
  )
}
