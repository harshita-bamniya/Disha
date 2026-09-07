import { apiClient } from './client'

export interface KrsScore {
  k_score: number
  r_score: number
  s_score: number
  composite: number
}

export interface CareerTrack {
  id: string
  slug: string
  title: string
  description: string
  sector: string
  required_skills: string[]
  salary_range: string | null
  growth_outlook: string | null
  example_roles: string[] | null
}

export interface CareerMatch {
  track: CareerTrack
  match_score: number
  skill_overlap: number
  skills_to_develop: string[]
}

export interface KrsDashboard {
  krs: KrsScore
  matches: CareerMatch[]
  missing_skills: string[]
  profile_complete: boolean
  selected_tracks: CareerMatch[]   // user's manually chosen career paths (0–2)
  full_name: string | null         // for personalised greeting
  skills: string[]                 // aspirant's skills — for job card skill-gap preview
}

export interface LiveJob {
  id: string
  company_name: string
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
  expires_at: string | null
  posted_at: string
  match_score: number
  skill_overlap: number
  semantic_score: number | null
  employer_website: string | null
  is_prepared: boolean
  skills_you_have: string[]    // required skills the user already has
  skills_to_develop: string[]  // required skills the user lacks
}

export interface PrepareJobResponse {
  job_id: string
  is_prepared: boolean
  message: string
}

export interface ActivePrepJobContext {
  job_id: string
  job_title: string
  company_name: string
  sector: string
  location: string | null
  required_skills: string[]
  skills_you_have: string[]
  skills_to_develop: string[]
  skill_gap_pct: number
  matched_track_id: string | null
  matched_track_title: string | null
  matched_track_slug: string | null
  match_score: number
}

export interface JobFitAnalysisRequest {
  job_title: string
  company_name: string
  description?: string | null
  required_skills: string[]
  skills_you_have: string[]
  skills_to_develop: string[]
  min_k_score: number
  k_score: number
}

export const krsApi = {
  getDashboard: () =>
    apiClient.get<KrsDashboard>('/krs/dashboard').then((r) => r.data),

  recompute: () =>
    apiClient.post<KrsScore>('/krs/compute').then((r) => r.data),

  getLiveJobs: () =>
    apiClient.get<LiveJob[]>('/krs/jobs').then((r) => r.data),

  getPreparedJobs: () =>
    apiClient.get<LiveJob[]>('/krs/jobs/preparing').then((r) => r.data),

  prepareJob: (jobId: string) =>
    apiClient.post<PrepareJobResponse>(`/krs/jobs/${jobId}/prepare`).then((r) => r.data),

  unprepareJob: (jobId: string) =>
    apiClient.delete<PrepareJobResponse>(`/krs/jobs/${jobId}/prepare`).then((r) => r.data),

  getActivePrep: () =>
    apiClient.get<ActivePrepJobContext | null>('/krs/jobs/active-prep').then((r) => r.data),

  startPrep: (jobId: string) =>
    apiClient.post<ActivePrepJobContext>(`/krs/jobs/${jobId}/start-prep`).then((r) => r.data),

  clearPrep: () =>
    apiClient.delete('/krs/jobs/active-prep').then((r) => r.data),

  getJobFitAnalysis: (body: JobFitAnalysisRequest) =>
    apiClient.post<{ summary: string }>('/krs/jobs/fit-analysis', body).then((r) => r.data),
}
