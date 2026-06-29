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
  phone: string
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
  financial_pressure_score: number
  risk_tolerance: string
  motivation_type: string
  identity_attachment: string
  support_system: string
  disha_insight: string | null
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

export const adminApi = {
  getStats: () =>
    apiClient.get<AdminStats>('/admin/stats').then(r => r.data),

  // ── Employers ────────────────────────────────────────────────────────────────
  listEmployers: (status: EmployerStatus = 'pending') =>
    apiClient.get<EmployerEntry[]>('/admin/employers', { params: { status } }).then(r => r.data),

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

  toggleJob: (jobId: string) =>
    apiClient.patch<AdminJobEntry>(`/admin/jobs/${jobId}/toggle`).then(r => r.data),

  deleteJob: (jobId: string) =>
    apiClient.delete<{ message: string }>(`/admin/jobs/${jobId}`).then(r => r.data),

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

  // ── Subscription plans ────────────────────────────────────────────────────────
  listSubscriptionPlans: () =>
    apiClient.get<SubscriptionPlanAdminEntry[]>('/admin/subscription-plans').then(r => r.data),

  updateSubscriptionPlan: (planId: string, payload: Partial<Omit<SubscriptionPlanAdminEntry, 'id' | 'name'>>) =>
    apiClient.patch<SubscriptionPlanAdminEntry>(`/admin/subscription-plans/${planId}`, payload).then(r => r.data),
}
