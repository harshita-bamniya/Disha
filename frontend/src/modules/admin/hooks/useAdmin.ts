import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import type { CareerTrackCreatePayload, CareerTrackUpdatePayload, EmployerStatus } from '@/api/admin'

const STATS_KEY        = ['admin', 'stats']
const EMPLOYERS_KEY    = (status: EmployerStatus) => ['admin', 'employers', status]
const USERS_KEY        = (search?: string) => ['admin', 'users', search ?? '']
const CAREER_TRACKS_KEY = ['admin', 'career-tracks']

// ── Stats ────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: STATS_KEY, queryFn: adminApi.getStats })
}

// ── Employers ────────────────────────────────────────────────────────────────

export function useAdminEmployers(status: EmployerStatus = 'pending') {
  return useQuery({
    queryKey: EMPLOYERS_KEY(status),
    queryFn:  () => adminApi.listEmployers(status),
  })
}

export function useApproveEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => adminApi.approveEmployer(profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useRejectEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) =>
      adminApi.rejectEmployer(profileId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

// ── Aspirant users ────────────────────────────────────────────────────────────

export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: USERS_KEY(search),
    queryFn:  () => adminApi.listUsers(search),
  })
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn:  () => adminApi.getUser(userId!),
    enabled:  !!userId,
  })
}

// ── Career tracks ─────────────────────────────────────────────────────────────

export function useAdminCareerTracks() {
  return useQuery({
    queryKey: CAREER_TRACKS_KEY,
    queryFn:  adminApi.listCareerTracks,
  })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAREER_TRACKS_KEY })
    },
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
