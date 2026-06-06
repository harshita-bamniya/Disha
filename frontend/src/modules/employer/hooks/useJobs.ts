import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '@/api/jobs'
import type { JobPostingPayload } from '@/api/jobs'

const DASHBOARD_KEY = ['employer', 'dashboard']

export function useEmployerDashboard() {
  return useQuery({ queryKey: DASHBOARD_KEY, queryFn: jobsApi.getDashboard })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: JobPostingPayload) => jobsApi.createJob(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useUpdateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobPostingPayload }) => jobsApi.updateJob(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useToggleJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}
