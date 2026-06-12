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
  industry: string
  company_size: string
  website: string | null
  gst_number: string | null
  contact_person: string
  designation: string | null
  city: string
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

export const adminApi = {
  getStats: () =>
    apiClient.get<AdminStats>('/admin/stats').then(r => r.data),

  // ── Employers ────────────────────────────────────────────────────────────────
  listEmployers: (status: EmployerStatus = 'pending') =>
    apiClient.get<EmployerEntry[]>('/admin/employers', { params: { status } }).then(r => r.data),

  approveEmployer: (profileId: string) =>
    apiClient.post<{ message: string }>(`/admin/employers/${profileId}/approve`).then(r => r.data),

  rejectEmployer: (profileId: string, reason: string) =>
    apiClient.post<{ message: string }>(`/admin/employers/${profileId}/reject`, { reason }).then(r => r.data),

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
}
