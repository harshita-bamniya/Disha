import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { C } from '../../ds'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import EmptyState from '@/shared/components/feedback/EmptyState'
import Pagination from '@/shared/components/navigation/Pagination'
import Modal from '@/shared/components/overlays/Modal'
import { useReferralDetail, useReferralJobs, useReferralList, useReferrers } from '../../hooks/useReferrals'
import {
  Card, EVENT_LABEL, ReferralBadge, RewardBadge, ellipsis, fmtDate, inputStyle, money, rowStyle, selectStyle, Th,
} from './referralUi'

const COLS = 'minmax(170px,1.3fr) minmax(150px,1fr) minmax(130px,1fr) 110px 170px 100px'
const PAGE_SIZE = 25

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useReferralDetail(id)
  return (
    <Modal open title="Referral" onClose={onClose} width={520}>
      {isLoading || !data ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: C.ink1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{data.candidate_name ?? 'Candidate'}</div>
            <div style={{ color: C.ink2 }}>{data.candidate_email ?? 'No email on file'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 6 }}>
            <span style={{ color: C.ink3 }}>Role</span><span>{data.job_title}</span>
            <span style={{ color: C.ink3 }}>Referred by</span><span>{data.referrer_name} ({data.source === 'nomination' ? 'by email' : 'by link'})</span>
            <span style={{ color: C.ink3 }}>Status</span><span><ReferralBadge status={data.status} /></span>
            <span style={{ color: C.ink3 }}>Bonus</span>
            <span>{data.reward_status ? <><RewardBadge status={data.reward_status} /> {data.reward_amount ? money(data.reward_amount) : ''}</> : '—'}</span>
          </div>
          {data.note && (
            <blockquote style={{ margin: 0, padding: '8px 12px', borderLeft: `3px solid ${C.border}`, color: C.ink2 }}>
              “{data.note}” <span style={{ color: C.ink3 }}>— {data.referrer_name}</span>
            </blockquote>
          )}
          {data.application_id && (
            <Link to="/app/employer/applicants" style={{ color: C.accent, fontWeight: 600, fontSize: 12 }}>Open in Applicants →</Link>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>History</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.events.map((e, i) => (
                <li key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: C.brand, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {EVENT_LABEL[e.event] ?? e.event}{e.to_value && e.event !== 'created' ? ` → ${e.to_value.replace('_', ' ')}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: C.ink3 }}>
                      {fmtDate(e.created_at)}{e.actor ? ` · ${e.actor}` : ''}{e.note ? ` · ${e.note}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function ReferralsPanel() {
  const [status, setStatus] = useState('')
  const [jobId, setJobId] = useState('')
  const [referrerId, setReferrerId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const dq = useDebounced(q)

  useEffect(() => setPage(1), [status, jobId, referrerId, dq])

  const { data: jobs } = useReferralJobs()
  const { data: referrers } = useReferrers()
  const { data, isLoading, isError, refetch } = useReferralList({
    status: status || undefined, job_id: jobId || undefined, referrer_id: referrerId || undefined,
    q: dq.trim() || undefined, page, page_size: PAGE_SIZE,
  })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const filtered = !!(status || jobId || referrerId || dq.trim())

  return (
    <Card pad={0}>
      <div style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} color={C.ink3} style={{ position: 'absolute', left: 10, top: 10 }} />
          <input aria-label="Search candidates" placeholder="Search candidate name or email" value={q} maxLength={100}
            onChange={e => setQ(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
        </div>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          <option value="invited">Invited</option><option value="applied">Applied</option><option value="in_process">In process</option>
          <option value="hired">Hired</option><option value="rejected">Not selected</option><option value="withdrawn">Withdrew</option>
        </select>
        <select aria-label="Role" value={jobId} onChange={e => setJobId(e.target.value)} style={selectStyle}>
          <option value="">All roles</option>
          {jobs?.map(j => <option key={j.job_id} value={j.job_id}>{j.title}</option>)}
        </select>
        <select aria-label="Referrer" value={referrerId} onChange={e => setReferrerId(e.target.value)} style={selectStyle}>
          <option value="">All referrers</option>
          {referrers?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spinner /></div>
        : isError ? <ErrorState description="Could not load referrals." onRetry={() => refetch()} />
        : !data || data.items.length === 0 ? (
          <EmptyState title={filtered ? 'No referrals match these filters' : 'No referrals yet'}
            description={filtered ? 'Clear a filter to see more.' : 'Add your referrers on the People tab and share the link for an open role. Referrals appear here the moment someone applies.'} />
        ) : (
          <div role="table" aria-label="Referrals" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 820 }}>
              <Th cols={['Candidate', 'Role', 'Referred by', 'Status', 'Bonus', 'Date']} template={COLS} />
              {data.items.map((r, i) => (
                <div key={r.id} role="row" tabIndex={0} onClick={() => setOpen(r.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(r.id) } }}
                  style={{ ...rowStyle(COLS, i === data.items.length - 1), cursor: 'pointer' }}>
                  <span role="cell" style={{ minWidth: 0 }}>
                    <span style={{ ...ellipsis, display: 'block', fontWeight: 600 }}>{r.candidate_name ?? '—'}</span>
                    <span style={{ ...ellipsis, display: 'block', fontSize: 12, color: C.ink3 }}>{r.candidate_email ?? ''}</span>
                  </span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{r.job_title}</span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{r.referrer_name}</span>
                  <span role="cell"><ReferralBadge status={r.status} /></span>
                  <span role="cell">{r.reward_status ? <RewardBadge status={r.reward_status} /> : <span style={{ color: C.ink3 }}>—</span>}</span>
                  <span role="cell" style={{ color: C.ink2 }}>{fmtDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      {data && data.total > PAGE_SIZE && (
        <div style={{ padding: 12, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${C.border}` }}>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
      {open && <DetailModal id={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
