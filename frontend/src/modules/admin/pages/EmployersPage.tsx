import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, CheckSquare, Square, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAdminEmployers, useRevokeEmployer, useAdminStats } from '../hooks/useAdmin'
import { Spinner, Empty, Badge, ExportButton, downloadCSV } from '../shared/adminUI'
import { cn } from '@/lib/utils'
import type { EmployerEntry, EmployerStatus } from '@/api/admin'

const N = { navy: '#1A2744', navySoft: '#243359', ink: '#1E3A5F', muted: '#94A3B8' }

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
  const [revokeTarget, setRevokeTarget] = useState<EmployerEntry | null>(null)
  const { data: stats } = useAdminStats()

  const [search, setSearch]             = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterCity, setFilterCity]     = useState('')
  const [showFilters, setShowFilters]   = useState(false)

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

  const hasActiveFilters = search || filterIndustry || filterCity
  const clearFilters = () => { setSearch(''); setFilterIndustry(''); setFilterCity('') }

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allIds = filtered.map(e => e.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

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

  const handleTabChange = (t: EmployerStatus) => { setTab(t); setSelected(new Set()) }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
          Employers
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} color={N.muted} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, contact, phone, city…"
              style={{
                paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 10,
                border: `0.5px solid ${search ? N.navy : '#E2E8F0'}`,
                fontSize: 12, color: N.ink, background: '#fff', width: 240,
                outline: 'none', boxShadow: search ? `0 0 0 3px rgba(26,39,68,0.07)` : 'none',
              }}
            />
          </div>
          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
              border: `0.5px solid ${showFilters || hasActiveFilters ? N.navy : '#E2E8F0'}`,
              background: showFilters || hasActiveFilters ? N.navy : '#fff',
              color: showFilters || hasActiveFilters ? '#fff' : N.ink,
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <SlidersHorizontal size={13} />
            Filters
            {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 36, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                border: '0.5px solid #E2E8F0', background: '#fff',
                fontSize: 12, fontWeight: 600, color: N.muted,
              }}
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Advanced filters panel ── */}
      {showFilters && (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Industry', value: filterIndustry, onChange: setFilterIndustry, options: industries, placeholder: 'All industries' },
            { label: 'City',     value: filterCity,     onChange: setFilterCity,     options: cities,     placeholder: 'All cities' },
          ].map(({ label, value, onChange, options, placeholder }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
              <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                  height: 34, borderRadius: 9, border: '0.5px solid #E2E8F0',
                  fontSize: 12, color: N.ink, background: '#fff',
                  padding: '0 10px', outline: 'none', minWidth: 160,
                }}
              >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <p style={{ fontSize: 12, color: N.muted, marginLeft: 'auto', alignSelf: 'center' }}>
            {filtered.length} of {employers?.length ?? 0} employers
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Awaiting KYC',       value: stats?.pending_employers  },
          { label: 'Verified employers',  value: stats?.approved_employers },
          { label: 'Total employers',     value: stats?.total_employers    },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.08)',
            padding: '20px 22px',
            transition: 'background 0.2s',
          }}
            onMouseOver={e => (e.currentTarget.style.background = '#EAECF0')}
            onMouseOut={e => (e.currentTarget.style.background = '#fff')}
          >
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 30, fontWeight: 800, color: N.ink, lineHeight: 1 }}>{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div style={{
          background: '#F4F5F7', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: N.navy }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={handleBulkExport}
              style={{
                height: 32, padding: '0 14px', borderRadius: 9,
                border: '0.5px solid #E2E8F0', background: '#fff',
                fontSize: 12, fontWeight: 600, color: N.ink, cursor: 'pointer',
              }}
            >Export CSV</button>
            {approvedSelected.length > 0 && (
              <button
                onClick={() => {
                  if (!window.confirm(`Revoke ${approvedSelected.length} approved employer(s)?`)) return
                  Promise.all(approvedSelected.map(e => revoke.mutateAsync(e.id))).then(() => setSelected(new Set()))
                }}
                disabled={revoke.isPending}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 9,
                  background: '#EF4444', color: '#fff',
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  opacity: revoke.isPending ? 0.4 : 1,
                }}
              >
                Revoke {approvedSelected.length} approved
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              style={{
                height: 32, padding: '0 14px', borderRadius: 9,
                border: '0.5px solid #E2E8F0', background: '#fff',
                fontSize: 12, fontWeight: 600, color: N.muted, cursor: 'pointer',
              }}
            >Clear</button>
          </div>
        </div>
      )}

      {/* ── Employer directory table ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          background: '#F4F5F7',
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: N.ink }}>Employer Directory</p>
            <p style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>
              Verification is approved/rejected from{' '}
              <button
                onClick={() => navigate('/admin/kyc')}
                style={{ color: N.navy, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                KYC Verification
              </button>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Tab switcher */}
            <div style={{
              display: 'flex', background: '#F4F5F7',
              border: '0.5px solid #E2E8F0', borderRadius: 10, padding: 3, gap: 2,
            }}>
              {(['pending', 'approved', 'all'] as EmployerStatus[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  style={{
                    height: 28, padding: '0 12px', borderRadius: 7,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: tab === t ? N.navy : 'transparent',
                    color: tab === t ? '#fff' : N.muted,
                    transition: 'all 0.15s', textTransform: 'capitalize',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {t}
                  {t === 'pending' && stats && stats.pending_employers > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      background: tab === 'pending' ? 'rgba(255,255,255,0.2)' : '#F59E0B',
                      color: tab === 'pending' ? '#fff' : '#fff',
                      borderRadius: 20, padding: '1px 6px',
                    }}>
                      {stats.pending_employers}
                    </span>
                  )}
                </button>
              ))}
            </div>
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

        {isLoading ? <Spinner /> : !filtered.length ? (
          <Empty
            icon={Building2}
            text={hasActiveFilters ? 'No employers match your filters' : tab === 'pending' ? 'No pending registrations' : 'No employers found'}
          />
        ) : (
          <>
            {/* Column header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr 60px 60px 100px 120px',
              gap: 12, padding: '10px 20px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              background: '#F4F5F7',
            }}>
              <button
                onClick={toggleAll}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: N.muted }}
              >
                {allSelected ? <CheckSquare size={15} color={N.navy} /> : <Square size={15} />}
              </button>
              {['Company', 'Jobs', 'Apps', 'Registered', 'Actions'].map(h => (
                <span key={h} style={{
                  fontSize: 10, fontWeight: 700, color: N.muted,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  textAlign: h === 'Company' ? 'left' : 'right',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((emp, idx) => (
              <div
                key={emp.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr 60px 60px 100px 120px',
                  gap: 12, padding: '14px 20px', alignItems: 'center',
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  background: selected.has(emp.id) ? '#EAECF0' : idx % 2 === 0 ? '#fff' : '#F4F5F7',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#EAECF0' }}
                onMouseOut={e => { e.currentTarget.style.background = selected.has(emp.id) ? '#EAECF0' : idx % 2 === 0 ? '#fff' : '#F4F5F7' }}
              >
                {/* Checkbox */}
                <button
                  onClick={e => { e.stopPropagation(); toggleOne(emp.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: N.muted }}
                >
                  {selected.has(emp.id) ? <CheckSquare size={15} color={N.navy} /> : <Square size={15} />}
                </button>

                {/* Company info */}
                <div
                  style={{ minWidth: 0, cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/employers/${emp.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: N.ink }}>{emp.company_name}</p>
                    {emp.is_approved
                      ? <Badge color="green">Approved</Badge>
                      : emp.rejection_reason
                        ? <Badge color="red">Rejected</Badge>
                        : <Badge color="amber">Pending</Badge>}
                  </div>
                  <p style={{ fontSize: 12, color: N.muted }}>
                    {[emp.industry, emp.company_size ? `${emp.company_size} employees` : null, emp.city].filter(Boolean).join(' · ') || 'Profile not completed yet'}
                  </p>
                  <p style={{ fontSize: 12, color: N.muted }}>
                    {[emp.contact_person ? `${emp.contact_person}${emp.designation ? `, ${emp.designation}` : ''}` : null, emp.phone].filter(Boolean).join(' · ')}
                  </p>
                  {emp.gst_number && <p style={{ fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', marginTop: 2 }}>GST: {emp.gst_number}</p>}
                  {emp.rejection_reason && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Rejected: {emp.rejection_reason}</p>}
                </div>

                {/* Jobs */}
                <span style={{ fontSize: 13, fontWeight: 700, color: N.ink, textAlign: 'right' }}>{emp.job_count}</span>

                {/* Apps */}
                <span style={{ fontSize: 13, fontWeight: 700, color: N.ink, textAlign: 'right' }}>{emp.application_count}</span>

                {/* Date */}
                <span style={{ fontSize: 12, color: N.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date(emp.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {emp.is_approved ? (
                    <button
                      onClick={e => { e.stopPropagation(); setRevokeTarget(emp) }}
                      style={{
                        height: 30, padding: '0 12px', borderRadius: 8,
                        border: '0.5px solid #E2E8F0', background: '#fff',
                        fontSize: 12, fontWeight: 600, color: N.muted, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = '#FEF2F2'
                        e.currentTarget.style.color = '#EF4444'
                        e.currentTarget.style.borderColor = '#FECACA'
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.color = N.muted
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
                        fontSize: 12, fontWeight: 600, color: N.navy, cursor: 'pointer',
                      }}
                    >
                      Review KYC
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Footer */}
            <div style={{
              padding: '10px 20px', background: '#F4F5F7',
              borderTop: '1px solid rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontSize: 11, color: N.muted }}>
                {filtered.length}{filtered.length !== employers?.length ? ` of ${employers?.length}` : ''} employer{filtered.length !== 1 ? 's' : ''}
                {selected.size > 0 ? ` · ${selected.size} selected` : ''} · click row to view profile
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Revoke modal ── */}
      {revokeTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            boxShadow: '0 20px 60px rgba(26,39,68,0.2)',
            padding: '28px 28px', maxWidth: 360, width: '100%',
          }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: N.ink, marginBottom: 10 }}>Revoke approval?</p>
            <p style={{ fontSize: 13, color: N.muted, lineHeight: 1.6, marginBottom: 24 }}>
              <span style={{ fontWeight: 700, color: N.ink }}>{revokeTarget.company_name}</span> will lose access and their jobs will be unlisted.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setRevokeTarget(null)}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  border: '0.5px solid #E2E8F0', background: '#fff',
                  fontSize: 13, fontWeight: 600, color: N.ink, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => revoke.mutate(revokeTarget.id, {
                  onSuccess: () => {
                    setRevokeTarget(null)
                    setSelected(s => { const n = new Set(s); n.delete(revokeTarget.id); return n })
                  },
                })}
                disabled={revoke.isPending}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  background: '#EF4444', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: revoke.isPending ? 0.4 : 1,
                }}
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
