import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import type {
  AnnouncementCreatePayload, AnnouncementStatus,
  CareerTrackCreatePayload, CareerTrackUpdatePayload, EmployerStatus, SubAdminCreatePayload,
} from '@/api/admin'

const STATS_KEY              = ['admin', 'stats']
const NOTIFICATIONS_KEY      = (params?: object) => ['admin', 'notifications', params ?? {}]
const NOTIFICATION_STATS_KEY = ['admin', 'notifications', 'stats']
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

export function useAdminEmployerDetail(profileId: string | null) {
  return useQuery({
    queryKey: ['admin', 'employers', profileId],
    queryFn: () => adminApi.getEmployerDetail(profileId!),
    enabled: !!profileId,
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

export function useAdminJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: ['admin', 'jobs', jobId],
    queryFn: () => adminApi.getJobDetail(jobId!),
    enabled: !!jobId,
  })
}

export function useJobApplications(jobId: string | null, params?: { status?: string }) {
  return useQuery({
    queryKey: ['admin', 'jobs', jobId, 'applications', params?.status ?? ''],
    queryFn: () => adminApi.listJobApplications(jobId!, params),
    enabled: !!jobId,
  })
}

export function useEmployerJobs(employerId: string | null, params?: { search?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'employers', employerId, 'jobs', params?.search ?? '', params?.active_only ?? false],
    queryFn: () => adminApi.listEmployerJobs(employerId!, params),
    enabled: !!employerId,
  })
}

export function useCandidateApplications(userId: string | null, params?: { status?: string }) {
  return useQuery({
    queryKey: ['admin', 'candidates', userId, 'applications', params?.status ?? ''],
    queryFn: () => adminApi.listCandidateApplications(userId!, params),
    enabled: !!userId,
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

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; permission_ids: string[]; clone_from_id?: string }) =>
      adminApi.createRole(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => adminApi.deleteRole(roleId),
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

export function useBillingOverview() {
  return useQuery({ queryKey: ['admin', 'billing', 'overview'], queryFn: adminApi.getBillingOverview })
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

// ── Platform settings & feature flags ─────────────────────────────────────────

const PLATFORM_SETTINGS_KEY = ['admin', 'platform', 'settings']
const FEATURE_FLAGS_KEY = ['admin', 'platform', 'flags']

export function usePlatformSettings() {
  return useQuery({ queryKey: PLATFORM_SETTINGS_KEY, queryFn: adminApi.listPlatformSettings })
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: unknown; description?: string }) =>
      adminApi.updatePlatformSetting(key, { value, description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY }),
  })
}

export function useFeatureFlags() {
  return useQuery({ queryKey: FEATURE_FLAGS_KEY, queryFn: adminApi.listFeatureFlags })
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ flagName, payload }: { flagName: string; payload: { is_enabled: boolean; rollout_pct: number; target_roles?: string[] | null; description?: string } }) =>
      adminApi.updateFeatureFlag(flagName, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FEATURE_FLAGS_KEY }),
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

// ── Announcements ─────────────────────────────────────────────────────────────

const ANNOUNCEMENTS_KEY = (status?: AnnouncementStatus) => ['admin', 'announcements', status ?? '']

export function useAnnouncements(status?: AnnouncementStatus) {
  return useQuery({
    queryKey: ANNOUNCEMENTS_KEY(status),
    queryFn: () => adminApi.listAnnouncements(status),
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AnnouncementCreatePayload) => adminApi.createAnnouncement(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AnnouncementCreatePayload> }) =>
      adminApi.updateAnnouncement(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })
}

export function usePublishAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.publishAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })
}

// ── Support tickets ───────────────────────────────────────────────────────────

export function useAdminTickets(params?: {
  status?: string; priority?: string; entity_type?: string; search?: string
}) {
  return useQuery({
    queryKey: ['admin', 'tickets', params],
    queryFn: () => adminApi.listTickets(params),
    staleTime: 30_000,
  })
}

export function useAdminTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'ticket', id],
    queryFn: () => adminApi.getTicket(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  })
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: import('@/api/admin').UpdateTicketPayload) => adminApi.updateTicket(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'tickets'] })
    },
  })
}

export function useAddTicketMessage(ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: import('@/api/admin').AddMessagePayload) => adminApi.addTicketMessage(ticketId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] }),
  })
}

export function useEmployerSupportTickets(profileId: string | null) {
  return useQuery({
    queryKey: ['admin', 'employers', profileId, 'support'],
    queryFn: () => adminApi.getEmployerSupport(profileId!),
    enabled: !!profileId,
  })
}

export function useCandidateSupportTickets(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'candidates', userId, 'support'],
    queryFn: () => adminApi.getCandidateSupport(userId!),
    enabled: !!userId,
  })
}

// ── Notification management ───────────────────────────────────────────────────

export function useAdminNotifications(params?: {
  user_id?: string; type?: string; delivery_status?: string; is_read?: boolean; skip?: number; limit?: number
}) {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY(params),
    queryFn: () => adminApi.getNotifications(params),
    staleTime: 30_000,
  })
}

export function useNotificationsStats() {
  return useQuery({
    queryKey: NOTIFICATION_STATS_KEY,
    queryFn: () => adminApi.getNotificationsStats(),
    staleTime: 60_000,
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] })
    },
  })
}

export function useUserNotifications(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'notifications'],
    queryFn: () => adminApi.getUserNotifications(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  })
}
