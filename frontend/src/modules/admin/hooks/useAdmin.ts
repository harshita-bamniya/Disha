import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import type { CareerTrackCreatePayload, CareerTrackUpdatePayload, EmployerStatus, SubAdminCreatePayload } from '@/api/admin'

const STATS_KEY         = ['admin', 'stats']
const EMPLOYERS_KEY     = (status: EmployerStatus) => ['admin', 'employers', status]
const USERS_KEY         = (search?: string) => ['admin', 'users', search ?? '']
const CAREER_TRACKS_KEY = ['admin', 'career-tracks']
const JOBS_KEY          = (search?: string, active?: boolean) => ['admin', 'jobs', search ?? '', active ?? false]
const APPS_KEY          = (status?: string, search?: string) => ['admin', 'applications', status ?? '', search ?? '']
const ACTIVITY_KEY      = ['admin', 'activity']
const ROLES_KEY         = ['admin', 'roles']
const SUB_ADMINS_KEY    = ['admin', 'sub-admins']
const MANAGED_USERS_KEY = (search?: string, status?: string) => ['admin', 'user-management', search ?? '', status ?? '']
const LOGIN_HISTORY_KEY = (userId: string) => ['admin', 'user-management', userId, 'login-history']
const SESSIONS_KEY      = (userId: string) => ['admin', 'user-management', userId, 'sessions']

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: STATS_KEY, queryFn: adminApi.getStats, refetchInterval: 60_000 })
}

// ── Employers ─────────────────────────────────────────────────────────────────

export function useAdminEmployers(status: EmployerStatus = 'pending') {
  return useQuery({ queryKey: EMPLOYERS_KEY(status), queryFn: () => adminApi.listEmployers(status) })
}

// useApproveEmployer/useRejectEmployer were removed — they bypassed KYC
// document review entirely. Approval now only happens via the KYC verification
// queue (useReviewEmployerVerification, below).

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

// ── RBAC: roles & permission matrix ───────────────────────────────────────────

export function useAdminPermissions() {
  return useQuery({ queryKey: ['admin', 'permissions'], queryFn: adminApi.listPermissions })
}

export function useAdminRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: adminApi.listRoles })
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      adminApi.updateRolePermissions(roleId, permissionIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

// ── Sub-admin management ──────────────────────────────────────────────────────

export function useSubAdmins() {
  return useQuery({ queryKey: SUB_ADMINS_KEY, queryFn: adminApi.listSubAdmins })
}

export function useCreateSubAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubAdminCreatePayload) => adminApi.createSubAdmin(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUB_ADMINS_KEY }),
  })
}

export function useUpdateSubAdminRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      adminApi.updateSubAdminRole(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUB_ADMINS_KEY }),
  })
}

export function useDeleteSubAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteSubAdmin(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUB_ADMINS_KEY }),
  })
}

// ── User management: status / login history / sessions ───────────────────────

export function useManagedUsers(search?: string, status?: string) {
  return useQuery({
    queryKey: MANAGED_USERS_KEY(search, status),
    queryFn: () => adminApi.listManagedUsers({ search, status }),
  })
}

export function useUpdateUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: string; reason?: string }) =>
      adminApi.updateUserStatus(userId, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'user-management'] }),
  })
}

export function useLoginHistory(userId: string | null) {
  return useQuery({
    queryKey: LOGIN_HISTORY_KEY(userId ?? ''),
    queryFn: () => adminApi.getLoginHistory(userId!),
    enabled: !!userId,
  })
}

export function useDeviceSessions(userId: string | null) {
  return useQuery({
    queryKey: SESSIONS_KEY(userId ?? ''),
    queryFn: () => adminApi.getDeviceSessions(userId!),
    enabled: !!userId,
  })
}

export function useRevokeDeviceSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
      adminApi.revokeDeviceSession(userId, sessionId),
    onSuccess: (_data, { userId }) => qc.invalidateQueries({ queryKey: SESSIONS_KEY(userId) }),
  })
}

// ── Employer KYC verification ─────────────────────────────────────────────────

const EMP_VERIFICATIONS_KEY = (status?: string) => ['admin', 'employer-verifications', status ?? '']
const EMP_VERIFICATION_DETAIL_KEY = (id: string) => ['admin', 'employer-verifications', id]

export function useEmployerVerifications(status?: string) {
  return useQuery({ queryKey: EMP_VERIFICATIONS_KEY(status), queryFn: () => adminApi.listEmployerVerifications(status) })
}

export function useEmployerVerificationDetail(id: string | null) {
  return useQuery({
    queryKey: EMP_VERIFICATION_DETAIL_KEY(id ?? ''),
    queryFn: () => adminApi.getEmployerVerification(id!),
    enabled: !!id,
  })
}

export function useSubscriptionPlansAdmin() {
  return useQuery({ queryKey: ['admin', 'subscription-plans'], queryFn: adminApi.listSubscriptionPlans })
}

export function useUpdateSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: Record<string, unknown> }) =>
      adminApi.updateSubscriptionPlan(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export function useAuditLogs(params?: { action?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', params?.action ?? '', params?.offset ?? 0],
    queryFn: () => adminApi.listAuditLogs(params),
  })
}

export function useReviewEmployerVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, notes, rejection_reason }: { id: string; action: string; notes?: string; rejection_reason?: string }) =>
      adminApi.reviewEmployerVerification(id, { action, notes, rejection_reason }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'employer-verifications'] })
      qc.invalidateQueries({ queryKey: EMP_VERIFICATION_DETAIL_KEY(id) })
      // Approving/rejecting here also flips EmployerProfile.is_approved, which
      // the Employers tab (list + stat cards) reads — without this it shows
      // stale "pending" data until a manual page refresh.
      qc.invalidateQueries({ queryKey: ['admin', 'employers'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}
