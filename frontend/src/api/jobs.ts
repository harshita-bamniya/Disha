import { apiClient } from './client'

export type GrowthOutlook = 'high' | 'medium' | 'low'
export type JobType = 'remote' | 'pan_india' | 'hybrid' | 'onsite'
export type EmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract' | 'freelance'
export type JobStatus = 'draft' | 'published' | 'paused' | 'closed' | 'archived'

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
  expires_at: string              // ISO date string "YYYY-MM-DD" — required
  publish?: boolean                // true = publish immediately, false/omitted = save as draft
}

export interface BulkImportRowError {
  row: number
  error: string
}

export interface BulkImportResponse {
  created: number
  failed: BulkImportRowError[]
}

export interface JobTemplateEntry {
  id: string
  name: string
  title: string
  description: string
  sector: string
  required_skills: string[]
  job_type: JobType | null
  employment_type: EmploymentType | null
  min_k_score: number
  created_at: string
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
  status: JobStatus
  created_at: string
  updated_at: string
  applicant_count: number
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

export type VerificationDocType = 'gst_certificate' | 'pan_card' | 'company_registration' | 'business_email'

export interface VerificationDocumentOut {
  id: string
  doc_type: string
  file_url: string
  original_filename: string | null
  status: string
  uploaded_at: string
}

export interface VerificationEventOut {
  id: string
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

export interface VerificationStatusResponse {
  id: string | null
  status: 'not_submitted' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmitted'
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  documents: VerificationDocumentOut[]
  events: VerificationEventOut[]
}

export interface EmployerPermissionsResponse {
  role_name: string
  permissions: string[]   // "resource:action"
}

export const jobsApi = {
  getDashboard: () =>
    apiClient.get<EmployerDashboard>('/employer/dashboard').then((r) => r.data),

  getMyPermissions: () =>
    apiClient.get<EmployerPermissionsResponse>('/employer/permissions').then((r) => r.data),

  createJob: (data: JobPostingPayload) =>
    apiClient.post<JobPosting>('/employer/jobs', data).then((r) => r.data),

  suggestSkills: (title: string, description: string) =>
    apiClient.post<{ suggested_skills: string[] }>('/employer/jobs/suggest-skills', { title, description }).then((r) => r.data),

  generateDescription: (title: string, sector: string, keyPoints: string) =>
    apiClient.post<{ description: string }>('/employer/jobs/generate-description', { title, sector, key_points: keyPoints }).then((r) => r.data),

  bulkImportJobs: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<BulkImportResponse>('/employer/jobs/bulk-import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  listJobTemplates: () =>
    apiClient.get<JobTemplateEntry[]>('/employer/jobs/templates').then((r) => r.data),

  createJobTemplate: (payload: Omit<JobTemplateEntry, 'id' | 'created_at'>) =>
    apiClient.post<JobTemplateEntry>('/employer/jobs/templates', payload).then((r) => r.data),

  deleteJobTemplate: (templateId: string) =>
    apiClient.delete<{ message: string }>(`/employer/jobs/templates/${templateId}`).then((r) => r.data),

  updateJob: (id: string, data: JobPostingPayload) =>
    apiClient.put<JobPosting>(`/employer/jobs/${id}`, data).then((r) => r.data),

  publishJob: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/publish`).then((r) => r.data),

  pauseJob: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/pause`).then((r) => r.data),

  closeJob: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/close`).then((r) => r.data),

  reopenJob: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/reopen`).then((r) => r.data),

  archiveJob: (id: string) =>
    apiClient.patch<JobPosting>(`/employer/jobs/${id}/archive`).then((r) => r.data),

  duplicateJob: (id: string) =>
    apiClient.post<JobPosting>(`/employer/jobs/${id}/duplicate`).then((r) => r.data),

  deleteJob: (id: string) =>
    apiClient.delete(`/employer/jobs/${id}`),

  // ── KYC verification ──────────────────────────────────────────────────────────
  getVerificationStatus: () =>
    apiClient.get<VerificationStatusResponse>('/employer/verification').then((r) => r.data),

  uploadVerificationDocument: (docType: VerificationDocType, file: File) => {
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    return apiClient.post<VerificationStatusResponse>('/employer/verification/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  submitVerification: () =>
    apiClient.post<VerificationStatusResponse>('/employer/verification/submit').then((r) => r.data),
}
