import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Clock, ShieldCheck } from 'lucide-react'
import { useAdminEmployers, useRevokeEmployer, useAdminStats } from '../hooks/useAdmin'
import { Empty, Badge, ExportButton, downloadCSV, StatCard } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import FilterBar from '@/shared/components/data-display/FilterBar'
import BulkActionBar from '@/shared/components/data-display/BulkActionBar'
import NavPill from '@/shared/components/navigation/NavPill'
import Modal from '@/shared/components/overlays/Modal'
import type { TableColumn } from '@/shared/types'
import type { EmployerEntry, EmployerStatus } from '@/api/admin'
import { colors } from '@/design-system/tokens'
import Button from '@/components/ui/Button'


const STATUS_TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'all',      label: 'All' },
] as const

type EmployerRow = EmployerEntry

function buildColumns(
  navigate: ReturnType<typeof useNavigate>,
  onRevoke: (emp: EmployerEntry) => void,
): TableColumn<EmployerRow>[] {
  return [
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
      render: row => (
        <div
          className="min-w-0 cursor-pointer"
          onClick={() => navigate(`/admin/employers/${row.id}`)}
        >
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{row.company_name}</p>
            {row.is_approved
              ? <Badge color="green">Approved</Badge>
              : row.rejection_reason
                ? <Badge color="red">Rejected</Badge>
                : <Badge color="amber">Pending</Badge>}
          </div>
          <p style={{ fontSize: 12, color: colors.text.muted }}>
            {[row.industry, row.company_size ? `${row.company_size} employees` : null, row.city].filter(Boolean).join(' · ') || 'Profile not completed yet'}
          </p>
          <p style={{ fontSize: 12, color: colors.text.muted }}>
            {[row.contact_person ? `${row.contact_person}${row.designation ? `, ${row.designation}` : ''}` : null, row.phone].filter(Boolean).join(' · ')}
          </p>
          {row.gst_number && (
            <p style={{ fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', marginTop: 2 }}>
              GST: {row.gst_number}
            </p>
          )}
          {row.rejection_reason && (
            <p style={{ fontSize: 11, color: colors.state.danger, marginTop: 2 }}>
              Rejected: {row.rejection_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'job_count',
      header: 'Jobs',
      sortable: true,
      align: 'right',
      width: 64,
      render: row => (
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{row.job_count}</span>
      ),
    },
    {
      key: 'application_count',
      header: 'Apps',
      sortable: true,
      align: 'right',
      width: 64,
      render: row => (
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{row.application_count}</span>
      ),
    },
    {
      key: 'registered_at',
      header: 'Registered',
      sortable: true,
      align: 'right',
      width: 100,
      render: row => (
        <span style={{ fontSize: 12, color: colors.text.muted, whiteSpace: 'nowrap' }}>
          {new Date(row.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 120,
      render: row => (
        <div className="flex gap-1.5 justify-end">
          {row.is_approved ? (
            <button
              onClick={e => { e.stopPropagation(); onRevoke(row) }}
              style={{
                height: 30, padding: '0 12px', borderRadius: 8,
                border: '0.5px solid #E2E8F0', background: '#fff',
                fontSize: 12, fontWeight: 600, color: colors.text.muted, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = colors.state.dangerBg
                e.currentTarget.style.color = colors.state.danger
                e.currentTarget.style.borderColor = '#FECACA'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.color = colors.text.muted
                e.currentTarget.style.borderColor = '#E2E8F0'
              }}
            >
              Revoke
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); navigate('/admin/kyc') }}
              style={{
                height: 30, padding: '0 12px', borderRadius: 8,
                border: `0.5px solid rgba(26,39,68,0.2)`,
                background: 'rgba(26,39,68,0.04)',
                fontSize: 12, fontWeight: 600, color: colors.brand.navy, cursor: 'pointer',
              }}
            >
              Review KYC
            </button>
          )}
        </div>
      ),
    },
  ]
}

export default function EmployersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as EmployerStatus) || 'approved'
  const [tab, setTab] = useState<EmployerStatus>(initialStatus)

  useEffect(() => {
    const s = searchParams.get('status') as EmployerStatus | null
    if (s) setTab(s)
  }, [searchParams])

  const { data: employers, isLoading } = useAdminEmployers(tab)
  const revoke = useRevokeEmployer()
  const { data: stats } = useAdminStats()

  const [revokeTarget, setRevokeTarget] = useState<EmployerEntry | null>(null)
  const [search, setSearch]             = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterCity, setFilterCity]     = useState('')
  const [showFilters, setShowFilters]   = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())

  const industries = useMemo(() => {
    const set = new Set((employers ?? []).map(e => e.industry).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [employers])

  const cities = useMemo(() => {
    const set = new Set((employers ?? []).map(e => e.city).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [employers])

  const filtered = useMemo(() => {
    let list = employers ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.company_name.toLowerCase().includes(q) ||
        (e.contact_person ?? '').toLowerCase().includes(q) ||
        e.phone.includes(q) ||
        (e.city ?? '').toLowerCase().includes(q),
      )
    }
    if (filterIndustry) list = list.filter(e => e.industry === filterIndustry)
    if (filterCity)     list = list.filter(e => e.city === filterCity)
    return list
  }, [employers, search, filterIndustry, filterCity])

  const hasActiveFilters = !!(search || filterIndustry || filterCity)
  const clearFilters = () => { setSearch(''); setFilterIndustry(''); setFilterCity('') }

  const allIds = filtered.map(e => e.id)
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

  const selectedEmployers = filtered.filter(e => selected.has(e.id))
  const approvedSelected  = selectedEmployers.filter(e => e.is_approved)

  const handleBulkExport = () => {
    downloadCSV(
      selectedEmployers.map(e => ({
        company_name: e.company_name, contact_person: e.contact_person ?? '',
        phone: e.phone, city: e.city ?? '', industry: e.industry ?? '',
        company_size: e.company_size ?? '', is_approved: e.is_approved,
        job_count: e.job_count, application_count: e.application_count,
        registered_at: e.registered_at,
      })),
      'employers_selected.csv',
    )
  }

  const handleTabChange = (t: string) => { setTab(t as EmployerStatus); setSelected(new Set()) }

  const tabItems = STATUS_TABS.map(t => ({
    key: t.key,
    label: t.key === 'pending' && stats && stats.pending_employers > 0
      ? `Pending`
      : t.label,
    count: t.key === 'pending' && stats?.pending_employers ? stats.pending_employers : undefined,
  }))

  const columns = useMemo(() => buildColumns(navigate, setRevokeTarget), [navigate])

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid #E2E8F0',
    borderRadius: 10,
    background: '#fff',
    color: colors.text.ink,
    outline: 'none',
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
        Employers
      </h1>

      {/* ── Filter bar ── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, contact, phone, city…"
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={filtered.length}
        totalCount={employers?.length ?? 0}
        resultLabel="employers"
      >
        {[
          { label: 'Industry', value: filterIndustry, onChange: setFilterIndustry, options: industries, placeholder: 'All industries' },
          { label: 'City',     value: filterCity,     onChange: setFilterCity,     options: cities,     placeholder: 'All cities' },
        ].map(({ label, value, onChange, options, placeholder }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
            <select
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{ ...inputStyle, height: 34, fontSize: 12, padding: '0 10px', minWidth: 160 }}
            >
              <option value="">{placeholder}</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </FilterBar>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <StatCard icon={Clock} label="Awaiting KYC" value={stats?.pending_employers ?? '—'} />
        <StatCard icon={ShieldCheck} label="Verified employers" value={stats?.approved_employers ?? '—'} />
        <StatCard icon={Building2} label="Total employers" value={stats?.total_employers ?? '—'} />
      </div>

      {/* ── Bulk action bar ── */}
      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button variant="outline" size="sm" onClick={handleBulkExport}>Export CSV</Button>
        {approvedSelected.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            loading={revoke.isPending}
            onClick={() => {
              if (!window.confirm(`Revoke ${approvedSelected.length} approved employer(s)?`)) return
              Promise.all(approvedSelected.map(e => revoke.mutateAsync(e.id))).then(() => setSelected(new Set()))
            }}
          >
            Revoke {approvedSelected.length} approved
          </Button>
        )}
      </BulkActionBar>

      {/* ── Table section ── */}
      <div>
        {/* Table header: tabs + export */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, marginBottom: 2 }}>Employer Directory</p>
            <p style={{ fontSize: 11, color: colors.text.muted }}>
              Verification is approved/rejected from{' '}
              <button
                onClick={() => navigate('/admin/kyc')}
                style={{ color: colors.brand.navy, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}
              >
                KYC Verification
              </button>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavPill
              items={tabItems}
              active={tab}
              onChange={handleTabChange}
              size="sm"
            />
            <ExportButton
              rows={filtered.map(e => ({
                company_name: e.company_name, contact_person: e.contact_person ?? '',
                phone: e.phone, city: e.city ?? '', industry: e.industry ?? '',
                company_size: e.company_size ?? '', is_approved: e.is_approved,
                job_count: e.job_count, application_count: e.application_count,
                registered_at: e.registered_at,
              }))}
              filename={`employers_${tab}.csv`}
            />
          </div>
        </div>

        {!isLoading && filtered.length === 0 ? (
          <Empty
            icon={Building2}
            text={hasActiveFilters ? 'No employers match your filters' : tab === 'pending' ? 'No pending registrations' : 'No employers found'}
          />
        ) : (
          <DataTable<EmployerRow>
            columns={columns}
            rows={filtered}
            rowKey={r => r.id}
            loading={isLoading}
            emptyIcon={<Building2 size={28} color={colors.surface.elevated} />}
            emptyTitle="No employers found"
            selectedKeys={selected}
            onToggleKey={toggleOne}
            onToggleAll={toggleAll}
          />
        )}

        {filtered.length > 0 && (
          <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 10 }}>
            {filtered.length}{filtered.length !== employers?.length ? ` of ${employers?.length}` : ''} employer{filtered.length !== 1 ? 's' : ''}
            {selected.size > 0 ? ` · ${selected.size} selected` : ''} · click company to view profile
          </p>
        )}
      </div>

      {/* ── Revoke confirmation modal ── */}
      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke approval?"
        width={360}
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" size="md" fullWidth onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              fullWidth
              loading={revoke.isPending}
              onClick={() => {
                if (!revokeTarget) return
                revoke.mutate(revokeTarget.id, {
                  onSuccess: () => {
                    setRevokeTarget(null)
                    setSelected(s => { const n = new Set(s); n.delete(revokeTarget.id); return n })
                  },
                })
              }}
            >
              Revoke
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: colors.text.muted, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: colors.text.ink }}>{revokeTarget?.company_name}</span>{' '}
          will lose access and their jobs will be unlisted.
        </p>
      </Modal>

    </section>
  )
}
