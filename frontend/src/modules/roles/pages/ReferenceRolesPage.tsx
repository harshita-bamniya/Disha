import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Compass, MapPin, IndianRupee, Search, X, AlertCircle, ArrowUpRight, Building2 } from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import Pagination from '@/shared/components/navigation/Pagination'
import Button from '@/shared/components/primitives/Button'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import SharedEmptyState from '@/shared/components/feedback/EmptyState'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER, shadows } from '@/design-system/tokens'
import { referenceRolesApi, type ReferenceRoleCard, type ReferenceRoleQuery } from '@/api/referenceRoles'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReferenceNotice from '../components/ReferenceNotice'

const PAGE_SIZE = 12
const SALARY_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any entry pay' },
  { label: 'Up to ₹6 LPA', max: 6 },
  { label: '₹6–10 LPA', min: 6, max: 10 },
  { label: '₹10+ LPA', min: 10 },
]
const SORTS: { value: NonNullable<ReferenceRoleQuery['sort']>; label: string }[] = [
  { value: 'fit', label: 'Best research fit' },
  { value: 'salary', label: 'Highest entry pay' },
  { value: 'company', label: 'Company A–Z' },
]

const selectStyle = {
  width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 12.5,
  color: INK, background: '#fff', minWidth: 0,
} as const

function Facet({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; count: number }[]
}) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="">All</option>
        {options.map(o => <option key={o.value}  value={o.value}>{o.value} ({o.count})</option>)}
      </select>
    </label>
  )
}

