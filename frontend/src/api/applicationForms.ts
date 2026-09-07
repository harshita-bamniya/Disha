/**
 * Phase 8 — Application Form Builder API (Employer)
 * Wraps all /application-forms/* and /jobs/{job_id}/application-form employer endpoints.
 */
import { apiClient } from './client'

// ── Shared types (also exported for use in applications.ts) ──────────────────

export interface KnockoutRuleOut {
  id: string
  question_id: string
  operator: string
  threshold_value: string
  action: string
  tag_name: string | null
  advance_stage_id: string | null
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
  question_bank_id: string | null
  knockout_rule: KnockoutRuleOut | null
}

export interface ConditionalRuleOut {
  id: string
  trigger_question_id: string
  operator: string
  trigger_value: string | null
  target_entity_type: string
  target_entity_id: string
  action: string
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
    resume_config?: string
    require_cover_letter?: string
    require_portfolio?: string
    require_work_authorization?: boolean
    allow_attachments?: boolean
    max_attachment_size_mb?: number
  }
  last_published_at: string | null
  created_at: string
  updated_at: string
  sections: FormSectionOut[]
  conditional_rules: ConditionalRuleOut[]
}

export interface FormTemplateOut {
  id: string
  name: string
  description: string | null
  owner_type: string
  used_count: number
  created_at: string
}

export interface AtsQuestionBankOut {
  id: string
  question_type: string
  label: string
  hint_text: string | null
  category: string | null
  options_json: { value: string; label: string }[] | null
  is_platform_template: boolean
  is_compliance_protected: boolean
  owner_type: string
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface FormSettingsIn {
  resume_config: string
  require_cover_letter: string
  require_portfolio: string
  require_work_authorization: boolean
  allow_attachments: boolean
  max_attachment_size_mb: number
}

export interface QuestionIn {
  question_type: string
  label: string
  hint_text?: string | null
  placeholder?: string | null
  is_required?: boolean
  character_limit?: number | null
  validation_json?: Record<string, unknown>
  options_json?: { value: string; label: string }[] | null
  question_bank_id?: string | null
}

export interface KnockoutRuleIn {
  operator: string
  threshold_value: string
  action: string
  tag_name?: string | null
  advance_stage_id?: string | null
  priority?: number
}

export interface FormSectionIn {
  title: string
  description?: string | null
  section_type?: string
  is_locked?: boolean
}

// ── API ───────────────────────────────────────────────────────────────────────

export const applicationFormsApi = {
  /** Fetch the draft (or published) form for the employer form builder. */
  getDraftForm: (jobId: string) =>
    apiClient.get<ApplicationFormOut>(`/jobs/${jobId}/application-form/draft`).then(r => r.data),

  /** Create a new draft form for a job. */
  createForm: (jobId: string, settings?: Partial<FormSettingsIn>, templateId?: string) =>
    apiClient
      .post<ApplicationFormOut>(`/jobs/${jobId}/application-form`, {
        settings: settings ?? {
          resume_config: 'required',
          require_cover_letter: 'optional',
          require_portfolio: 'hidden',
          require_work_authorization: false,
          allow_attachments: false,
          max_attachment_size_mb: 10,
        },
        template_id: templateId ?? null,
      })
      .then(r => r.data),

  /** Update form-level settings. */
  updateForm: (formId: string, settings: FormSettingsIn) =>
    apiClient.put<ApplicationFormOut>(`/application-forms/${formId}`, { settings }).then(r => r.data),

  /** Validate and publish the form. */
  publishForm: (formId: string) =>
    apiClient.post<ApplicationFormOut>(`/application-forms/${formId}/publish`).then(r => r.data),

  // ── Sections ──────────────────────────────────────────────────────────────

  addSection: (formId: string, body: FormSectionIn) =>
    apiClient.post<FormSectionOut>(`/application-forms/${formId}/sections`, body).then(r => r.data),

  updateSection: (sectionId: string, body: FormSectionIn) =>
    apiClient.put<FormSectionOut>(`/form-sections/${sectionId}`, body).then(r => r.data),

  deleteSection: (sectionId: string) =>
    apiClient.delete(`/form-sections/${sectionId}`),

  reorderSections: (formId: string, order: { section_id: string; order_index: number }[]) =>
    apiClient
      .post<ApplicationFormOut>(`/application-forms/${formId}/sections/reorder`, order)
      .then(r => r.data),

  // ── Questions ─────────────────────────────────────────────────────────────

  addQuestion: (sectionId: string, body: QuestionIn) =>
    apiClient.post<QuestionOut>(`/form-sections/${sectionId}/questions`, body).then(r => r.data),

  updateQuestion: (questionId: string, body: QuestionIn) =>
    apiClient.put<QuestionOut>(`/questions/${questionId}`, body).then(r => r.data),

  deleteQuestion: (questionId: string) =>
    apiClient.delete(`/questions/${questionId}`),

  reorderQuestions: (sectionId: string, order: { question_id: string; order_index: number }[]) =>
    apiClient
      .post<FormSectionOut>(`/form-sections/${sectionId}/questions/reorder`, order)
      .then(r => r.data),

  // ── Knockout Rules ────────────────────────────────────────────────────────

  setKnockoutRule: (questionId: string, body: KnockoutRuleIn) =>
    apiClient
      .post<KnockoutRuleOut>(`/questions/${questionId}/knockout-rule`, body)
      .then(r => r.data),

  deleteKnockoutRule: (questionId: string) =>
    apiClient.delete(`/questions/${questionId}/knockout-rule`),

  // ── Templates ─────────────────────────────────────────────────────────────

  listTemplates: () =>
    apiClient.get<FormTemplateOut[]>('/application-forms/templates').then(r => r.data),

  saveAsTemplate: (formId: string, name: string, description?: string) =>
    apiClient
      .post<FormTemplateOut>(`/application-forms/${formId}/save-as-template`, { name, description: description ?? null })
      .then(r => r.data),

  createFromTemplate: (jobId: string, templateId: string) =>
    apiClient
      .post<ApplicationFormOut>(`/application-forms/from-template?job_id=${encodeURIComponent(jobId)}&template_id=${encodeURIComponent(templateId)}`)
      .then(r => r.data),

  // ── Question Bank ─────────────────────────────────────────────────────────

  listQuestionBank: (category?: string) =>
    apiClient
      .get<AtsQuestionBankOut[]>('/application-forms/question-bank', category ? { params: { category } } : undefined)
      .then(r => r.data),
}
