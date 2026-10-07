import { apiClient } from './client'

// Mirrors backend/app/modules/resume_match/schemas.py

export type Band = 'Strong' | 'Good' | 'Fair' | 'Low'
export type ReqType = 'hard_skill' | 'soft_skill' | 'education' | 'certification' | 'domain' | 'eligibility'
export type FixType = 'reword' | 'add_evidence' | 'real_gap' | 'confirm'

export interface Requirement {
  name: string
  type: ReqType
  importance: 'must_have' | 'nice_to_have'
  years: number | null
  knockout: boolean
  specificity: 'specific' | 'generic'
  source_line: string
}

export interface RequirementResult {
  requirement: Requirement
  credit: number
  verdict: 'met' | 'partial' | 'missing'
  method: 'exact' | 'embedding' | 'llm' | 'none' | 'rule'
  evidence: string
  reason: string
  generic_capped: boolean
}

export interface Fix {
  requirement: string
  type: FixType
  points_gained: number
  action: string
}

export interface SubScore {
  key: string
  label: string
  score: number | null
  weight: number
  effective_weight: number
}

export interface AtsCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

export interface QualityCheck {
  key: string
  label: string
  score: number
  detail: string
  examples: string[]
}

export interface ResumeQuality {
  score: number
  label: 'Strong' | 'Decent' | 'Needs work'
  checks: QualityCheck[]
}

export interface MatchReport {
  score: number
  band: Band
  band_message: string
  must_haves_met: number
  must_haves_total: number
  must_haves_partial: number
  capped: boolean
  cap_reasons: string[]
  sub_scores: SubScore[]
  requirements: RequirementResult[]
  fixes: Fix[]
  to_confirm: string[]
  ats_notes: string[]
  ats_checks: AtsCheck[]
  low_signal: boolean
  quality: ResumeQuality | null
  scoring_version: string
}

export interface RoadmapLink {
  job_id: string
  plan_status: 'none' | 'generating' | 'ready' | 'failed'
  progress_pct: number
  covered: string[]
  not_covered: string[]
}

export interface RequirementChange {
  requirement: string
  before: number
  after: number
}

export interface ScanOut {
  id: string
  job_id: string
  job_title: string
  resume_source: 'builder' | 'file' | 'upload'
  resume_label: string | null
  created_at: string
  cached: boolean
  previous_score: number | null
  score_delta: number | null
  changes: RequirementChange[]
  roadmap: RoadmapLink | null
  report: MatchReport
}

export interface ScanSummary {
  id: string
  resume_source: string
  resume_label: string | null
  score: number
  band: Band
  must_haves_met: number
  must_haves_total: number
  score_delta: number | null
  created_at: string
}

export interface Quota {
  limit: number
  used: number
  remaining: number
}

export interface RewriteOut {
  requirement: string
  kind: 'rewrite' | 'from_answer' | 'needs_input' | 'not_applicable'
  original: string | null
  suggestion: string | null
  relationship: 'same' | 'same_family' | 'comparable' | null
  role: string | null
  missing_detail: string | null
  question: string | null
  warnings: string[]
}

// A scan can take 15s+ (two LLM calls on a first run), longer than the default 30s budget allows for retries.
const SCAN_TIMEOUT = 90_000

export interface ConsentStatus { consented: boolean; consented_at: string | null; retention_days: number; text: string }

export type ApplicationOutcome = 'interview' | 'offer' | 'rejected' | 'no_response'

export const resumeMatchApi = {
  outcomes: () => apiClient.get<Record<string, ApplicationOutcome>>('/resume-match/applications/outcomes').then(r => r.data),
  setOutcome: (applicationId: string, outcome: ApplicationOutcome) =>
    apiClient.put<{ application_id: string; outcome: ApplicationOutcome }>(`/resume-match/applications/${applicationId}/outcome`, { outcome }).then(r => r.data),
  consent: () => apiClient.get<ConsentStatus>('/resume-match/consent').then(r => r.data),
  giveConsent: () => apiClient.post<ConsentStatus>('/resume-match/consent').then(r => r.data),
  deleteMyData: () => apiClient.delete<{ deleted_scans: number }>('/resume-match/data').then(r => r.data),
  quota: () => apiClient.get<Quota>('/resume-match/quota').then(r => r.data),

  scanSaved: (body: { job_id: string; resume_id?: string; resume_file_id?: string }) =>
    apiClient.post<ScanOut>('/resume-match/scan', body, { timeout: SCAN_TIMEOUT }).then(r => r.data),

  scanUpload: (jobId: string, file: File) => {
    const form = new FormData()
    form.append('job_id', jobId)
    form.append('file', file)
    return apiClient
      .post<ScanOut>('/resume-match/scan-upload', form, {
        timeout: SCAN_TIMEOUT,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  listForJob: (jobId: string) =>
    apiClient.get<ScanSummary[]>(`/resume-match/jobs/${jobId}/scans`).then(r => r.data),

  get: (scanId: string) => apiClient.get<ScanOut>(`/resume-match/scans/${scanId}`).then(r => r.data),

  remove: (scanId: string) => apiClient.delete(`/resume-match/scans/${scanId}`),

  rewrite: (scanId: string, requirement: string) =>
    apiClient.post<RewriteOut>(`/resume-match/scans/${scanId}/rewrite`, { requirement }, { timeout: 60_000 })
      .then(r => r.data),

  answer: (scanId: string, requirement: string, answer: string) =>
    apiClient.post<RewriteOut>(`/resume-match/scans/${scanId}/answer`, { requirement, answer }, { timeout: 60_000 })
      .then(r => r.data),
}
