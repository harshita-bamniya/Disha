import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import type { CareerTrackCreatePayload, CareerTrackUpdatePayload, EmployerStatus } from '@/api/admin'

const STATS_KEY         = ['admin', 'stats']
const EMPLOYERS_KEY     = (status: EmployerStatus) => ['admin', 'employers', status]
const USERS_KEY         = (search?: string) => ['admin', 'users', search ?? '']
const CAREER_TRACKS_KEY = ['admin', 'career-tracks']
const JOBS_KEY          = (search?: string, active?: boolean) => ['admin', 'jobs', search ?? '', active ?? false]
const APPS_KEY          = (status?: string, search?: string) => ['admin', 'applications', status ?? '', search ?? '']
const ACTIVITY_KEY      = ['admin', 'activity']

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: STATS_KEY, queryFn: adminApi.getStats, refetchInterval: 60_000 })
}

// ── Employers ─────────────────────────────────────────────────────────────────

export function useAdminEmployers(status: EmployerStatus = 'pending') {
  return useQuery({ queryKey: EMPLOYERS_KEY(status), queryFn: () => adminApi.listEmployers(status) })
}

export function useApproveEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => adminApi.approveEmployer(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useRejectEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) =>
      adminApi.rejectEmployer(profileId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useRevokeEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => adminApi.revokeEmployer(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  })
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function useAdminUsers(search?: string) {
  return useQuery({ queryKey: USERS_KEY(search), queryFn: () => adminApi.listUsers(search) })
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminApi.getUser(userId!),
    enabled: !!userId,
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.deactivateUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.reactivateUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

// ── Career tracks ─────────────────────────────────────────────────────────────

export function useAdminCareerTracks() {
  return useQuery({ queryKey: CAREER_TRACKS_KEY, queryFn: adminApi.listCareerTracks })
}

export function useCreateCareerTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CareerTrackCreatePayload) => adminApi.createCareerTrack(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAREER_TRACKS_KEY })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

export function useUpdateCareerTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trackId, payload }: { trackId: string; payload: CareerTrackUpdatePayload }) =>
      adminApi.updateCareerTrack(trackId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAREER_TRACKS_KEY }),
  })
}

export function useDeleteCareerTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trackId: string) => adminApi.deleteCareerTrack(trackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAREER_TRACKS_KEY })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function useAdminJobs(search?: string, activeOnly?: boolean) {
  return useQuery({
    queryKey: JOBS_KEY(search, activeOnly),
    queryFn: () => adminApi.listJobs({ search, active_only: activeOnly }),
  })
}

export function useToggleAdminJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => adminApi.toggleJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

export function useDeleteAdminJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => adminApi.deleteJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

// ── Applications ──────────────────────────────────────────────────────────────

export function useAdminApplications(status?: string, search?: string) {
  return useQuery({
    queryKey: APPS_KEY(status, search),
    queryFn: () => adminApi.listApplications({ status, search }),
  })
}

// ── Activity ──────────────────────────────────────────────────────────────────

export function useAdminActivity() {
  return useQuery({ queryKey: ACTIVITY_KEY, queryFn: () => adminApi.getActivity(30), refetchInterval: 30_000 })
}
