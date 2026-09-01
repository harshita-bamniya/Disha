import { apiClient } from './client'

export interface AdminStats {
  total_aspirants: number
  completed_onboarding: number
  total_employers: number
  pending_employers: number
  approved_employers: number
  total_job_postings: number
  active_job_postings: number
  total_applications: number
  new_users_last_7d: number
  new_jobs_last_7d: number
  avg_krs_composite: number | null
  hired_count: number
}

export type EmployerStatus = 'pending' | 'approved' | 'all'

export interface EmployerEntry {
  id: string
  user_id: string
  company_name: string
  // Filled in later via the post-login setup wizard — null until then.
  industry: string | null
  company_size: string | null
  website: string | null
  gst_number: string | null
  contact_person: string | null
  designation: string | null
  city: string | null
  description: string | null
  phone: string | null
  phone_verified: boolean
  is_approved: boolean
  rejection_reason: string | null
  registered_at: string
  job_count: number
  application_count: number
}

export interface AspirantUserEntry {
  user_id: string
  phone: string
  email: string | null
  full_name: string | null
  city: string | null
  state: string | null
  is_completed: boolean
  is_active: boolean
  current_step: number
  krs_composite: number | null
  k_score: number | null
  r_score: number | null
  s_score: number | null
  registered_at: string
  application_count: number
}

export interface AspirantEducation {
  highest_qualification: string | null
  degree: string | null
  field_of_study: string | null
  institution: string | null
  graduation_year: number | null
}

export interface AspirantUpscJourney {
  upsc_exam: string | null
  years_preparing: number | null
  upsc_attempts: number | null
  highest_stage_cleared: string | null
  optional_subject: string | null
}

export interface AspirantWorkExperience {
  has_work_experience: boolean | null
  work_experience_years: number | null
  work_experience_domain: string | null
  last_designation: string | null
}

export interface AspirantCareerPreferences {
  preferred_sectors: string[] | null
  preferred_locations: string[] | null
  open_to_relocation: boolean | null
  expected_salary_min: number | null
  expected_salary_max: number | null
}

export interface AspirantPsychProfile {
  burnout_score: number
  confidence_index: number
}

export interface AspirantKrsDetail {
  k_score: number
  r_score: number
  s_score: number
  composite: number
  computed_at: string
}

export interface AspirantSelectedTrack {
  track_id: string
  title: string
  sector: string
  selected_at: string
}

export interface AspirantDetailResponse {
  user_id: string
  phone: string
  email: string | null
  is_active: boolean
  registered_at: string
  last_login_at: string | null
  full_name: string | null
  date_of_birth: string | null
  gender: string | null
  city: string | null
  state: string | null
  is_completed: boolean
  current_step: number
  disha_insight: string | null
  education: AspirantEducation | null
  upsc_journey: AspirantUpscJourney | null
  work_experience: AspirantWorkExperience | null
  skills: string[] | null
  career_preferences: AspirantCareerPreferences | null
  psychological_profile: AspirantPsychProfile | null
  krs: AspirantKrsDetail | null
  selected_tracks: AspirantSelectedTrack[]
  total_applications: number
}

export interface CareerTrackAdminEntry {
  id: string
  slug: string
  title: string
  description: string
  sector: string
  required_skills: string[]
  min_k_score: number
  salary_range: string | null
  growth_outlook: string | null
  example_roles: string[]
  created_at: string
  aspirant_count: number
}

export interface CareerTrackCreatePayload {
  slug: string
  title: string
  description: string
  sector: string
  required_skills: string[]
  min_k_score?: number
  salary_range?: string | null
  growth_outlook?: string | null
  example_roles?: string[]
}

export interface CareerTrackUpdatePayload {
  title?: string
  description?: string
  sector?: string
  required_skills?: string[]
  min_k_score?: number
  salary_range?: string | null
  growth_outlook?: string | null
  example_roles?: string[]
}

export interface AdminJobEntry {
  id: string
  title: string
  company_name: string
  employer_id: string
  sector: string
  location: string | null
  employment_type: string | null
  salary_min: number | null
  salary_max: number | null
  is_active: boolean
  applicant_count: number
  created_at: string
  expires_at: string | null
}

