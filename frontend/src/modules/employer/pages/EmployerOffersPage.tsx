import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import NotificationBell from '@/components/NotificationBell'
import { getAllOffers } from '@/api/matching'
import type { OfferListItem } from '@/api/matching'
import { useEmployerDashboard, useEmployerPermissions } from '../hooks/useJobs'
import { DS, C, statusDot, fmtDate, initials } from '../ds'

const TABS = [
  { value: '',         label: 'All'      },
  { value: 'sent',     label: 'Sent'     },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
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

const COLS = '36px 1fr 180px 100px 100px 100px 90px 36px'

function OfferRow({ item }: { item: OfferListItem }) {
  const ini = initials(item.candidate_name)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.1s' }}
      onMouseOver={e => { e.currentTarget.style.background = '#FAFAFA' }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: 6, background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {ini}
      </div>

      {/* Candidate */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.candidate_name ?? 'Anonymous'}</p>
        <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.role_title}</p>
      </div>

      {/* Job */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.ink2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.job_title}</p>
        {item.department_name && <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{item.department_name}</p>}
      </div>

      {/* CTC */}
      <span style={{ fontSize: 12, fontWeight: 600, color: C.ink1, fontVariantNumeric: 'tabular-nums' }}>{item.salary_ctc || '—'}</span>

      {/* Start date */}
      <span style={{ fontSize: 12, color: C.ink2 }}>{fmtDate(item.start_date)}</span>

      {/* Status */}
      <StatusChip status={item.status} />

      {/* Sent / responded */}
      <span style={{ fontSize: 11, color: C.ink3 }}>{fmtDate(item.responded_at ?? item.sent_at)}</span>

      {/* Link */}
      <Link to={`/app/employer/pipeline/${item.job_id}`} style={{ ...DS.btnIcon, textDecoration: 'none' }} title="View pipeline">
        <ExternalLink size={12} />
      </Link>
    </div>
  )
}

export default function EmployerOffersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data: dashboard } = useEmployerDashboard()
  const { data: perms }     = useEmployerPermissions()

  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'all-offers', statusFilter, offset],
    queryFn:  () => getAllOffers({ status: statusFilter || undefined, limit: LIMIT, offset }),
    enabled:  dashboard?.is_approved !== false,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const isDeptScoped = !perms?.is_company_wide && !!perms?.department_id

  return (
    <div style={DS.pageWrap}>

      {/* Top bar */}
      <header style={DS.topbar}>
        <div>
          <h1 style={DS.pageTitle}>Offers</h1>
          <p style={DS.pageSub}>{isDeptScoped ? perms?.department_name : (dashboard?.company_name ?? '')} · {total} total</p>
        </div>
        <NotificationBell />
      </header>

      {/* Toolbar */}
      <div style={DS.toolbar}>
        <div style={{ display: 'flex', gap: 2, background: C.borderLight, borderRadius: 7, padding: 3 }}>
          {TABS.map(t => (
            <button key={t.value} onClick={() => { setStatusFilter(t.value); setOffset(0) }} style={{
              padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 12, fontWeight: 500,
              background: statusFilter === t.value ? '#fff' : 'transparent',
              color: statusFilter === t.value ? C.ink1 : C.ink2,
              cursor: 'pointer',
              boxShadow: statusFilter === t.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{total} offer{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ ...DS.content, padding: '16px 24px' }}>
        <div style={DS.card}>
          <div style={{ ...DS.tHead, gridTemplateColumns: COLS }}>
            {['', 'Candidate', 'Role', 'CTC', 'Start', 'Status', 'Date', ''].map(h => <span key={h}>{h}</span>)}
          </div>

          {dashboard?.is_approved === false ? (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>Complete verification to view offers.</p>
            </div>
          ) : isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.ink3 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>No offers found</p>
              <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>Send offer letters from the candidate pipeline.</p>
            </div>
          ) : (
            items.map((item, i) => <OfferRow key={`${item.job_id}-${i}`} item={item} />)
          )}
        </div>

        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0} style={{ ...DS.btnSecondary, opacity: offset === 0 ? 0.4 : 1 }}>← Prev</button>
            <span style={{ fontSize: 12, color: C.ink3, alignSelf: 'center' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total} style={{ ...DS.btnSecondary, opacity: offset + LIMIT >= total ? 0.4 : 1 }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
