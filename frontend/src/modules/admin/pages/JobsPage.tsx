import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Search, ToggleLeft, ToggleRight, Trash2, CheckSquare, Square, Filter, X } from 'lucide-react'
import { useAdminJobs, useToggleAdminJob, useDeleteAdminJob } from '../hooks/useAdmin'
import { Spinner, Empty, Badge, ExportButton, downloadCSV } from '../shared/adminUI'
import { cn } from '@/lib/utils'
import type { AdminJobEntry } from '@/api/admin'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

type StatusFilter = 'all' | 'active' | 'inactive'

export default function JobsPage() {
  const navigate   = useNavigate()
  const [search, setSearch]           = useState('')
  const [debounced, setDebounced]     = useState('')
  const [statusTab, setStatusTab]     = useState<StatusFilter>('all')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSector, setFilterSector]   = useState('')
  const [showFilters, setShowFilters]     = useState(false)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget]   = useState<AdminJobEntry | null>(null)

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 350)
  }

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

  const hasActiveFilters = filterCompany || filterSector
  const clearFilters = () => { setFilterCompany(''); setFilterSector('') }

  const allIds = filtered.map(j => j.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectedJobs    = filtered.filter(j => selected.has(j.id))
  const activeSelected  = selectedJobs.filter(j => j.is_active)
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

  const fmt = (s: string | null) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all',      label: 'All',      count: jobs?.length ?? 0 },
    { key: 'active',   label: 'Active',   count: activeCount },
    { key: 'inactive', label: 'Inactive', count: (jobs?.length ?? 0) - activeCount },
  ]

  const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Jobs</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: N.muted }} />
            <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search title, company, sector…"
              className="pl-8 pr-3 h-9 text-xs outline-none w-60"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${N.navy}`)}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,0,0,0.08)')} />
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
          <ExportButton
            rows={(filtered).map(j => ({
              title: j.title, company_name: j.company_name, sector: j.sector,
              location: j.location ?? '', employment_type: j.employment_type ?? '',
              salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '',
              is_active: j.is_active, applicant_count: j.applicant_count,
              created_at: j.created_at, expires_at: j.expires_at ?? '',
            }))}
            filename="job_postings.csv"
          />
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px' }} className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>Employer</label>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="h-8 text-xs px-2 outline-none min-w-[180px]" style={inputStyle}>
              <option value="">All employers</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>Sector</label>
            <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
              className="h-8 text-xs px-2 outline-none min-w-[160px]" style={inputStyle}>
              <option value="">All sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="text-xs mt-4 ml-auto" style={{ color: N.muted }}>
            Showing {filtered.length} of {jobs?.length ?? 0} jobs
          </p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total job postings', value: jobs?.length ?? '—' },
          { label: 'Active postings',    value: activeCount },
          { label: 'Total applications', value: totalApps },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3" style={{ background: N.cream, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16 }}>
          <span className="text-sm font-semibold" style={{ color: N.ink }}>{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button onClick={handleBulkExport}
              className="h-8 px-3 text-xs font-semibold" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, color: N.ink }}>
              Export CSV
            </button>
            {inactiveSelected.length > 0 && (
              <button
                onClick={() => Promise.all(inactiveSelected.map(j => toggle.mutateAsync(j.id))).then(() => setSelected(new Set()))}
                disabled={toggle.isPending}
                className="h-8 px-3 text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: '#22C55E', borderRadius: 8, border: 'none' }}
              >
                Activate {inactiveSelected.length}
              </button>
            )}
            {activeSelected.length > 0 && (
              <button
                onClick={() => Promise.all(activeSelected.map(j => toggle.mutateAsync(j.id))).then(() => setSelected(new Set()))}
                disabled={toggle.isPending}
                className="h-8 px-3 text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: '#F59E0B', borderRadius: 8, border: 'none' }}
              >
                Deactivate {activeSelected.length}
              </button>
            )}
            <button onClick={() => setSelected(new Set())}
              className="h-8 px-3 text-xs font-semibold" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', color: N.muted }}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Status tabs */}
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 3, display: 'flex', gap: 2 }}>
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => { setStatusTab(t.key); setSelected(new Set()) }}
                className="px-3 py-1 text-xs font-semibold transition-all"
                style={{
                  borderRadius: 7,
                  background: statusTab === t.key ? N.navy : 'transparent',
                  color: statusTab === t.key ? '#fff' : N.muted,
                  border: 'none',
                }}>
                {t.label}
                {t.count > 0 && <span className="ml-1 text-[10px] opacity-70">({t.count})</span>}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: N.muted }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {isLoading ? <Spinner /> : !filtered.length ? (
          <Empty icon={Briefcase} text="No job postings found" />
        ) : (
          <>
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 items-center" style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <button onClick={toggleAll} className="flex items-center justify-center" style={{ color: N.muted }}>
                {allSelected ? <CheckSquare className="w-4 h-4" style={{ color: N.navy }} /> : <Square className="w-4 h-4" />}
              </button>
              {['Job', 'Type', 'Applicants', 'Status', 'Actions'].map((h, i) => (
                <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</span>
              ))}
            </div>
            {filtered.map((job, idx) => (
              <div key={job.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center"
                style={{
                  background: selected.has(job.id) ? N.creamDk : idx % 2 === 0 ? '#fff' : N.cream,
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                }}>
                <button onClick={e => { e.stopPropagation(); toggleOne(job.id) }}
                  className="flex items-center justify-center" style={{ color: N.muted }}>
                  {selected.has(job.id) ? <CheckSquare className="w-4 h-4" style={{ color: N.navy }} /> : <Square className="w-4 h-4" />}
                </button>
                <button onClick={() => navigate(`/admin/jobs/${job.id}`)} className="min-w-0 text-left"
                  onMouseOver={e => (e.currentTarget.querySelector('p')!.style.color = N.navy)}
                  onMouseOut={e => (e.currentTarget.querySelector('p')!.style.color = N.ink)}>
                  <p className="text-sm font-bold truncate" style={{ color: N.ink }}>{job.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: N.muted }}>{job.company_name} · {job.sector}</p>
                  {job.location && <p className="text-xs" style={{ color: N.muted }}>{job.location}</p>}
                </button>
                <span className="text-xs text-right whitespace-nowrap" style={{ color: '#475569' }}>{fmt(job.employment_type)}</span>
                <span className="text-sm font-black text-right" style={{ color: job.applicant_count > 0 ? N.navy : N.muted }}>
                  {job.applicant_count}
                </span>
                <div className="text-right">
                  {job.is_active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button onClick={() => toggle.mutate(job.id)} disabled={toggle.isPending} title={job.is_active ? 'Deactivate' : 'Activate'}
                    className="h-7 w-7 flex items-center justify-center disabled:opacity-50 transition-colors"
                    style={{
                      borderRadius: 8,
                      background: job.is_active ? '#FFFBEB' : '#F0FDF4',
                      color: job.is_active ? '#B45309' : '#15803D',
                      border: 'none',
                    }}>
                    {job.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => setDeleteTarget(job)} title="Delete"
                    className="h-7 w-7 flex items-center justify-center transition-colors"
                    style={{ borderRadius: 8, background: '#FEF2F2', border: 'none', color: '#EF4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="px-4 py-2.5" style={{ background: N.cream, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-xs" style={{ color: N.muted }}>
                {filtered.length} job{filtered.length !== 1 ? 's' : ''}
                {selected.size > 0 ? ` · ${selected.size} selected` : ''} · click title to view detail
              </p>
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 24, maxWidth: 384, width: '100%' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: N.ink }}>Delete job posting?</h3>
            <p className="text-sm mb-5" style={{ color: N.muted }}>
              <span className="font-semibold" style={{ color: N.ink }}>"{deleteTarget.title}"</span> and all its applications will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 text-sm font-medium" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }}>Cancel</button>
              <button onClick={() => deleteJob.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} disabled={deleteJob.isPending}
                className="flex-1 h-10 text-sm font-semibold disabled:opacity-40"
                style={{ background: '#EF4444', color: '#fff', borderRadius: 10, border: 'none' }}>
                {deleteJob.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
