/**
 * Phase 3 — Employer Matching API
 * Covers both aspirant (job search + applications) and employer (candidate pipeline) flows.
 */
import { apiClient } from './client'

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

export interface CandidatePsychProfile {
  burnout_score: number | null
  confidence_index: number | null
  financial_pressure_score: number | null
  risk_tolerance: string | null
  motivation_type: string | null
}

export interface CandidateOut {
  application_id: string
  aspirant_id: string
  // Personal
  full_name: string | null
  city: string | null
  state: string | null
  gender: string | null
  // Education
  highest_qualification: string | null
  degree: string | null
  field_of_study: string | null
  institution: string | null
  graduation_year: number | null
  // UPSC
  upsc_attempts: number | null
  highest_stage_cleared: string | null
  years_preparing: number | null
  optional_subject: string | null
  // Work Experience
  has_work_experience: boolean | null
  work_experience_years: number | null
  work_experience_domain: string | null
  last_designation: string | null
  // Skills
  skills: string[]
  // KRS
  k_score: number | null
  r_score: number | null
  s_score: number | null
  composite: number | null
  // Psychological
  psych: CandidatePsychProfile | null
  // Salary
  expected_salary_min: number | null
  expected_salary_max: number | null
  open_to_relocation: boolean | null
  preferred_locations: string[] | null
  // Application
  match_score: number | null
  status: string
  cover_note: string | null
  employer_note: string | null
  applied_at: string
  days_ago: number
  status_history: ApplicationStatusHistoryItem[]
  notes: CandidateNoteOut[]
  avg_rating: number | null
  interview_feedback: InterviewFeedbackOut[]
}

export interface CandidateNoteOut {
  id: string
  author_name: string | null
  note: string
  is_internal: boolean
  created_at: string
}

export interface InterviewFeedbackOut {
  id: string
  application_id: string
  interviewer_name: string | null
  scheduled_at: string | null
  meeting_link: string | null
  status: 'scheduled' | 'completed' | 'canceled'
  recommendation: string | null
  feedback: string | null
  created_at: string
}

export interface UpcomingInterviewEntry {
  id: string
  application_id: string
  candidate_name: string | null
  job_id: string
  job_title: string
  scheduled_at: string
  meeting_link: string | null
  interviewer_name: string | null
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

export const withdrawApplication = (
  id: string, reason?: string, note?: string,
): Promise<{ status: string }> =>
  apiClient.post(`/jobs/applications/${id}/withdraw`, { reason: reason || null, note: note || null }).then((r) => r.data)

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

export const updateApplicationNote = (
  applicationId: string,
  note: string,
): Promise<{ application_id: string; note: string }> =>
  apiClient
    .patch(`/employer/pipeline/applications/${applicationId}/note`, { note })
    .then((r) => r.data)

export const bulkUpdateApplicationStatus = (
  applicationIds: string[],
  status: string,
  note?: string,
): Promise<{ updated: number; status: string }> =>
  apiClient
    .post('/employer/pipeline/applications/bulk-action', { application_ids: applicationIds, status, note: note || null })
    .then((r) => r.data)

export const addCandidateNote = (
  applicationId: string,
  note: string,
  isInternal = true,
): Promise<CandidateNoteOut> =>
  apiClient
    .post(`/employer/pipeline/applications/${applicationId}/notes`, { note, is_internal: isInternal })
    .then((r) => r.data)

export const setCandidateRating = (
  applicationId: string,
  rating: number,
): Promise<{ application_id: string; avg_rating: number | null }> =>
  apiClient
    .put(`/employer/pipeline/applications/${applicationId}/rating`, { rating })
    .then((r) => r.data)

export const scheduleInterview = (
  applicationId: string,
  payload: { scheduled_at: string; meeting_link?: string },
): Promise<InterviewFeedbackOut> =>
  apiClient
    .post(`/employer/pipeline/applications/${applicationId}/interviews`, payload)
    .then((r) => r.data)

export const submitInterviewFeedback = (
  applicationId: string,
  interviewId: string,
  payload: { recommendation?: string; feedback?: string },
): Promise<InterviewFeedbackOut> =>
  apiClient
    .patch(`/employer/pipeline/applications/${applicationId}/interviews/${interviewId}/feedback`, payload)
    .then((r) => r.data)

export const cancelInterview = (
  applicationId: string,
  interviewId: string,
): Promise<InterviewFeedbackOut> =>
  apiClient
    .patch(`/employer/pipeline/applications/${applicationId}/interviews/${interviewId}/cancel`)
    .then((r) => r.data)

export const getUpcomingInterviews = (limit = 20): Promise<UpcomingInterviewEntry[]> =>
  apiClient
    .get('/employer/interviews/upcoming', { params: { limit } })
    .then((r) => r.data)
