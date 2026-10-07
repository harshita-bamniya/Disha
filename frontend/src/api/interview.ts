import { apiClient } from './client'

export interface InterviewQuestion {
  id: string
  question_text: string
  question_type: string | null
  difficulty: string | null
  language: string
  career_track_id: string | null
  skill_assessed?: string | null
  is_dynamic?: boolean
  panelist_name?: string | null
  panelist_role?: string | null
}

export interface SessionSummary {
  id: string
  career_track_name: string | null
  session_type: string
  status: string
  total_questions: number
  responses_count: number
  avg_score: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  job_role?: string | null
  experience_level?: string | null
  blueprint?: InterviewBlueprint | null
  language?: InterviewLanguage
  // practice, or verified (an employer-invited interview)
  mode?: 'practice' | 'verified'
}

export type InterviewLanguage = 'en' | 'hi' | 'hinglish'

export interface LanguageOption {
  code: InterviewLanguage
  label: string
  bcp47: string
}

// What the server can do for the room. Anything not available falls back to
// the browser's own speech recognition / synthesis.
export interface InterviewCapabilities {
  server_stt: boolean
  server_tts: boolean
  max_audio_mb: number
  tts_max_chars: number
  languages: LanguageOption[]
}

export interface InterviewEligibility {
  stress: { unlocked: boolean; completed: number; required: number; message: string }
  drills: { used: number; limit: number; remaining: number }
}

// POST /drill-answer: the scored feedback, or a safety halt like a full interview.
export interface DrillAnswerResult {
  feedback?: SessionFeedback
  session_id?: string
  distress?: boolean
  message?: string
  safety_hold?: boolean
  helplines?: Helpline[]
}

export interface PanelMember {
  name: string
  role: string
}

export interface InterviewBlueprint {
  skills_to_assess: string[]
  question_breakdown: Record<string, number>
  difficulty_ramp: string
  focus_areas: string[]
  interview_style: string
  opening_greeting: string
  ice_breaker_question: string
  panel?: PanelMember[]
  panel_intro?: string
}

export interface SubmittedResponse {
  id: string
  question_text: string
  question_type: string | null
  response_text: string
  sequence_num: number
  is_followup?: boolean
}

export interface Helpline {
  name: string
  contact: string
}

// POST /respond: normally { response_id, sequence_num }. A crisis signal halts
// the interview (safety_hold); a distress signal adds a gentle prompt to take
// a break (distress). Neither is ever scored.
export interface SubmitResponseResult {
  response_id?: string
  sequence_num?: number
  duplicate?: boolean
  safety_hold?: boolean
  distress?: boolean
  message?: string
  helplines?: Helpline[]
}

export interface SessionDetail extends SessionSummary {
  questions: InterviewQuestion[]
  responses: SubmittedResponse[]
  saving_audio?: boolean
}

export interface RoadmapStep {
  week_range: string
  focus: string
  action: string
  resource_type: string
}

export interface JobReadinessReport {
  job_role: string
  experience_level: string | null
  overall_readiness_score: number
  technical_readiness_score: number
  communication_score: number
  confidence_score?: number // no longer reported (always 0)
  hiring_recommendation: string
  hiring_recommendation_reason: string
  strengths: string[]
  critical_gaps: string[]
  skill_scores: Record<string, number>
  competencies: Array<{ skill: string; weight: number }>
  candidate_summary: string
  roadmap: RoadmapStep[]
  readiness_message: string
  consistency_notes: string[]
  confidence_note: string | null
  pacing_notes: string[]
  integrity_notes: string[]
  delivery?: {
    answers: number
    avg_words_per_answer: number
    filler_per_100_words: number
    hedging_per_100_words: number
  } | null
  needs_human_review?: boolean
  review_reasons?: string[]
  // Employer-facing band on verified interviews
  fit_band?: string | null
  error?: boolean
}

export interface FeedbackItem {
  id: string
  response_id: string | null
  question_text: string | null
  question_type: string | null
  skill_assessed: string | null
  original_response: string | null
  clarity_score: number | null
  conciseness_score: number | null
  impact_score: number | null
  relevance_score: number | null
  star_adherence: number | null
  overall_score: number | null
  strengths: string[]
  improvements: string[]
  rewritten_answer: string | null
  is_fallback: boolean
  evidence_quote: string | null
  judge_scores?: Record<string, number> | null
  judge_disagreement_note?: string | null
}

// Background grading: pending/running while feedback is being produced,
// failed if it errored (retry with regradeSession), done once it exists.
export type GradingStatus = 'pending' | 'running' | 'done' | 'failed'

export interface CompleteSessionResult {
  session_id: string
  status: string
  grading_status: GradingStatus
}

export interface SessionFeedback {
  session_id: string
  mode?: 'practice' | 'verified'
  grading_status: GradingStatus
  overall_avg: number
  feedback_items: FeedbackItem[]
  job_readiness_report: JobReadinessReport | null
  weak_skills: string[]
  outcome_reported: boolean
  reported_outcome: string | null
}

