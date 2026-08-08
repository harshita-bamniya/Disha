import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'
import Pagination from '@/shared/components/navigation/Pagination'
import { useQuery } from '@tanstack/react-query'
import NotificationBell from '@/components/NotificationBell'
import { getAllInterviews } from '@/api/matching'
import type { InterviewListItem } from '@/api/matching'
import { useEmployerDashboard, useEmployerPermissions } from '../hooks/useJobs'
import { DS, C, statusDot, fmtDate, fmtTime, initials } from '../ds'

const TABS = [
  { value: '',          label: 'All'       },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled',  label: 'Canceled'  },
]

const VERDICT: Record<string, { color: string; label: string }> = {
  strong_yes: { color: C.green,   label: 'Strong Yes' },
  yes:        { color: C.blue,    label: 'Yes'        },
  no:         { color: C.red,     label: 'No'         },
  strong_no:  { color: '#9F1239', label: 'Strong No'  },
}

function StatusChip({ status }: { status: string }) {
  const s = statusDot(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function Verdict({ rec }: { rec: string | null }) {
  if (!rec) return <span style={{ color: C.ink3, fontSize: 12 }}>—</span>
  const v = VERDICT[rec] ?? { color: C.ink3, label: rec }
  const isYes = rec.includes('yes')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: v.color }}>
      {isYes ? <ThumbsUp size={11} /> : <ThumbsDown size={11} />}
      {v.label}
    </span>
  )
}

const COLS = '36px 1fr 180px 150px 96px 120px 60px'

function InterviewRow({ item }: { item: InterviewListItem }) {
  const ini = initials(item.candidate_name)
  const d = item.scheduled_at ? new Date(item.scheduled_at) : null

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
        {item.interviewer_name && (
          <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>with {item.interviewer_name}</p>
        )}
      </div>

      {/* Job */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.ink2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.job_title}</p>
        {item.department_name && <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{item.department_name}</p>}
      </div>

      {/* Date & time */}
      <div>
        {d ? (
          <>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.ink1, margin: 0 }}>{fmtDate(item.scheduled_at)}</p>
            <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{fmtTime(item.scheduled_at)}</p>
          </>
        ) : <span style={{ color: C.ink3, fontSize: 12 }}>—</span>}
      </div>

      {/* Status */}
      <StatusChip status={item.status} />

      {/* Verdict */}
      <Verdict rec={item.recommendation} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        {item.meeting_link && (
          <a href={item.meeting_link} target="_blank" rel="noreferrer" style={{ ...DS.btnIcon, textDecoration: 'none' }} title="Join meeting">
            <ExternalLink size={12} />
          </a>
        )}
        <Link to={`/app/employer/pipeline/${item.job_id}`} style={{ ...DS.btnIcon, textDecoration: 'none' }} title="View pipeline">
          <CalendarDays size={12} />
        </Link>
      </div>
    </div>
  )
}

export default function EmployerInterviewsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data: dashboard } = useEmployerDashboard()
  const { data: perms }     = useEmployerPermissions()

  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'all-interviews', statusFilter, offset],
    queryFn:  () => getAllInterviews({ status: statusFilter || undefined, limit: LIMIT, offset }),
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
          <h1 style={DS.pageTitle}>Interviews</h1>
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{total} interview{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ ...DS.content, padding: '16px 24px' }}>
        <div style={DS.card}>
          <div style={{ ...DS.tHead, gridTemplateColumns: COLS }}>
            {['', 'Candidate', 'Role', 'Scheduled', 'Status', 'Verdict', ''].map(h => <span key={h}>{h}</span>)}
          </div>

          {dashboard?.is_approved === false ? (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>Complete verification to view interviews.</p>
            </div>
          ) : isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.ink3 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={28} color={C.ink3} strokeWidth={1.5} />
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>No interviews found</p>
              <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>Schedule interviews from the candidate pipeline.</p>
            </div>
          ) : (
            items.map(item => <InterviewRow key={item.interview_id} item={item} />)
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
