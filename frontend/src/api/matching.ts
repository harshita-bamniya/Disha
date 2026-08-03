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
  department_id: string | null
  department_name: string | null
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

export interface CandidateEmailLogOut {
  id: string
  sender_name: string | null
  recipient_email: string
  subject: string
  body: string
  created_at: string
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
  reschedule_requested_at: string | null
  reschedule_note: string | null
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

export interface SavedCandidateOut {
  aspirant_id: string
  full_name: string | null
  city: string | null
  state: string | null
  highest_qualification: string | null
  last_designation: string | null
  skills: string[]
  composite: number | null
  note: string | null
  saved_by_name: string | null
  saved_at: string
}

// ── Aspirant: job discovery ───────────────────────────────────────────────────

interface JobQueryParams {
  sector?: string
  job_type?: string
  min_salary?: number
  q?: string
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

export const getMyInterviews = (applicationId: string): Promise<InterviewFeedbackOut[]> =>
  apiClient.get(`/jobs/applications/${applicationId}/interviews`).then((r) => r.data)

export const requestInterviewReschedule = (
  applicationId: string, interviewId: string, note: string,
): Promise<InterviewFeedbackOut> =>
  apiClient.post(`/jobs/applications/${applicationId}/interviews/${interviewId}/request-reschedule`, { note }).then((r) => r.data)

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

export const sendCandidateEmail = (
  applicationId: string,
  subject: string,
  body: string,
): Promise<CandidateEmailLogOut> =>
  apiClient
    .post(`/employer/pipeline/applications/${applicationId}/email`, { subject, body })
    .then((r) => r.data)

export const getCandidateEmails = (applicationId: string): Promise<CandidateEmailLogOut[]> =>
  apiClient.get(`/employer/pipeline/applications/${applicationId}/email`).then((r) => r.data)

export const bulkEmailCandidates = (
  applicationIds: string[],
  subject: string,
  body: string,
): Promise<{ sent: number; skipped: number }> =>
  apiClient
    .post('/employer/pipeline/applications/bulk-email', { application_ids: applicationIds, subject, body })
    .then((r) => r.data)

export interface OfferLetterPayload {
  role_title: string
  salary_ctc: string
  start_date: string
  work_location: string
  employment_type: string
  company_address?: string
  hiring_manager_name: string
  hiring_manager_designation: string
  extra_clauses?: string
}

export interface OfferLetterOut {
  id: string
  application_id: string
  status: 'sent' | 'accepted' | 'declined'
  role_title: string
  salary_ctc: string
  start_date: string
  work_location: string
  employment_type: string
  company_address: string | null
  hiring_manager_name: string
  hiring_manager_designation: string
  extra_clauses: string | null
  sent_at: string | null
  responded_at: string | null
  signature_name: string | null
  decline_reason: string | null
  created_at: string
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Employer: send/view the offer letter for an application
export const sendOfferLetter = (applicationId: string, payload: OfferLetterPayload): Promise<OfferLetterOut> =>
  apiClient.post(`/employer/pipeline/applications/${applicationId}/offer-letter`, payload).then((r) => r.data)

export const getOfferLetter = (applicationId: string): Promise<OfferLetterOut | null> =>
  apiClient.get(`/employer/pipeline/applications/${applicationId}/offer-letter`).then((r) => r.data)

export const downloadOfferLetterPdf = async (applicationId: string) => {
  const res = await apiClient.get(`/employer/pipeline/applications/${applicationId}/offer-letter/pdf`, { responseType: 'blob' })
  downloadBlob(res.data, `offer_letter_${applicationId}.pdf`, 'application/pdf')
}

// Aspirant: view + respond to an offer letter (self-serve e-signature)
export const getMyOfferLetter = (applicationId: string): Promise<OfferLetterOut | null> =>
  apiClient.get(`/jobs/applications/${applicationId}/offer-letter`).then((r) => r.data)
    .catch((e) => { if (e?.response?.status === 404) return null; throw e })

export const downloadMyOfferLetterPdf = async (applicationId: string) => {
  const res = await apiClient.get(`/jobs/applications/${applicationId}/offer-letter/pdf`, { responseType: 'blob' })
  downloadBlob(res.data, `offer_letter_${applicationId}.pdf`, 'application/pdf')
}

export const acceptOfferLetter = (applicationId: string, signatureName: string): Promise<OfferLetterOut> =>
  apiClient
    .post(`/jobs/applications/${applicationId}/offer-letter/accept`, { signature_name: signatureName, confirm: true })
    .then((r) => r.data)

export const declineOfferLetter = (applicationId: string, reason?: string): Promise<OfferLetterOut> =>
  apiClient
    .post(`/jobs/applications/${applicationId}/offer-letter/decline`, { reason: reason || null })
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

export const rescheduleInterview = (
  applicationId: string,
  interviewId: string,
  payload: { scheduled_at: string; meeting_link?: string },
): Promise<InterviewFeedbackOut> =>
  apiClient
    .patch(`/employer/pipeline/applications/${applicationId}/interviews/${interviewId}/reschedule`, payload)
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

export const downloadInterviewIcs = async (applicationId: string, interviewId: string) => {
  const res = await apiClient.get(
    `/employer/pipeline/applications/${applicationId}/interviews/${interviewId}/ics`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'interview.ics'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Employer: talent pool (saved candidates) ──────────────────────────────────

export const getTalentPool = (): Promise<SavedCandidateOut[]> =>
  apiClient.get('/employer/talent-pool').then((r) => r.data)

export const saveCandidate = (aspirantId: string, note?: string): Promise<SavedCandidateOut> =>
  apiClient.post(`/employer/talent-pool/${aspirantId}`, { note: note || null }).then((r) => r.data)

export const unsaveCandidate = (aspirantId: string): Promise<{ aspirant_id: string; removed: boolean }> =>
  apiClient.delete(`/employer/talent-pool/${aspirantId}`).then((r) => r.data)

export const checkCandidateSaved = (aspirantId: string): Promise<{ aspirant_id: string; saved: boolean }> =>
  apiClient.get(`/employer/talent-pool/${aspirantId}/is-saved`).then((r) => r.data)

// ── Cross-job employer list views (Phase E) ───────────────────────────────────

export interface ApplicantListItem {
  application_id: string
  aspirant_id: string
  full_name: string | null
  city: string | null
  job_id: string
  job_title: string
  department_name: string | null
  status: string
  match_score: number | null
  applied_at: string
  days_ago: number
}

export interface AllApplicantsResponse {
  total: number
  items: ApplicantListItem[]
}

export interface InterviewListItem {
  interview_id: string
  application_id: string
  candidate_name: string | null
  job_id: string
  job_title: string
  department_name: string | null
  interviewer_name: string | null
  scheduled_at: string | null
  meeting_link: string | null
  status: 'scheduled' | 'completed' | 'canceled'
  recommendation: string | null
}

export interface AllInterviewsResponse {
  total: number
  items: InterviewListItem[]
}

export interface OfferListItem {
  offer_id: string
  application_id: string
  candidate_name: string | null
  job_id: string
  job_title: string
  department_name: string | null
  role_title: string
  salary_ctc: string
  start_date: string
  status: 'sent' | 'accepted' | 'declined'
  sent_at: string | null
  responded_at: string | null
}

export interface AllOffersResponse {
  total: number
  items: OfferListItem[]
}

export interface ApplicantFilters { status?: string; job_id?: string; department_id?: string; limit?: number; offset?: number }
export interface InterviewFilters { status?: string; job_id?: string; limit?: number; offset?: number }
export interface OfferFilters { status?: string; job_id?: string; limit?: number; offset?: number }

export const getAllApplicants = (params: ApplicantFilters = {}): Promise<AllApplicantsResponse> =>
  apiClient.get('/employer/applicants', { params }).then((r) => r.data)

export const getAllInterviews = (params: InterviewFilters = {}): Promise<AllInterviewsResponse> =>
  apiClient.get('/employer/all-interviews', { params }).then((r) => r.data)

export const getAllOffers = (params: OfferFilters = {}): Promise<AllOffersResponse> =>
  apiClient.get('/employer/all-offers', { params }).then((r) => r.data)

// ── Phase F: Pipeline Stages ──────────────────────────────────────────────────

export interface PipelineStage {
  id: string
  stage_key: string
  display_name: string
  color: string
  position: number
  is_visible: boolean
}

export interface PipelineStageIn {
  stage_key: string
  display_name: string
  color: string
  position: number
  is_visible: boolean
}

export interface PipelineTemplate {
  id: string
  name: string
  stages: PipelineStageIn[]
}

export const getPipelineStages = (jobId: string): Promise<PipelineStage[]> =>
  apiClient.get(`/employer/jobs/${jobId}/pipeline-stages`).then((r) => r.data)

export const bulkUpsertPipelineStages = (jobId: string, stages: PipelineStageIn[]): Promise<PipelineStage[]> =>
  apiClient.put(`/employer/jobs/${jobId}/pipeline-stages`, { stages }).then((r) => r.data)

export const applyTemplateToJob = (jobId: string, templateId: string): Promise<PipelineStage[]> =>
  apiClient.post(`/employer/jobs/${jobId}/pipeline-stages/from-template/${templateId}`).then((r) => r.data)

export const getPipelineTemplates = (): Promise<PipelineTemplate[]> =>
  apiClient.get('/employer/pipeline-templates').then((r) => r.data)

export const createPipelineTemplate = (name: string, stages: PipelineStageIn[]): Promise<PipelineTemplate> =>
  apiClient.post('/employer/pipeline-templates', { name, stages }).then((r) => r.data)

export const deletePipelineTemplate = (id: string): Promise<void> =>
  apiClient.delete(`/employer/pipeline-templates/${id}`).then((r) => r.data)