function RoleCard({ role }: { role: ReferenceRoleCard }) {
  const sal = role.entry_salary
  return (
    <article style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: '0 2px 8px rgba(15,23,42,.04)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>Reference role</span>
        {role.candidate_fit_score != null && (
          <span title="The research dataset's own estimate, 0-100" style={{ fontSize: 11, color: MUTED, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Research fit {role.candidate_fit_score}/100</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{role.job_role}</h3>
        <p style={{ fontSize: 12.5, color: INK_SFT, margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 5, overflowWrap: 'anywhere' }}>
          <Building2 size={12} style={{ flexShrink: 0 }} /> {role.company_name}
          {role.company_type ? <span style={{ color: MUTED }}> · {role.company_type}</span> : null}
        </p>
        <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 0' }}>{role.industry}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: INK_SFT }}>
        {sal.text && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IndianRupee size={12} /> Entry {sal.text} <span style={{ color: MUTED }}>(estimate)</span></span>}
        {role.hiring_locations.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {role.hiring_locations.slice(0, 3).join(', ')}{role.hiring_locations.length > 3 ? ` +${role.hiring_locations.length - 3}` : ''}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {role.required_skills.slice(0, 4).map((s, i) => (
          <span key={`${s}-${i}`} style={{ fontSize: 11, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '2px 9px' }}>{s}</span>
        ))}
        {role.required_skills.length > 4 && <span style={{ fontSize: 11, color: MUTED, padding: '2px 4px' }}>+{role.required_skills.length - 4} more</span>}
      </div>
      <ReferenceNotice compact />
      <Link to={`/app/roles/${role.id}`} style={{ marginTop: 'auto', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#fff', background: NAVY, borderRadius: 9, padding: '9px 16px', textDecoration: 'none' }}>
        View role details <ArrowUpRight size={13} />
      </Link>
    </article>
  )
}

export default function ReferenceRolesPage() {
  const isMobile = useIsMobile()
  const [searchInput, setSearchInput] = useState('')
  const [f, setF] = useState<ReferenceRoleQuery>({ sort: 'fit' })
  const [salaryIdx, setSalaryIdx] = useState(0)
  const [page, setPage] = useState(1)

  const set = (patch: Partial<ReferenceRoleQuery>) => { setF(prev => ({ ...prev, ...patch })); setPage(1) }
  const band = SALARY_BANDS[salaryIdx]
  const query: ReferenceRoleQuery = { ...f, salary_min: band.min, salary_max: band.max, page, page_size: PAGE_SIZE }
  const hasFilters = !!(f.q || f.industry || f.company_type || f.location || f.category || f.skill || salaryIdx)

  const facets = useQuery({ queryKey: ['reference-role-filters'], queryFn: referenceRolesApi.filters, staleTime: 10 * 60_000 })
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['reference-roles', query], queryFn: () => referenceRolesApi.list(query), placeholderData: keepPreviousData,
  })

  const clearAll = () => { setF({ sort: f.sort }); setSalaryIdx(0); setSearchInput(''); setPage(1) }

  return (
    <>
      <PageHeader
        title="Roles hiring UPSC aspirants"
        subtitle="Research on what organisations hire for — not open vacancies"
        icon={<Compass size={13} color={NAVY} />}
        below={<Breadcrumb items={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Roles hiring UPSC aspirants' }]} />}
      />
      <main style={{ padding: isMobile ? '16px 16px 40px' : '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ReferenceNotice />

        <section aria-label="Filters" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, boxShadow: shadows.card }}>
          <form onSubmit={e => { e.preventDefault(); set({ q: searchInput.trim() || undefined }) }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={13} color={MUTED} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="search" aria-label="Search roles" placeholder="Search company, role or skill…" value={searchInput}
                onChange={e => { setSearchInput(e.target.value); if (!e.target.value) set({ q: undefined }) }}
                style={{ ...selectStyle, paddingLeft: 30, background: CREAM }} />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Facet label="Industry" value={f.industry ?? ''} onChange={v => set({ industry: v || undefined })} options={facets.data?.industries ?? []} />
            <Facet label="Company type" value={f.company_type ?? ''} onChange={v => set({ company_type: v || undefined })} options={facets.data?.company_types ?? []} />
            <Facet label="Top locations" value={f.location ?? ''} onChange={v => set({ location: v || undefined })} options={(facets.data?.locations ?? []).slice(0, 25)} />
            <Facet label="Candidate profile" value={f.category ?? ''} onChange={v => set({ category: v || undefined })} options={facets.data?.categories ?? []} />
            <label style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Entry pay</span>
              <select value={salaryIdx} onChange={e => { setSalaryIdx(Number(e.target.value)); setPage(1) }} style={selectStyle}>
                {SALARY_BANDS.map((b, i) => <option key={b.label} value={i}>{b.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Sort by</span>
              <select value={f.sort} onChange={e => set({ sort: e.target.value as ReferenceRoleQuery['sort'] })} style={selectStyle}>
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
          {hasFilters && (
            <div style={{ marginTop: 10 }}>
              <Button variant="ghost" size="sm" onClick={clearAll}><X size={12} /> Clear all filters</Button>
            </div>
          )}
        </section>

        {data && data.items.length > 0 && (
          <p aria-live="polite" style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, margin: 0 }}>
            {data.total} reference {data.total === 1 ? 'role' : 'roles'}{isFetching ? ' · updating…' : ''}
          </p>
        )}

        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
          </div>
        )}

        {isError && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 18px', color: '#991B1B', fontSize: 13 }}>
            <AlertCircle size={15} /> Could not load roles. Check your connection and try again.
            <Button size="sm" variant="ghost" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {data && (data.items.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }}>
            <SharedEmptyState
              icon={<Compass size={22} color={NAVY} />}
              title={hasFilters ? 'No roles match these filters' : 'No reference roles yet'}
              description={hasFilters ? 'Try clearing a filter or searching for a broader term.' : 'The research catalogue has not been loaded.'}
              action={hasFilters ? <Button size="sm" onClick={clearAll}>Clear all filters</Button> : undefined}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
              {data.items.map(r => <RoleCard key={r.id} role={r} />)}
            </div>
            <Pagination page={page} totalPages={Math.ceil(data.total / PAGE_SIZE)} onChange={setPage} />
          </>
        ))}
      </main>
    </>
  )
}