export interface AdminApplicationEntry {
  id: string
  aspirant_name: string | null
  aspirant_phone: string
  aspirant_id: string
  job_title: string
  company_name: string
  job_id: string
  status: string
  match_score: number | null
  applied_at: string
}

export interface AdminActivityItem {
  type: 'signup' | 'application' | 'job_posted' | 'employer_approved'
  title: string
  subtitle: string | null
  timestamp: string
}

export interface PermissionEntry {
  id: string
  resource: string
  action: string
  description: string | null
}

export interface RoleEntry {
  id: string
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]   // "resource:action"
  user_count: number
}

export interface SubAdminEntry {
  user_id: string
  email: string | null
  phone: string | null
  full_name: string | null
  role_id: string
  role_name: string
  status: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export interface SubAdminCreatePayload {
  email: string
  phone?: string
  role_id: string
  full_name?: string
}

export interface UserManagementEntry {
  user_id: string
  email: string | null
  phone: string | null
  role_name: string | null
  full_name: string | null
  status: string
  is_active: boolean
  failed_login_attempts: number
  last_login_at: string | null
  registered_at: string
}

export interface LoginHistoryEntry {
  id: string
  ip_address: string | null
  user_agent: string | null
  device_label: string | null
  success: boolean
  failure_reason: string | null
  created_at: string
}

export interface DeviceSessionEntry {
  id: string
  device_label: string | null
  ip_address: string | null
  last_seen_at: string
  is_current: boolean
  created_at: string
}

export interface SubscriptionPlanAdminEntry {
  id: string
  name: string
  price_monthly: number
  max_active_jobs: number | null
  max_recruiter_seats: number | null
  resume_access: boolean
  candidate_search_limit: number | null
  is_active: boolean
}

export interface AuditLogEntry {
  id: string
  actor_email: string | null
  actor_phone: string | null
  action: string
  resource: string | null
  resource_id: string | null
  ip_address: string | null
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogPage {
  total: number
  items: AuditLogEntry[]
}

export interface VerificationDocumentEntry {
  id: string
  doc_type: string
  file_url: string
  original_filename: string | null
  status: string
  notes: string | null
  uploaded_at: string
}

export interface VerificationEventEntry {
  id: string
  actor_name: string | null
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

export interface EmployerVerificationEntry {
  id: string
  employer_id: string
  company_name: string
  status: string
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  document_count: number
}

export interface EmployerVerificationDetail extends EmployerVerificationEntry {
  reviewer_notes: string | null
  documents: VerificationDocumentEntry[]
  events: VerificationEventEntry[]
}

export interface EmployerTeamMemberEntry {
  user_id: string
  employer_profile_id: string
  full_name: string | null
  email: string | null
  phone: string
  role_name: string
  is_owner: boolean
  is_active: boolean
  joined_at: string
}

export interface EmployerJobEntry {
  id: string
  title: string
  sector: string
  location: string | null
  is_active: boolean
  applicant_count: number
  created_at: string
}

export interface EmployerDetailResponse extends EmployerEntry {
  subscription_plan: string | null
  team_members: EmployerTeamMemberEntry[]
  recent_jobs: EmployerJobEntry[]
  kyc_status: string | null
  kyc_submitted_at: string | null
}

export interface EmployerJobsResponse {
  total: number
  items: EmployerJobEntry[]
}

export interface AdminJobDetailResponse extends AdminJobEntry {
  description: string
  required_skills: string[]
  min_k_score: number
  job_type: string | null
  growth_outlook: string | null
  status: string
  department_id: string | null
  department_name: string | null
  updated_at: string | null
}

export interface GlobalSearchResult {
  type: 'user' | 'employer' | 'job' | 'application'
  id: string
  title: string
  subtitle: string | null
  section: string
}

export interface GlobalSearchResponse {
  query: string
  results: GlobalSearchResult[]
}

export interface PlanRevenueEntry {
  plan_id: string
  plan_name: string
  price_monthly: number
  company_count: number
  mrr: number
}

export interface RevenueTrendPoint {
  month: string
  new_subscriptions: number
}

export interface BillingOverviewResponse {
  mrr: number
  arpa: number
  active_subscriptions: number
  past_due_subscriptions: number
  canceled_subscriptions: number
  new_subscriptions_30d: number
  plan_distribution: PlanRevenueEntry[]
  trend: RevenueTrendPoint[]
}

// ── Admin notification management ─────────────────────────────────────────────

export interface AdminNotificationEntry {
  id: string
  user_id: string
  user_email: string | null
  user_phone: string | null
  type: string
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  delivery_status: string | null
  email_sent_at: string | null
  email_failed_reason: string | null
  created_at: string
}

export interface NotificationListResponse {
  total: number
  items: AdminNotificationEntry[]
}

export interface NotificationStatEntry {
  label: string
  count: number
}

export interface NotificationStatsResponse {
  total_today: number
  sent_today: number
  failed_today: number
  unread_total: number
  by_type: NotificationStatEntry[]
  by_delivery_status: NotificationStatEntry[]
}

// ── Integrations ──────────────────────────────────────────────────────────────

// ── System monitoring ─────────────────────────────────────────────────────────

export interface DbPoolStats {
  size: number
  checked_in: number
  checked_out: number
  overflow: number
  max_size: number
}

export interface QueueDepth { queue: string; pending: number | null }

export interface RedisInfo {
  used_memory_mb?: number
  connected_clients?: number
  uptime_days?: number
  version?: string
  error?: string
}

export interface ProcessInfo {
  uptime_seconds: number
  memory_mb: number | null
  git_sha: string
  environment: string
  python_debug: boolean
}

export interface SystemStatusResponse {
  checked_at: string
  db_pool: DbPoolStats
  celery: { broker: string; queues: QueueDepth[]; beat_tasks: string[] }
  redis: RedisInfo
  process: ProcessInfo
  sentry: { configured: boolean; dsn_hint: string | null }
}

export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export interface IntegrationEntry {
  id: string
  name: string
  category: string
  status: IntegrationStatus
  detail: string
  latency_ms: number | null
}

export interface IntegrationsResponse {
  checked_at: string
  integrations: IntegrationEntry[]
}

export interface PromptTemplateEntry {
  id: string
  name: string
  use_case: string
  prompt_type: 'system' | 'user' | 'assistant'
  version: number
  is_active: boolean
  model_hint: string | null
  notes: string | null
  content_preview: string
  created_at: string
}

export interface PromptTemplateDetail extends Omit<PromptTemplateEntry, 'content_preview'> {
  content: string
}

export interface CreatePromptPayload {
  name: string
  use_case: string
  prompt_type: 'system' | 'user' | 'assistant'
  content: string
  model_hint?: string | null
  notes?: string | null
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint { date: string; count: number }
export interface FunnelStage { status: string; count: number }
export interface ScoreBin { range: string; count: number }
export interface CohortRow { month: string; signups: number; applied: number; hired: number }

export interface AnalyticsResponse {
  period: { from_date: string; to_date: string; days: number }
  user_growth: TimeSeriesPoint[]
  job_volume: TimeSeriesPoint[]
  application_funnel: FunnelStage[]
  match_score_distribution: ScoreBin[]
  cohort_table: CohortRow[]
}

export interface BackfillResult {
  jobs_queued: number
  profiles_queued: number
  message: string
}

export interface PlatformSettingEntry {
  id: string
  key: string
  value: unknown
  description: string | null
  updated_at: string
}

export interface FeatureFlagEntry {
  id: string
  flag_name: string
  is_enabled: boolean
  rollout_pct: number
  target_roles: string[] | null
  description: string | null
  updated_at: string
}

export type AnnouncementType    = 'info' | 'warning' | 'success' | 'alert'
export type AnnouncementTarget  = 'all' | 'aspirants' | 'employers'
export type AnnouncementChannel = 'in_app' | 'email' | 'both'
export type AnnouncementStatus  = 'draft' | 'scheduled' | 'published'

export interface AnnouncementEntry {
  id:               string
  title:            string
  body:             string
  type:             AnnouncementType
  target:           AnnouncementTarget
  channel:          AnnouncementChannel
  status:           AnnouncementStatus
  scheduled_at:     string | null
  published_at:     string | null
  sent_count:       number
  created_by_name:  string | null
  created_at:       string
  updated_at:       string | null
}

export interface AnnouncementCreatePayload {
  title:        string
  body:         string
  type:         AnnouncementType
  target:       AnnouncementTarget
  channel:      AnnouncementChannel
  scheduled_at?: string | null
}

export const adminApi = {
  getStats: () =>
    apiClient.get<AdminStats>('/admin/stats').then(r => r.data),

  globalSearch: (q: string) =>
    apiClient.get<GlobalSearchResponse>('/admin/search', { params: { q } }).then(r => r.data),

  // ── Employers ────────────────────────────────────────────────────────────────
  listEmployers: (status: EmployerStatus = 'pending') =>
    apiClient.get<EmployerEntry[]>('/admin/employers', { params: { status } }).then(r => r.data),

  getEmployerDetail: (profileId: string) =>
    apiClient.get<EmployerDetailResponse>(`/admin/employers/${profileId}`).then(r => r.data),

  revokeEmployer: (profileId: string) =>
    apiClient.post<{ message: string }>(`/admin/employers/${profileId}/revoke`).then(r => r.data),

  // ── Users ────────────────────────────────────────────────────────────────────
  listUsers: (search?: string) =>
    apiClient.get<AspirantUserEntry[]>('/admin/users', { params: search ? { search } : undefined }).then(r => r.data),

  getUser: (userId: string) =>
    apiClient.get<AspirantDetailResponse>(`/admin/users/${userId}`).then(r => r.data),

  deactivateUser: (userId: string) =>
    apiClient.post<{ message: string }>(`/admin/users/${userId}/deactivate`).then(r => r.data),

  reactivateUser: (userId: string) =>
    apiClient.post<{ message: string }>(`/admin/users/${userId}/reactivate`).then(r => r.data),

  // ── Career tracks ─────────────────────────────────────────────────────────────
  listCareerTracks: () =>
    apiClient.get<CareerTrackAdminEntry[]>('/admin/career-tracks').then(r => r.data),

  createCareerTrack: (payload: CareerTrackCreatePayload) =>
    apiClient.post<CareerTrackAdminEntry>('/admin/career-tracks', payload).then(r => r.data),

  updateCareerTrack: (trackId: string, payload: CareerTrackUpdatePayload) =>
    apiClient.put<CareerTrackAdminEntry>(`/admin/career-tracks/${trackId}`, payload).then(r => r.data),

  deleteCareerTrack: (trackId: string) =>
    apiClient.delete<{ message: string }>(`/admin/career-tracks/${trackId}`).then(r => r.data),

  // ── Jobs ──────────────────────────────────────────────────────────────────────
  listJobs: (params?: { search?: string; active_only?: boolean }) =>
    apiClient.get<AdminJobEntry[]>('/admin/jobs', { params }).then(r => r.data),

  getJobDetail: (jobId: string) =>
    apiClient.get<AdminJobDetailResponse>(`/admin/jobs/${jobId}`).then(r => r.data),

  toggleJob: (jobId: string) =>
    apiClient.patch<AdminJobEntry>(`/admin/jobs/${jobId}/toggle`).then(r => r.data),

  deleteJob: (jobId: string) =>
    apiClient.delete<{ message: string }>(`/admin/jobs/${jobId}`).then(r => r.data),

  listJobApplications: (jobId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<AdminApplicationEntry[]>(`/admin/jobs/${jobId}/applications`, { params }).then(r => r.data),

  listEmployerJobs: (employerId: string, params?: { search?: string; active_only?: boolean; limit?: number; offset?: number }) =>
    apiClient.get<EmployerJobsResponse>(`/admin/employers/${employerId}/jobs`, { params }).then(r => r.data),

  listCandidateApplications: (userId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<AdminApplicationEntry[]>(`/admin/users/${userId}/applications`, { params }).then(r => r.data),

  // ── Applications ──────────────────────────────────────────────────────────────
  listApplications: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    apiClient.get<AdminApplicationEntry[]>('/admin/applications', { params }).then(r => r.data),

  // ── Activity ──────────────────────────────────────────────────────────────────
  getActivity: (limit = 25) =>
    apiClient.get<AdminActivityItem[]>('/admin/activity', { params: { limit } }).then(r => r.data),

  // ── RBAC: roles & permission matrix ─────────────────────────────────────────
  listPermissions: () =>
    apiClient.get<PermissionEntry[]>('/admin/permissions').then(r => r.data),

  listRoles: () =>
    apiClient.get<RoleEntry[]>('/admin/roles').then(r => r.data),

  updateRolePermissions: (roleId: string, permissionIds: string[]) =>
    apiClient.patch<RoleEntry>(`/admin/roles/${roleId}/permissions`, { permission_ids: permissionIds }).then(r => r.data),

  createRole: (payload: { name: string; description?: string; permission_ids: string[]; clone_from_id?: string }) =>
    apiClient.post<RoleEntry>('/admin/roles', payload).then(r => r.data),

  deleteRole: (roleId: string) =>
    apiClient.delete<{ message: string }>(`/admin/roles/${roleId}`).then(r => r.data),

  // ── Sub-admin management ─────────────────────────────────────────────────────
  listSubAdmins: () =>
    apiClient.get<SubAdminEntry[]>('/admin/sub-admins').then(r => r.data),

  createSubAdmin: (payload: SubAdminCreatePayload) =>
    apiClient.post<SubAdminEntry>('/admin/sub-admins', payload).then(r => r.data),

  updateSubAdminRole: (userId: string, roleId: string) =>
    apiClient.patch<SubAdminEntry>(`/admin/sub-admins/${userId}/role`, { role_id: roleId }).then(r => r.data),

  deleteSubAdmin: (userId: string) =>
    apiClient.delete<{ message: string }>(`/admin/sub-admins/${userId}`).then(r => r.data),

  // ── User management: status / login history / sessions ──────────────────────
  listManagedUsers: (params?: { search?: string; status?: string }) =>
    apiClient.get<UserManagementEntry[]>('/admin/user-management', { params }).then(r => r.data),

  updateUserStatus: (userId: string, status: string, reason?: string) =>
    apiClient.patch<{ message: string }>(`/admin/user-management/${userId}/status`, { status, reason }).then(r => r.data),

  getLoginHistory: (userId: string) =>
    apiClient.get<LoginHistoryEntry[]>(`/admin/user-management/${userId}/login-history`).then(r => r.data),

  getDeviceSessions: (userId: string) =>
    apiClient.get<DeviceSessionEntry[]>(`/admin/user-management/${userId}/sessions`).then(r => r.data),

  revokeDeviceSession: (userId: string, sessionId: string) =>
    apiClient.post<{ message: string }>(`/admin/user-management/${userId}/sessions/${sessionId}/revoke`).then(r => r.data),

  // ── Employer KYC verification ────────────────────────────────────────────────
  listEmployerVerifications: (status?: string) =>
    apiClient.get<EmployerVerificationEntry[]>('/admin/employer-verifications', { params: status ? { status } : undefined }).then(r => r.data),

  getEmployerVerification: (verificationId: string) =>
    apiClient.get<EmployerVerificationDetail>(`/admin/employer-verifications/${verificationId}`).then(r => r.data),

  reviewEmployerVerification: (verificationId: string, payload: { action: string; notes?: string; rejection_reason?: string }) =>
    apiClient.post<EmployerVerificationDetail>(`/admin/employer-verifications/${verificationId}/review`, payload).then(r => r.data),

  downloadVerificationDocument: async (verificationId: string, documentId: string, filename: string) => {
    const res = await apiClient.get(`/admin/employer-verifications/${verificationId}/documents/${documentId}`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data as Blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },

  // ── Audit log ───────────────────────────────────────────────────────────────
  listAuditLogs: (params?: { user_id?: string; action?: string; from?: string; to?: string; limit?: number; offset?: number }) =>
    apiClient.get<AuditLogPage>('/admin/audit-logs', { params }).then(r => r.data),

  // ── Billing overview (platform revenue) ──────────────────────────────────────
  getBillingOverview: () =>
    apiClient.get<BillingOverviewResponse>('/admin/billing/overview').then(r => r.data),

  // ── Subscription plans ────────────────────────────────────────────────────────
  listSubscriptionPlans: () =>
    apiClient.get<SubscriptionPlanAdminEntry[]>('/admin/subscription-plans').then(r => r.data),

  updateSubscriptionPlan: (planId: string, payload: Partial<Omit<SubscriptionPlanAdminEntry, 'id' | 'name'>>) =>
    apiClient.patch<SubscriptionPlanAdminEntry>(`/admin/subscription-plans/${planId}`, payload).then(r => r.data),

  // ── System monitoring ─────────────────────────────────────────────────────────
  getSystemStatus: () =>
    apiClient.get<SystemStatusResponse>('/admin/platform/system').then(r => r.data),

  // ── Integrations ──────────────────────────────────────────────────────────────
  getIntegrations: () =>
    apiClient.get<IntegrationsResponse>('/admin/platform/integrations').then(r => r.data),

  // ── Analytics ─────────────────────────────────────────────────────────────────
  getAnalytics: (params: { days?: number; from_date?: string; to_date?: string }) =>
    apiClient.get<AnalyticsResponse>('/admin/analytics', { params }).then(r => r.data),

  // ── AI prompt management ──────────────────────────────────────────────────────
  listPrompts: () =>
    apiClient.get<PromptTemplateEntry[]>('/admin/platform/prompts').then(r => r.data),

  getPrompt: (id: string) =>
    apiClient.get<PromptTemplateDetail>(`/admin/platform/prompts/${id}`).then(r => r.data),

  createPrompt: (payload: CreatePromptPayload) =>
    apiClient.post<{ id: string; use_case: string; version: number }>('/admin/platform/prompts', payload).then(r => r.data),

  activatePromptVersion: (id: string) =>
    apiClient.patch<{ id: string; use_case: string; version: number; is_active: boolean }>(`/admin/platform/prompts/${id}/activate`).then(r => r.data),

  seedPrompts: () =>
    apiClient.post<{ inserted: number; message: string }>('/admin/platform/prompts/seed').then(r => r.data),

  backfillEmbeddings: () =>
    apiClient.post<BackfillResult>('/admin/platform/embeddings/backfill').then(r => r.data),

  // ── Platform settings & feature flags ────────────────────────────────────────
  listPlatformSettings: () =>
    apiClient.get<PlatformSettingEntry[]>('/admin/platform/settings').then(r => r.data),

  updatePlatformSetting: (key: string, payload: { value: unknown; description?: string }) =>
    apiClient.put<{ key: string; value: unknown }>(`/admin/platform/settings/${key}`, payload).then(r => r.data),

  listFeatureFlags: () =>
    apiClient.get<FeatureFlagEntry[]>('/admin/platform/flags').then(r => r.data),

  updateFeatureFlag: (flagName: string, payload: { is_enabled: boolean; rollout_pct: number; target_roles?: string[] | null; description?: string }) =>
    apiClient.put<{ flag_name: string; is_enabled: boolean; rollout_pct: number }>(`/admin/platform/flags/${flagName}`, payload).then(r => r.data),

  // ── Notification management ───────────────────────────────────────────────
  getNotifications: (params?: { user_id?: string; type?: string; delivery_status?: string; is_read?: boolean; skip?: number; limit?: number }) =>
    apiClient.get<NotificationListResponse>('/admin/notifications', { params }).then(r => r.data),

  getNotificationsStats: () =>
    apiClient.get<NotificationStatsResponse>('/admin/notifications/stats').then(r => r.data),

  deleteNotification: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/notifications/${id}`).then(r => r.data),

  getUserNotifications: (userId: string, params?: { skip?: number; limit?: number }) =>
    apiClient.get<NotificationListResponse>(`/admin/users/${userId}/notifications`, { params }).then(r => r.data),

  // ── Announcements ─────────────────────────────────────────────────────────
  listAnnouncements: (status?: AnnouncementStatus) =>
    apiClient.get<AnnouncementEntry[]>('/admin/announcements', { params: status ? { status } : {} }).then(r => r.data),

  createAnnouncement: (payload: AnnouncementCreatePayload) =>
    apiClient.post<AnnouncementEntry>('/admin/announcements', payload).then(r => r.data),

  updateAnnouncement: (id: string, payload: Partial<AnnouncementCreatePayload>) =>
    apiClient.patch<AnnouncementEntry>(`/admin/announcements/${id}`, payload).then(r => r.data),

  publishAnnouncement: (id: string) =>
    apiClient.post<AnnouncementEntry>(`/admin/announcements/${id}/publish`).then(r => r.data),

  deleteAnnouncement: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/announcements/${id}`).then(r => r.data),

  // ── Support tickets ────────────────────────────────────────────────────────
  listTickets: (params?: {
    status?: string; priority?: string; entity_type?: string;
    search?: string; skip?: number; limit?: number
  }) =>
    apiClient.get<TicketListResponse>('/admin/support/tickets', { params }).then(r => r.data),

  getTicket: (id: string) =>
    apiClient.get<TicketDetail>(`/admin/support/tickets/${id}`).then(r => r.data),

  createTicket: (payload: CreateTicketPayload) =>
    apiClient.post<TicketEntry>('/admin/support/tickets', payload).then(r => r.data),

  updateTicket: (id: string, payload: UpdateTicketPayload) =>
    apiClient.patch<TicketEntry>(`/admin/support/tickets/${id}`, payload).then(r => r.data),

  addTicketMessage: (ticketId: string, payload: AddMessagePayload) =>
    apiClient.post<TicketMessage>(`/admin/support/tickets/${ticketId}/messages`, payload).then(r => r.data),

  getEmployerSupport: (profileId: string) =>
    apiClient.get<TicketListResponse>(`/admin/employers/${profileId}/support`).then(r => r.data),

  getCandidateSupport: (userId: string) =>
    apiClient.get<TicketListResponse>(`/admin/candidates/${userId}/support`).then(r => r.data),

  // ── AI Interviewer calibration (Phase 7) ──────────────────────────────────────
  sampleInterviewSessionsForReview: (limit = 10) =>
    apiClient.get<ReviewableSession[]>('/admin/interview-calibration/sample', { params: { limit } }).then(r => r.data),

  submitInterviewHumanReview: (sessionId: string, payload: SubmitHumanReviewPayload) =>
    apiClient.post<{ message: string }>(`/admin/interview-calibration/${sessionId}/review`, payload).then(r => r.data),

  getInterviewCalibrationStats: () =>
    apiClient.get<CalibrationStats>('/admin/interview-calibration/stats').then(r => r.data),

  getInterviewOutcomeCorrelation: () =>
    apiClient.get<OutcomeCorrelation>('/admin/interview-calibration/outcome-correlation').then(r => r.data),
}

// ── Support ticket types ──────────────────────────────────────────────────────

export interface TicketEntry {
  id: string
  subject: string
  status: 'open' | 'pending' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category: string
  entity_type: 'employer' | 'candidate' | 'general'
  entity_id: string | null
  reporter_id: string | null
  reporter_name: string | null
  reporter_phone: string | null
  assigned_to: string | null
  assignee_name: string | null
  sla_deadline: string | null
  message_count: number
  created_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
}

export interface TicketMessage {
  id: string
  sender_id: string | null
  sender_name: string | null
  body: string
  is_internal: boolean
  created_at: string
}

export interface TicketAttachment {
  id: string
  filename: string
  content_type: string | null
  size_bytes: number | null
  file_key: string
  uploaded_by: string | null
  created_at: string
}

export interface TicketDetail extends TicketEntry {
  body: string | null
  messages: TicketMessage[]
  attachments: TicketAttachment[]
}

export interface TicketListResponse {
  total: number
  items: TicketEntry[]
}

export interface CreateTicketPayload {
  subject: string
  body?: string
  priority?: string
  entity_type?: string
  entity_id?: string
  reporter_id?: string
}

export interface UpdateTicketPayload {
  status?: string
  priority?: string
  assigned_to?: string | null
}

export interface AddMessagePayload {
  body: string
  is_internal?: boolean
}

// ── AI Interviewer calibration (Phase 7) ────────────────────────────────────

export interface ReviewableSession {
  session_id: string
  job_role: string | null
  experience_level: string | null
  completed_at: string | null
  transcript: { question: string; response: string }[]
}

export interface SubmitHumanReviewPayload {
  human_readiness_score: number
  human_recommendation: string
  notes?: string
}

export interface HumanReviewEntry {
  session_id: string
  ai_readiness_score: number | null
  ai_recommendation: string | null
  human_readiness_score: number
  human_recommendation: string
  agree: boolean
  reviewed_at: string
}

export interface CalibrationStats {
  total_reviews: number
  agreement_rate: number | null
  reviews: HumanReviewEntry[]
}

export interface OutcomeCorrelationRow {
  hiring_recommendation: string
  total: number
  outcomes: Record<string, number>
}

export interface OutcomeCorrelation {
  total_outcomes_reported: number
  by_recommendation: OutcomeCorrelationRow[]
}

