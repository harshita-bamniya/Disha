import { apiClient } from './client'

export interface CompanyProfile {
  id: string
  name: string
  industry: string | null
  company_size: string | null
  website: string | null
  logo_url: string | null
  cover_banner_url: string | null
  headquarters: string | null
  founded_year: number | null
  social_links: Record<string, string> | null
  description: string | null
  verification_status: string
  created_at: string
}

export interface CompanyProfileUpdatePayload {
  name?: string
  industry?: string
  company_size?: string
  website?: string
  logo_url?: string
  cover_banner_url?: string
  headquarters?: string
  founded_year?: number
  social_links?: Record<string, string>
  description?: string
}

export interface EmployerProfileSelf {
  id: string
  full_name: string | null
  email: string | null
  contact_person: string | null
  designation: string | null
  city: string | null
  gst_number: string | null
}

export interface EmployerProfileUpdatePayload {
  full_name?: string
  email?: string
  contact_person?: string
  designation?: string
  city?: string
  gst_number?: string
}

export interface TeamMemberEntry {
  user_id: string
  employer_profile_id: string
  email: string | null
  phone: string | null
  contact_person: string
  role_name: string
  is_owner: boolean
  is_active: boolean
  created_at: string
  department_id: string | null
  department_name: string | null
}

export interface TeamInvitePayload {
  email: string
  contact_person: string
  role_name: 'hr_manager' | 'recruiter' | 'interviewer' | 'hiring_manager'
  department_id?: string
  password?: string
}

export interface SubscriptionPlanEntry {
  id: string
  name: string
  price_monthly: number
  max_active_jobs: number | null
  max_recruiter_seats: number | null
  resume_access: boolean
  candidate_search_limit: number | null
  is_active: boolean
}

export interface CompanySubscriptionResponse {
  plan: SubscriptionPlanEntry
  status: string
  current_period_start: string
  current_period_end: string
}

export interface SubscriptionUsageResponse {
  active_jobs_used: number
  active_jobs_limit: number | null
  recruiter_seats_used: number
  recruiter_seats_limit: number | null
}

export const subscriptionApi = {
  getSubscription: () =>
    apiClient.get<CompanySubscriptionResponse>('/employer/subscription').then(r => r.data),

  getUsage: () =>
    apiClient.get<SubscriptionUsageResponse>('/employer/subscription/usage').then(r => r.data),

  listPlans: () =>
    apiClient.get<SubscriptionPlanEntry[]>('/employer/subscription/plans').then(r => r.data),

  upgrade: (planId: string) =>
    apiClient.post<CompanySubscriptionResponse>('/employer/subscription/upgrade', { plan_id: planId }).then(r => r.data),
}

export interface OfficeEntry {
  id: string
  name: string
  city: string
  state: string | null
  is_headquarters: boolean
}

export interface DepartmentEntry {
  id: string
  name: string
  description: string | null
  head_employer_id: string | null
  head_name: string | null
  member_count: number
  total_job_count: number
  active_job_count: number
  total_applicant_count: number
  created_at: string | null
}

export interface DepartmentOverviewEntry extends DepartmentEntry {
  pipeline_funnel: Record<string, number>
  scheduled_interviews_count: number
  pending_offers_count: number
  avg_days_to_hire: number | null
}

export interface DepartmentJobEntry {
  id: string
  title: string
  sector: string
  job_type: string
  employment_type: string
  location: string
  status: string
  is_active: boolean
  expires_at: string | null
  created_at: string | null
  applicant_count: number
}

export interface DepartmentCreatePayload {
  name: string
  description?: string
  head_employer_id?: string
}

export interface DepartmentUpdatePayload {
  name?: string
  description?: string
  head_employer_id?: string | null
}

