import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { krsApi } from '@/api/krs'

export const KRS_DASHBOARD_KEY = ['krs', 'dashboard']
export const LIVE_JOBS_KEY = ['krs', 'live-jobs']
export const PREPARED_JOBS_KEY = ['krs', 'prepared-jobs']

export function useKrsDashboard() {
  return useQuery({
    queryKey: KRS_DASHBOARD_KEY,
    queryFn: krsApi.getDashboard,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRecompute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: krsApi.recompute,
    onSuccess: () => qc.invalidateQueries({ queryKey: KRS_DASHBOARD_KEY }),
  })
}

export function useLiveJobs() {
  return useQuery({
    queryKey: LIVE_JOBS_KEY,
    queryFn: krsApi.getLiveJobs,
    staleTime: 2 * 60 * 1000,
  })
}

export function usePreparedJobs() {
  return useQuery({
    queryKey: PREPARED_JOBS_KEY,
    queryFn: krsApi.getPreparedJobs,
    staleTime: 1 * 60 * 1000,
  })
}

export function usePrepareJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => krsApi.prepareJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIVE_JOBS_KEY })
      qc.invalidateQueries({ queryKey: PREPARED_JOBS_KEY })
    },
  })
}

export function useUnprepareJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => krsApi.unprepareJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIVE_JOBS_KEY })
      qc.invalidateQueries({ queryKey: PREPARED_JOBS_KEY })
    },
  })
}
