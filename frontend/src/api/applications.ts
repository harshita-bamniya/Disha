/**
 * Phase 7 — ATS Application Submission API
 * Covers eligibility check, draft management, form fetching, and submission.
 */
import { apiClient } from './client'

// ── Form types (mirrors ApplicationFormOut from backend) ──────────────────────

export interface KnockoutRuleOut {
  id: string
  question_id: string
  operator: string
  threshold_value: string
  action: string
  tag_name: string | null
  priority: number
}

export interface QuestionOut {
  id: string
  section_id: string
  question_type: string
  label: string
  hint_text: string | null
  placeholder: string | null
  is_required: boolean
  is_compliance_protected: boolean
  order_index: number
  character_limit: number | null
  validation_json: Record<string, unknown>
  options_json: { value: string; label: string }[] | null
  version: number
  knockout_rule: KnockoutRuleOut | null
}

export interface FormSectionOut {
  id: string
  form_id: string
  title: string
  description: string | null
  section_type: string
  order_index: number
  is_locked: boolean
  is_visible: boolean
  questions: QuestionOut[]
}

export interface ApplicationFormOut {
  id: string
  job_id: string
  status: string
  version: number
  settings_json: {
    resume_config?: string        // required | optional | hidden | auto_fill
    require_cover_letter?: string // required | optional | hidden
    require_work_authorization?: boolean
    allow_attachments?: boolean
  }
  sections: FormSectionOut[]
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export interface EligibilityOut {
  eligible: boolean
  reason: string | null        // already_applied | job_closed | limit_reached
  existing_application_id: string | null
  has_draft: boolean
  draft_id: string | null
}

// ── Draft ─────────────────────────────────────────────────────────────────────

export interface DraftOut {
  id: string
  job_id: string
  current_step: number
  responses_json: Record<string, unknown>
  selected_resume_id: string | null
  last_saved_at: string
  expires_at: string
}

// ── Answer ────────────────────────────────────────────────────────────────────

export interface AnswerIn {
  question_id: string
  text_value?: string | null
  number_value?: number | null
  date_value?: string | null        // ISO string
  option_values?: string[] | null
  file_attachment_id?: string | null
}

// ── Submission ────────────────────────────────────────────────────────────────

export interface SubmitRequest {
  selected_resume_id?: string | null
  answers: AnswerIn[]
  cover_note?: string | null
}

export interface ApplicationOut {
  id: string
  job_id: string
  job_title: string
  company_name: string
  status: string
  reference_number: string | null
  match_score: number | null
  knockout_triggered: boolean
  application_score: number | null
  created_at: string
  updated_at: string
}

// ── API ───────────────────────────────────────────────────────────────────────

export const applicationsApi = {
  /** Check whether the candidate can apply to this job. */
  checkEligibility: (jobId: string) =>
    apiClient.get<EligibilityOut>(`/jobs/${jobId}/apply/eligibility`).then(r => r.data),

  /** Fetch the published application form for a job (public endpoint). */
  getForm: (jobId: string) =>
    apiClient.get<ApplicationFormOut>(`/jobs/${jobId}/application-form`).then(r => r.data),

  /** Start a new draft (or return the existing one). */
  startDraft: (jobId: string, selectedResumeId?: string | null) =>
    apiClient
      .post<DraftOut>(`/jobs/${jobId}/apply/draft`, { selected_resume_id: selectedResumeId ?? null })
      .then(r => r.data),

  /** Get the current draft. */
  getDraft: (jobId: string) =>
    apiClient.get<DraftOut>(`/jobs/${jobId}/apply/draft`).then(r => r.data),

  /** Auto-save step progress. */
  saveDraft: (jobId: string, currentStep: number, responses: Record<string, unknown>, selectedResumeId?: string | null) =>
    apiClient
      .put<DraftOut>(`/jobs/${jobId}/apply/draft`, {
        current_step: currentStep,
        responses,
        selected_resume_id: selectedResumeId ?? null,
      })
      .then(r => r.data),

  /** Discard the draft (user cancelled). */
  discardDraft: (jobId: string) =>
    apiClient.delete(`/jobs/${jobId}/apply/draft`),

  /** Submit the application. */
  submit: (jobId: string, body: SubmitRequest) =>
    apiClient.post<ApplicationOut>(`/jobs/${jobId}/apply/submit`, body).then(r => r.data),
}
