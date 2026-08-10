import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FileText } from 'lucide-react'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import Tabs from '@/shared/components/navigation/Tabs'
import EmptyState from '@/shared/components/feedback/EmptyState'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { getAllOffers } from '@/api/matching'
import type { OfferListItem } from '@/api/matching'
import { useEmployerDashboard } from '../hooks/useJobs'
import { DS, C, fmtDate, initials } from '../ds'
import { colors } from '@/design-system/tokens'
import StatusChip from '../components/StatusChip'
import PageHeader from '@/shared/layouts/PageHeader'

const TABS = [
  { key: '',         label: 'All'      },
  { key: 'sent',     label: 'Sent'     },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
]

const COLUMNS: TableColumn<OfferListItem>[] = [
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
          <p style={{ fontSize: 11, color: C.ink3, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.role_title}</p>
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
    key: 'salary_ctc',
    header: 'CTC',
    width: 100,
    render: row => <span style={{ fontSize: 12, fontWeight: 600, color: C.ink1, fontVariantNumeric: 'tabular-nums' }}>{row.salary_ctc || '—'}</span>,
  },
  {
    key: 'start_date',
    header: 'Start',
    width: 100,
    render: row => <span style={{ fontSize: 12, color: C.ink2 }}>{fmtDate(row.start_date)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    width: 100,
    render: row => <StatusChip status={row.status} />,
  },
  {
    key: 'sent_at',
    header: 'Date',
    width: 90,
    render: row => <span style={{ fontSize: 11, color: C.ink3 }}>{fmtDate(row.responded_at ?? row.sent_at)}</span>,
  },
  {
    key: 'actions',
    header: '',
    width: 60,
    align: 'right',
    render: row => (
      <Link to={`/app/employer/pipeline/${row.job_id}`} className="inline-flex items-center justify-center h-[30px] w-[30px] rounded-md border border-[rgba(0,0,0,0.08)] text-gray-500 hover:bg-gray-100 transition-all duration-150 no-underline flex-shrink-0" title="View pipeline">
        <ExternalLink size={12} />
      </Link>
    ),
  },
]

export default function EmployerOffersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data: dashboard } = useEmployerDashboard()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer', 'all-offers', statusFilter, offset],
    queryFn:  () => getAllOffers({ status: statusFilter || undefined, limit: LIMIT, offset }),
    enabled:  dashboard?.is_approved !== false,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Offers" subtitle="Offer letters sent to candidates" />

      {/* Toolbar */}
      <div style={DS.toolbar}>
        <Tabs
          variant="pill"
          tabs={TABS}
          active={statusFilter}
          onChange={key => { setStatusFilter(key); setOffset(0) }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{total} offer{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ padding: '16px 28px', background: colors.surface.bg, flex: 1 }}>
        {dashboard?.is_approved === false ? (
          <EmptyState
            title="Verification required"
            description="Complete company verification to view offers."
          />
        ) : isError ? (
          <ErrorState title="Failed to load offers" onRetry={refetch} compact />
        ) : (
          <DataTable<OfferListItem>
            columns={COLUMNS}
            rows={items}
            rowKey={row => row.offer_id}
            loading={isLoading}
            emptyIcon={<FileText size={24} />}
            emptyTitle="No offers found"
            emptyDescription="Send offer letters from the candidate pipeline."
            page={Math.floor(offset / LIMIT) + 1}
            totalPages={total > LIMIT ? Math.ceil(total / LIMIT) : undefined}
            onPageChange={p => setOffset((p - 1) * LIMIT)}
          />
        )}
      </div>
    </div>
  )
}
