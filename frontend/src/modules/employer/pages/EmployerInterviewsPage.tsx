import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import Tabs from '@/shared/components/navigation/Tabs'
import EmptyState from '@/shared/components/feedback/EmptyState'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { getAllInterviews } from '@/api/matching'
import type { InterviewListItem } from '@/api/matching'
import { useEmployerDashboard } from '../hooks/useJobs'
import { DS, C, fmtDate, fmtTime, initials } from '../ds'
import { colors } from '@/design-system/tokens'
import StatusChip from '../components/StatusChip'
import PageHeader from '@/shared/layouts/PageHeader'

const TABS = [
  { key: '',          label: 'All'       },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'canceled',  label: 'Canceled'  },
]

const VERDICT: Record<string, { color: string; label: string }> = {
  strong_yes: { color: C.green,   label: 'Strong Yes' },
  yes:        { color: C.blue,    label: 'Yes'        },
  no:         { color: C.red,     label: 'No'         },
  strong_no:  { color: '#9F1239', label: 'Strong No'  },
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

const COLUMNS: TableColumn<InterviewListItem>[] = [
  {
    key: 'candidate_name',
    header: 'Candidate',
    render: row => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {initials(row.candidate_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.candidate_name ?? 'Anonymous'}</p>
          {row.interviewer_name && (
            <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>with {row.interviewer_name}</p>
          )}
        </div>
      </div>
    ),
  },
  {
    key: 'job_title',
    header: 'Role',
    render: row => (
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.ink2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.job_title}</p>
        {row.department_name && <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{row.department_name}</p>}
      </div>
    ),
  },
  {
    key: 'scheduled_at',
    header: 'Scheduled',
    width: 130,
    render: row => row.scheduled_at ? (
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.ink1, margin: 0 }}>{fmtDate(row.scheduled_at)}</p>
        <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0' }}>{fmtTime(row.scheduled_at)}</p>
      </div>
    ) : <span style={{ color: C.ink3, fontSize: 12 }}>—</span>,
  },
  {
    key: 'status',
    header: 'Status',
    width: 110,
    render: row => <StatusChip status={row.status} />,
  },
  {
    key: 'recommendation',
    header: 'Verdict',
    width: 120,
    render: row => <Verdict rec={row.recommendation} />,
  },
  {
    key: 'actions',
    header: '',
    width: 80,
    align: 'right',
    render: row => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {row.meeting_link && (
          <a href={row.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-[30px] w-[30px] rounded-md border border-[rgba(0,0,0,0.08)] text-gray-500 hover:bg-gray-100 transition-all duration-150 no-underline flex-shrink-0" title="Join meeting">
            <ExternalLink size={12} />
          </a>
        )}
        <Link to={`/app/employer/pipeline/${row.job_id}`} className="inline-flex items-center justify-center h-[30px] w-[30px] rounded-md border border-[rgba(0,0,0,0.08)] text-gray-500 hover:bg-gray-100 transition-all duration-150 no-underline flex-shrink-0" title="View pipeline">
          <CalendarDays size={12} />
        </Link>
      </div>
    ),
  },
]

export default function EmployerInterviewsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data: dashboard } = useEmployerDashboard()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer', 'all-interviews', statusFilter, offset],
    queryFn:  () => getAllInterviews({ status: statusFilter || undefined, limit: LIMIT, offset }),
    enabled:  dashboard?.is_approved !== false,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Interviews" subtitle="All scheduled and completed interviews" />

      {/* Toolbar */}
      <div style={DS.toolbar}>
        <Tabs
          variant="pill"
          tabs={TABS}
          active={statusFilter}
          onChange={key => { setStatusFilter(key); setOffset(0) }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{total} interview{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ padding: '16px 28px', background: colors.surface.bg, flex: 1 }}>
        {dashboard?.is_approved === false ? (
          <EmptyState
            title="Verification required"
            description="Complete company verification to view interviews."
          />
        ) : isError ? (
          <ErrorState title="Failed to load interviews" onRetry={refetch} compact />
        ) : (
          <DataTable<InterviewListItem>
            columns={COLUMNS}
            rows={items}
            rowKey={row => row.interview_id}
            loading={isLoading}
            emptyIcon={<CalendarDays size={24} />}
            emptyTitle="No interviews found"
            emptyDescription="Schedule interviews from the candidate pipeline."
            page={Math.floor(offset / LIMIT) + 1}
            totalPages={total > LIMIT ? Math.ceil(total / LIMIT) : undefined}
            onPageChange={p => setOffset((p - 1) * LIMIT)}
          />
        )}
      </div>
    </div>
  )
}
