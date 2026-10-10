import { apiClient } from './client'
import type { InterviewLanguage, SessionDetail } from './interview'

// ── Candidate side ────────────────────────────────────────────────────────────

export interface MyInvitation {
  id: string
  status: 'invited' | 'started' | 'completed' | 'declined' | 'expired'
  employer_name: string
  title: string
  role: string
  language: InterviewLanguage
  duration_minutes: number
  /** What is assessed. The questions themselves are not shown in advance. */
  competencies: string[]
  has_employer_questions: boolean
  expires_at: string
  session_id: string | null
  retention_days: number
}

export interface Appeal {
  id: string
  status: 'open' | 'resolved'
  reason: string
  resolution_note: string | null
  created_at: string | null
}

export interface IntegrityObservation {
  observation: string
  kind: string
  from_ms: number
  to_ms: number | null
}

export type StartConsent = 'ai_processing' | 'own_effort' | 'improve_product' | 'media' | 'employer_share'

export const verifiedApi = {
  listMyInvitations: () =>
    apiClient.get<MyInvitation[]>('/interview/invitations').then(r => r.data),

  getMyInvitation: (id: string) =>
    apiClient.get<MyInvitation>(`/interview/invitations/${id}`).then(r => r.data),

  startInvitation: (id: string, consents: StartConsent[]) =>
    apiClient.post<SessionDetail>(`/interview/invitations/${id}/start`, { consents }).then(r => r.data),

  declineInvitation: (id: string) =>
    apiClient.post(`/interview/invitations/${id}/decline`).then(() => undefined),

  sendIntegrityEvents: (sessionId: string, events: { kind: string; started_ms: number; ended_ms?: number }[]) =>
    apiClient.post<{ accepted: number }>(`/interview/sessions/${sessionId}/integrity-events`, { events }).then(r => r.data),

  getIntegrityEvents: (sessionId: string) =>
    apiClient.get<IntegrityObservation[]>(`/interview/sessions/${sessionId}/integrity-events`).then(r => r.data),

  fileAppeal: (sessionId: string, reason: string) =>
    apiClient.post<{ id: string; status: string }>(`/interview/sessions/${sessionId}/appeal`, { reason }).then(r => r.data),

  getAppeals: (sessionId: string) =>
    apiClient.get<Appeal[]>(`/interview/sessions/${sessionId}/appeals`).then(r => r.data),

  revokeShare: (sessionId: string) =>
    apiClient.post<{ revoked: number }>(`/interview/sessions/${sessionId}/revoke-share`).then(r => r.data),
}

// ── Employer side ─────────────────────────────────────────────────────────────

export interface Competency {
  skill: string
  weight: number
  must_have: boolean
}

export interface InterviewTemplate {
  id: string
  title: string
  role: string
  language: InterviewLanguage
  duration_minutes: number
  job_id: string | null
  competencies: Competency[]
  custom_questions: string[]
  status: 'active' | 'archived'
}

export interface TemplateInput {
  title: string
  role: string
  language: InterviewLanguage
  duration_minutes: number
  job_id?: string | null
  competencies: Competency[]
  custom_questions: string[]
}

export interface EmployerInvitation {
  id: string
  template_id: string
  template_title: string
  role: string
  candidate_name: string
  application_id: string | null
  status: MyInvitation['status']
  expires_at: string
  completed_at: string | null
  result_available: boolean
  fit_band: string | null
  needs_human_review: boolean
  questions_answered: number | null
  questions_planned: number | null
  decision: 'shortlist' | 'hold' | 'decline' | null
}

export const DECISION_REASONS: { value: string; label: string }[] = [
  { value: 'strong_evidence', label: 'Strong evidence in answers' },
  { value: 'needs_more_information', label: 'Need more information' },
  { value: 'skills_gap', label: 'Skills gap for this role' },
  { value: 'role_filled', label: 'Role filled' },
  { value: 'better_fit_elsewhere', label: 'Better fit elsewhere' },
  { value: 'other', label: 'Other' },
]

export interface ScorecardAnswer {
  question: string
  skill: string | null
  answer: string
  overall_score: number | null
  is_unscored: boolean
  scores: { clarity: number | null; conciseness: number | null; impact: number | null; relevance: number | null; structure: number | null }
  evidence_quote: string | null
  scoring_passes_disagreed: boolean
}

export interface Scorecard {
  invitation_id: string
  candidate_name: string
  role: string
  completed_at: string | null
  language: string
  fit_band: string | null
  overall_score: number | null
  questions_answered: number | null
  questions_planned: number | null
  needs_human_review: boolean
  review_reasons: string[]
  skill_scores: Record<string, number>
  competencies: { skill: string; weight: number }[]
  summary: string | null
  strengths: string[]
  areas_to_probe: string[]
  answers: ScorecardAnswer[]
  integrity_observations: IntegrityObservation[]
  shared_until: string
  decision: { decision: 'shortlist' | 'hold' | 'decline'; reason_code: string; note: string | null } | null
  recording_available: boolean
}

export const employerVerifiedApi = {
  listTemplates: () =>
    apiClient.get<InterviewTemplate[]>('/interview/employer/templates').then(r => r.data),

  draftCompetencies: (role: string, language: InterviewLanguage) =>
    apiClient.post<{ competencies: Competency[] }>('/interview/employer/templates/draft', { role, language }).then(r => r.data.competencies),

  createTemplate: (data: TemplateInput) =>
    apiClient.post<InterviewTemplate>('/interview/employer/templates', data).then(r => r.data),

  archiveTemplate: (id: string) =>
    apiClient.delete(`/interview/employer/templates/${id}`).then(() => undefined),

  listInvitations: () =>
    apiClient.get<EmployerInvitation[]>('/interview/employer/invitations').then(r => r.data),

  invite: (data: { template_id: string; application_id: string; expires_in_days?: number }) =>
    apiClient.post<EmployerInvitation>('/interview/employer/invitations', data).then(r => r.data),

  getResult: (invitationId: string) =>
    apiClient.get<Scorecard>(`/interview/employer/results/${invitationId}`).then(r => r.data),

  decide: (invitationId: string, data: { decision: 'shortlist' | 'hold' | 'decline'; reason_code: string; note?: string }) =>
    apiClient.post(`/interview/employer/results/${invitationId}/decision`, data).then(r => r.data),

  listAudio: (invitationId: string) =>
    apiClient.get<{ files: string[] }>(`/interview/employer/results/${invitationId}/audio`).then(r => r.data.files),

  // Fetched with the auth header (an <audio src> can't send one), then played from an object URL.
  getAudioBlob: (invitationId: string, name: string) =>
    apiClient
      .get<Blob>(`/interview/employer/results/${invitationId}/audio/${encodeURIComponent(name)}`, { responseType: 'blob' })
      .then(r => r.data),
}