export const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: 'offer_received', label: 'Got an offer' },
  { value: 'interview_scheduled', label: 'Got an interview' },
  { value: 'rejected', label: 'Applied, got rejected' },
  { value: 'no_response', label: 'Applied, no response yet' },
  { value: 'did_not_apply', label: "Haven't applied yet" },
]

export interface SkillPerformance {
  skill: string
  avg_score: number
  attempts: number
}

export interface PerformanceStats {
  total_sessions: number
  completed_sessions: number
  avg_overall_score: number
  avg_clarity: number
  avg_conciseness: number
  avg_impact: number
  best_session_score: number
  sessions_by_type: Record<string, number>
  by_skill: SkillPerformance[]
}

export interface NextQuestionResult {
  action: 'follow_up' | 'challenge' | 'next_question'
  question: {
    id?: string
    text: string
    is_followup: boolean
    question_type?: string
    difficulty?: string
    original_question_id?: string
    panelist_name?: string | null
    panelist_role?: string | null
  } | null
  provisional_score: number
  coaching_note: string
  session_complete: boolean
}

export const interviewApi = {
  getQuestions: (params?: {
    career_track_id?: string
    question_type?: string
    difficulty?: string
  }) => apiClient.get<InterviewQuestion[]>('/interview/questions', { params }).then(r => r.data),

  listSessions: () =>
    apiClient.get<SessionSummary[]>('/interview/sessions').then(r => r.data),

  createSession: (data: {
    career_track_id?: string
    session_type?: string
    total_questions?: number
    difficulty?: string
    job_context?: string
    job_role?: string
    experience_level?: string
    job_description?: string
    // What the candidate agreed to. 'ai_processing' is required by the server.
    consents?: ('ai_processing' | 'own_effort' | 'improve_product' | 'media')[]
    language?: InterviewLanguage
  }) => apiClient.post<SessionDetail>('/interview/sessions', data).then(r => r.data),

  getCapabilities: () =>
    apiClient.get<InterviewCapabilities>('/interview/capabilities').then(r => r.data),

  transcribeAnswer: (sessionId: string, audio: Blob) => {
    const form = new FormData()
    form.append('audio', audio, 'answer.webm')
    return apiClient
      .post<{ text: string; saved: boolean }>(`/interview/sessions/${sessionId}/transcribe`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90_000,
      })
      .then(r => r.data)
  },

  speak: (sessionId: string, text: string) =>
    apiClient
      .post<Blob>(`/interview/sessions/${sessionId}/speak`, { text }, { responseType: 'blob', timeout: 60_000 })
      .then(r => r.data),

  getEligibility: () =>
    apiClient.get<InterviewEligibility>('/interview/eligibility').then(r => r.data),

  createDrill: (data: {
    job_role: string
    experience_level?: string
    language?: InterviewLanguage
    competency?: string
    repeat_of?: string
    consents: ('ai_processing' | 'own_effort' | 'improve_product' | 'media')[]
  }) => apiClient.post<SessionDetail>('/interview/drills', data).then(r => r.data),

  answerDrill: (sessionId: string, data: { response_text: string; response_time_sec?: number }) =>
    apiClient.post<DrillAnswerResult>(`/interview/sessions/${sessionId}/drill-answer`, data).then(r => r.data),

  deleteSession: (sessionId: string) =>
    apiClient.delete(`/interview/sessions/${sessionId}`).then(() => undefined),

  getSession: (sessionId: string) =>
    apiClient.get<SessionDetail>(`/interview/sessions/${sessionId}`).then(r => r.data),

  startSession: (sessionId: string) =>
    apiClient.post(`/interview/sessions/${sessionId}/start`).then(r => r.data),

  submitResponse: (sessionId: string, data: {
    question_id?: string
    question_text?: string
    question_type?: string
    response_text: string
    response_time_sec?: number
    is_followup?: boolean
  }) => apiClient.post<SubmitResponseResult>(
    `/interview/sessions/${sessionId}/respond`, data
  ).then(r => r.data),

  getNextQuestion: (sessionId: string, responseId: string) =>
    apiClient.post<NextQuestionResult>(
      `/interview/sessions/${sessionId}/next-question?response_id=${responseId}`
    ).then(r => r.data),

  completeSession: (sessionId: string) =>
    apiClient.post<CompleteSessionResult>(`/interview/sessions/${sessionId}/complete`).then(r => r.data),

  regradeSession: (sessionId: string) =>
    apiClient.post<CompleteSessionResult>(`/interview/sessions/${sessionId}/regrade`).then(r => r.data),

  getFeedback: (sessionId: string) =>
    apiClient.get<SessionFeedback>(`/interview/sessions/${sessionId}/feedback`).then(r => r.data),

  regenerateReport: (sessionId: string) =>
    apiClient.post<SessionFeedback>(`/interview/sessions/${sessionId}/regenerate-report`).then(r => r.data),

  getPerformance: () =>
    apiClient.get<PerformanceStats>('/interview/performance').then(r => r.data),

  submitOutcome: (sessionId: string, data: { outcome: string; notes?: string }) =>
    apiClient.post<{ message: string }>(`/interview/sessions/${sessionId}/outcome`, data).then(r => r.data),
}
