/**
 * Phase 3 — Employer Matching API
 * Covers both aspirant (job search + applications) and employer (candidate pipeline) flows.
 */
import apiClient from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobListItem {
  id: string
  title: string
  sector: string
  company_name: string
  location: string | null
  job_type: string | null
  employment_type: string | null
  salary_min: number | null
  salary_max: number | null
  required_skills: string[]
  min_k_score: number
  match_score: number | null
  skill_overlap_pct: number | null
  semantic_score: number | null
  expires_at: string | null
  created_at: string
}

export interface JobDetail extends JobListItem {
  description: string
  growth_outlook: string | null
  match_summary: string | null
}

export interface JobRecommendationsResponse {
  total: number
  jobs: JobListItem[]
}

export interface ApplicationOut {
  id: string
  job_id: string
  job_title: string
  company_name: string
  status: string
  match_score: number | null
  cover_note: string | null
  employer_note: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationStatusHistoryItem {
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

export interface ApplicationDetailOut extends ApplicationOut {
  status_history: ApplicationStatusHistoryItem[]
}

export interface CandidateOut {
  application_id: string
  aspirant_id: string
  full_name: string | null
  city: string | null
  state: string | null
  upsc_attempts: number | null
  highest_stage_cleared: string | null
  skills: string[]
  k_score: number | null
  r_score: number | null
  s_score: number | null
  composite: number | null
  match_score: number | null
  status: string
  cover_note: string | null
  applied_at: string
}

export interface JobCandidatePipeline {
  job_id: string
  job_title: string
  total_applications: number
  by_status: Record<string, number>
  candidates: CandidateOut[]
}

// ── Aspirant: job discovery ───────────────────────────────────────────────────

interface JobQueryParams {
  sector?: string
  job_type?: string
  min_salary?: number
  limit?: number
  offset?: number
}

export const getJobs = (params: JobQueryParams = {}): Promise<JobRecommendationsResponse> =>
  apiClient.get('/jobs', { params }).then((r) => r.data)

export const getJobDetail = (jobId: string): Promise<JobDetail> =>
  apiClient.get(`/jobs/${jobId}`).then((r) => r.data)

// ── Aspirant: applications ────────────────────────────────────────────────────

export const applyToJob = (jobId: string, coverNote?: string): Promise<ApplicationOut> =>
  apiClient.post(`/jobs/${jobId}/apply`, { cover_note: coverNote || null }).then((r) => r.data)

export const getMyApplications = (): Promise<ApplicationOut[]> =>
  apiClient.get('/jobs/applications').then((r) => r.data)

export const getApplicationDetail = (id: string): Promise<ApplicationDetailOut> =>
  apiClient.get(`/jobs/applications/${id}`).then((r) => r.data)

export const withdrawApplication = (id: string): Promise<{ status: string }> =>
  apiClient.post(`/jobs/applications/${id}/withdraw`).then((r) => r.data)

// ── Employer: candidate pipeline ──────────────────────────────────────────────

export const getJobPipeline = (jobId: string): Promise<JobCandidatePipeline> =>
  apiClient.get(`/employer/pipeline/${jobId}`).then((r) => r.data)

export const updateApplicationStatus = (
  applicationId: string,
  status: string,
  note?: string,
): Promise<{ application_id: string; status: string }> =>
  apiClient
    .patch(`/employer/pipeline/applications/${applicationId}`, { status, note: note || null })
    .then((r) => r.data)