export const companyApi = {
  getProfile: () =>
    apiClient.get<CompanyProfile>('/employer/company').then(r => r.data),

  updateProfile: (payload: CompanyProfileUpdatePayload) =>
    apiClient.patch<CompanyProfile>('/employer/company', payload).then(r => r.data),

  updateEmployerProfile: (payload: EmployerProfileUpdatePayload) =>
    apiClient.patch<EmployerProfileSelf>('/employer/company/profile', payload).then(r => r.data),

  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<{ url: string }>('/employer/company/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  uploadBanner: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<{ url: string }>('/employer/company/banner', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  listTeam: () =>
    apiClient.get<TeamMemberEntry[]>('/employer/company/team').then(r => r.data),

  inviteTeamMember: (payload: TeamInvitePayload) =>
    apiClient.post<TeamMemberEntry>('/employer/company/team/invite', payload).then(r => r.data),

  removeTeamMember: (employerProfileId: string) =>
    apiClient.delete<{ message: string }>(`/employer/company/team/${employerProfileId}`).then(r => r.data),

  transferOwnership: (newOwnerEmployerProfileId: string) =>
    apiClient.post<{ message: string }>('/employer/company/team/transfer-ownership', {
      new_owner_employer_profile_id: newOwnerEmployerProfileId,
    }).then(r => r.data),

  listOffices: () =>
    apiClient.get<OfficeEntry[]>('/employer/company/offices').then(r => r.data),

  createOffice: (payload: { name: string; city: string; state?: string; is_headquarters?: boolean }) =>
    apiClient.post<OfficeEntry>('/employer/company/offices', payload).then(r => r.data),

  deleteOffice: (officeId: string) =>
    apiClient.delete<{ message: string }>(`/employer/company/offices/${officeId}`).then(r => r.data),

  listDepartments: () =>
    apiClient.get<DepartmentEntry[]>('/employer/company/departments').then(r => r.data),

  getDepartment: (departmentId: string) =>
    apiClient.get<DepartmentEntry>(`/employer/company/departments/${departmentId}`).then(r => r.data),

  createDepartment: (payload: DepartmentCreatePayload) =>
    apiClient.post<DepartmentEntry>('/employer/company/departments', payload).then(r => r.data),

  updateDepartment: (departmentId: string, payload: DepartmentUpdatePayload) =>
    apiClient.patch<DepartmentEntry>(`/employer/company/departments/${departmentId}`, payload).then(r => r.data),

  deleteDepartment: (departmentId: string) =>
    apiClient.delete<{ message: string }>(`/employer/company/departments/${departmentId}`).then(r => r.data),

  getDepartmentJobs: (departmentId: string) =>
    apiClient.get<DepartmentJobEntry[]>(`/employer/company/departments/${departmentId}/jobs`).then(r => r.data),

  getDepartmentOverview: (departmentId: string) =>
    apiClient.get<DepartmentOverviewEntry>(`/employer/company/departments/${departmentId}/overview`).then(r => r.data),

  assignMemberDepartment: (employerProfileId: string, departmentId: string | null) =>
    apiClient.patch<TeamMemberEntry>(`/employer/company/team/${employerProfileId}/department`, { department_id: departmentId }).then(r => r.data),

  getTeamActivity: (limit = 50) =>
    apiClient.get<TeamActivityEntry[]>('/employer/company/team/activity', { params: { limit } }).then(r => r.data),
}

export interface HiringTeamMember {
  id: string
  employer_profile_id: string
  contact_person: string
  email: string | null
  job_role: 'hiring_manager' | 'interviewer' | 'coordinator' | 'recruiter'
  added_at: string
}

export interface HiringTeamAddPayload {
  employer_profile_id: string
  job_role: 'hiring_manager' | 'interviewer' | 'coordinator' | 'recruiter'
}

export const hiringTeamApi = {
  list: (jobId: string) =>
    apiClient.get<HiringTeamMember[]>(`/employer/jobs/${jobId}/hiring-team`).then(r => r.data),

  add: (jobId: string, payload: HiringTeamAddPayload) =>
    apiClient.post<HiringTeamMember>(`/employer/jobs/${jobId}/hiring-team`, payload).then(r => r.data),

  remove: (jobId: string, memberId: string) =>
    apiClient.delete<{ message: string }>(`/employer/jobs/${jobId}/hiring-team/${memberId}`).then(r => r.data),
}

export interface TeamActivityEntry {
  id: string
  action: string
  resource: string | null
  resource_id: string | null
  actor_email: string | null
  actor_name: string | null
  created_at: string
}
