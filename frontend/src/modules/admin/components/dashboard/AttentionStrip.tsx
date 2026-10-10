import { useQuery } from '@tanstack/react-query'
import { adminDashboardApi, type AttentionRow } from '@/api/adminDashboard'
import AttentionChips from '@/shared/components/dashboard/AttentionChips'
import { describeQueue } from './shared'

export default function AttentionStrip() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', 'attention'],
    queryFn: adminDashboardApi.attention,
    refetchInterval: 60_000,
  })
  return (
    <AttentionChips
      rows={data?.rows}
      loading={isLoading}
      error={isError}
      onRetry={() => refetch()}
      describe={row => describeQueue(row as AttentionRow, data!.targets)}
    />
  )
}
