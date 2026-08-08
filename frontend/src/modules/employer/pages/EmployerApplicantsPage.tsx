import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, Star, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import NotificationBell from '@/components/NotificationBell'
import { getAllApplicants } from '@/api/matching'
import type { ApplicantListItem } from '@/api/matching'
import { useDepartments, useEmployerPermissions, useEmployerDashboard } from '../hooks/useJobs'
import { DS, C, statusDot, fmtDate, initials } from '../ds'
import Pagination from '@/shared/components/navigation/Pagination'

const TABS = [
  { value: '',                   label: 'All'         },
  { value: 'applied',            label: 'Applied'     },
  { value: 'screening',          label: 'Screening'   },
  { value: 'shortlisted',        label: 'Shortlisted' },
  { value: 'interview_scheduled',label: 'Interview'   },
  { value: 'offer_sent',         label: 'Offer'       },
  { value: 'hired',              label: 'Hired'       },
  { value: 'rejected',           label: 'Rejected'    },
]

function StatusChip({ status }: { status: string }) {
  const s = statusDot(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function MatchScore({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: C.ink3, fontSize: 12 }}>—</span>
  const color = score >= 70 ? C.green : score >= 40 ? C.amber : C.ink3
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
      <Star size={11} fill={color} stroke="none" />{score}%
    </span>
  )
}

const COLS = '36px 1fr 160px 160px 100px 80px 36px'

function ApplicantRow({ item }: { item: ApplicantListItem }) {
  const ini = initials(item.full_name)
  return (
    <Link
      to={`/app/employer/pipeline/${item.job_id}`}
      style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, textDecoration: 'none', color: 'inherit', transition: 'background 0.1s' }}
      onMouseOver={e => { e.currentTarget.style.background = '#FAFAFA' }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: 6, background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.3px' }}>
        {ini}
      </div>

      {/* Name + role */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.full_name ?? 'Anonymous'}
        </p>
        {item.current_role && (
          <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.current_role}</p>
        )}
      </div>

      {/* Job */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.ink2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.job_title}</p>
        {item.department_name && (
          <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{item.department_name}</p>
        )}
      </div>

      {/* Applied */}
      <span style={{ fontSize: 12, color: C.ink3 }}>{fmtDate(item.applied_at)}</span>

      {/* Status */}
      <StatusChip status={item.status} />

      {/* Match */}
      <MatchScore score={item.match_score} />

      {/* Arrow */}
      <ChevronRight size={14} color={C.ink3} />
    </Link>
  )
}

export default function EmployerApplicantsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter]     = useState('')
  const [search, setSearch]             = useState('')
  const [offset, setOffset]             = useState(0)
  const LIMIT = 50

  const { data: dashboard } = useEmployerDashboard()
  const { data: perms }     = useEmployerPermissions()
  const { data: departments } = useDepartments()

  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'all-applicants', statusFilter, deptFilter, offset],
    queryFn:  () => getAllApplicants({ status: statusFilter || undefined, department_id: deptFilter || undefined, limit: LIMIT, offset }),
    enabled:  dashboard?.is_approved !== false,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const filtered = search
    ? items.filter(i => (i.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || (i.job_title ?? '').toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div style={DS.pageWrap}>

      {/* Top bar */}
      <header style={DS.topbar}>
        <div>
          <h1 style={DS.pageTitle}>Applicants</h1>
          <p style={DS.pageSub}>{total} total</p>
        </div>
        <NotificationBell />
      </header>

      {/* Toolbar */}
      <div style={DS.toolbar}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.ink3, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or job…" style={{ ...DS.input, width: 200, paddingLeft: 30 }} />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 7, padding: 3, overflow: 'auto' }}>
          {TABS.map(t => (
            <button key={t.value} onClick={() => { setStatusFilter(t.value); setOffset(0) }} style={{
              padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
              background: statusFilter === t.value ? '#fff' : 'transparent',
              color: statusFilter === t.value ? C.ink1 : C.ink2,
              cursor: 'pointer',
              boxShadow: statusFilter === t.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Dept filter */}
        {departments && departments.length > 0 && (
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setOffset(0) }} style={DS.select}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{total} applicant{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ ...DS.content, padding: '16px 24px' }}>
        <div style={DS.card}>
          {/* Header */}
          <div style={{ ...DS.tHead, gridTemplateColumns: COLS }}>
            {['', 'Candidate', 'Role', 'Applied', 'Status', 'Match', ''].map(h => <span key={h}>{h}</span>)}
          </div>

          {dashboard?.is_approved === false ? (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>Complete verification to view applicants.</p>
            </div>
          ) : isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.ink3 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>No applicants found</p>
              <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>Try adjusting your filters.</p>
            </div>
          ) : (
            filtered.map((item, i) => <ApplicantRow key={`${item.job_id}-${item.aspirant_id ?? i}`} item={item} />)
          )}
        </div>

        {total > LIMIT && (
          <div style={{ marginTop: 14 }}>
            <Pagination
              page={Math.floor(offset / LIMIT) + 1}
              totalPages={Math.ceil(total / LIMIT)}
              onChange={p => setOffset((p - 1) * LIMIT)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
