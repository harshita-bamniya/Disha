import { apiClient } from './client'

export type GrowthOutlook = 'high' | 'medium' | 'low'
export type JobType = 'remote' | 'pan_india' | 'hybrid' | 'onsite'
export type EmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract' | 'freelance'

export interface JobPostingPayload {
  title: string
  description: string
  sector: string
  required_skills: string[]
  min_k_score: number
  salary_min?: number
  salary_max?: number
  growth_outlook?: GrowthOutlook
  job_type: JobType
  location: string
  employment_type: EmploymentType
  expires_at?: string | null      // ISO date string "YYYY-MM-DD"
}

export interface JobPosting {
  id: string
  title: string
  description: string
  sector: string
  required_skills: string[]
  min_k_score: number
  salary_min: number | null
  salary_max: number | null
  growth_outlook: string | null
  job_type: string | null
  location: string | null
  employment_type: string | null
  expires_at: string | null       // ISO date string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmployerDashboard {
  company_name: string
  is_approved: boolean
  total_jobs: number
  active_jobs: number
  jobs: JobPosting[]
}

/** Human-readable salary display from min/max LPA integers */
export function formatSalary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${min}–${max} LPA`
  if (min != null) return `${min}+ LPA`
  return `Up to ${max} LPA`
}

/** Human-readable employment type label */
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time:  'Full Time',
  part_time:  'Part Time',
  internship: 'Internship',
  contract:   'Contract',
  freelance:  'Freelance',
}

export const jobsApi = {
  getDashboard: () =>
    apiClient.get<EmployerDashboard>('/employer/dashboard').then((r) => r.data),

  createJob: (data: JobPostingPayload) =>
    apiClient.post<JobPosting>('/employer/jobs', data).then((r) => r.data),

  updateJob: (id: string, data: JobPostingPayload) =>
    apiClient.put<JobPosting>(`/employer/jobs/${id}`, data).then((r) => r.data),

  toggleActive: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/toggle`).then((r) => r.data),

  deleteJob: (id: string) =>
    apiClient.delete(`/employer/jobs/${id}`),
}
