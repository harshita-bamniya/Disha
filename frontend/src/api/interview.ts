import { apiClient } from './client'

export interface InterviewQuestion {
  id: string
  question_text: string
  question_type: string | null
  difficulty: string | null
  language: string
  career_track_id: string | null
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
}

export interface SessionDetail extends SessionSummary {
  questions: InterviewQuestion[]
}

export interface FeedbackItem {
  id: string
  response_id: string | null
  question_text: string | null
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
}

export interface SessionFeedback {
  session_id: string
  overall_avg: number
  feedback_items: FeedbackItem[]
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
  }) => apiClient.post<SessionDetail>('/interview/sessions', data).then(r => r.data),

  getSession: (sessionId: string) =>
    apiClient.get<SessionDetail>(`/interview/sessions/${sessionId}`).then(r => r.data),

  startSession: (sessionId: string) =>
    apiClient.post(`/interview/sessions/${sessionId}/start`).then(r => r.data),

  submitResponse: (sessionId: string, data: {
    question_id: string
    response_text: string
    response_time_sec?: number
  }) => apiClient.post(`/interview/sessions/${sessionId}/respond`, data).then(r => r.data),

  completeSession: (sessionId: string) =>
    apiClient.post<SessionFeedback>(`/interview/sessions/${sessionId}/complete`).then(r => r.data),

  getFeedback: (sessionId: string) =>
    apiClient.get<SessionFeedback>(`/interview/sessions/${sessionId}/feedback`).then(r => r.data),

  getPerformance: () =>
    apiClient.get<PerformanceStats>('/interview/performance').then(r => r.data),
}
