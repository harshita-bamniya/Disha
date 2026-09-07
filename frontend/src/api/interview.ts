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
}

export interface SessionDetail extends SessionSummary {
  questions: InterviewQuestion[]
  responses: SubmittedResponse[]
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
  confidence_score: number
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

export interface SessionFeedback {
  session_id: string
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
  }) => apiClient.post<SessionDetail>('/interview/sessions', data).then(r => r.data),

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
  }) => apiClient.post<{ response_id: string; sequence_num: number }>(
    `/interview/sessions/${sessionId}/respond`, data
  ).then(r => r.data),

  getNextQuestion: (sessionId: string, responseId: string) =>
    apiClient.post<NextQuestionResult>(
      `/interview/sessions/${sessionId}/next-question?response_id=${responseId}`
    ).then(r => r.data),

  completeSession: (sessionId: string) =>
    apiClient.post<SessionFeedback>(`/interview/sessions/${sessionId}/complete`).then(r => r.data),

  getFeedback: (sessionId: string) =>
    apiClient.get<SessionFeedback>(`/interview/sessions/${sessionId}/feedback`).then(r => r.data),

  regenerateReport: (sessionId: string) =>
    apiClient.post<SessionFeedback>(`/interview/sessions/${sessionId}/regenerate-report`).then(r => r.data),

  getPerformance: () =>
    apiClient.get<PerformanceStats>('/interview/performance').then(r => r.data),

  submitOutcome: (sessionId: string, data: { outcome: string; notes?: string }) =>
    apiClient.post<{ message: string }>(`/interview/sessions/${sessionId}/outcome`, data).then(r => r.data),
}
