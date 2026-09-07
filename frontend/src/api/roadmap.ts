import { apiClient } from './client'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Subtopic {
  id: string
  title: string
  description: string
  is_completed: boolean
  resource_label: string
  resource_kind: 'narrative' | 'learning' | 'exercise' | 'ticket' | 'resume' | 'interview' | 'jobs'
}

export interface StageStatus {
  stage_number: number
  title: string
  description: string
  status: 'pending' | 'active' | 'passed'
  estimated_days: number | null
  progress_pct: number
  gate: GateCriterion[] | null
  subtopics: Subtopic[]
}

export interface GateCriterion {
  type: string
  label: string
  min_value: number
  current_value?: number
  passed?: boolean
}

export interface RoadmapOut {
  id: string
  career_track_id: string | null
  career_track_name: string | null
  current_stage: number
  gap_skills: string[]
  job_readiness_score: number
  narrative_score: number | null
  narrative_feedback: NarrativeFeedback | null
  stages: StageStatus[]
  generated_at: string
  last_recalibrated: string
  active_prep_job_id: string | null
  active_prep_job_title: string | null
  active_prep_job_company: string | null
}

export interface JRSBreakdown {
  total: number
  profile_score: number
  skill_coverage_score: number
  competence_score: number
  narrative_score: number
  resume_score: number
  interview_score: number
}

export interface NarrativeFeedback {
  overall_score: number
  commercial_language_pct: number
  upsc_jargon_found: string[]
  strengths: string[]
  specific_improvements: Array<{
    original: string
    issue: string
    rewrite: string
  }>
  rewritten_version: string
  coaching_note: string
  error?: string
}

export interface GateCheckOut {
  stage_number: number
  can_advance: boolean
  status: string
  criteria: Array<GateCriterion & { current_value: number; passed: boolean }>
  message: string
}

export interface TicketTemplate {
  id: string
  title: string
  context: string
  deliverable: string
  difficulty: 'junior' | 'mid' | 'senior'
  estimated_hours: number
  evaluation_rubric: Record<string, { weight: number; description: string }>
  career_track_name: string | null
}

export interface TicketSubmission {
  id: string
  ticket_id: string | null
  ticket_title: string | null
  submission_text: string
  submitted_at: string
  review_status: 'pending' | 'reviewing' | 'done' | 'failed'
  ai_review_result: {
    overall_score: number
    grade_label: string
    strengths: string[]
    improvements: string[]
    specific_edits: Array<{ location: string; issue: string; suggestion: string }>
    hiring_manager_verdict: string
  } | null
  ai_reviewed_at: string | null
}

export interface GapSkill {
  skill: string
  priority_rank: number
  competence_score: number | null
}

export interface RoadmapSummary {
  id: string
  career_track_id: string | null
  career_track_name: string | null
  current_stage: number
  job_readiness_score: number
  generated_at: string
  last_recalibrated: string
  is_active: boolean
}

export interface SkillCompetence {
  skill_text: string
  competence_score: number
  quiz_score_avg: number
  exercise_score_avg: number
  attempts: number
  last_assessed: string
}

// ── API ───────────────────────────────────────────────────────────────────────

export const roadmapApi = {
  generate: (careerTrackId: string) =>
    apiClient.post<RoadmapOut>(`/roadmap/generate/${careerTrackId}`).then(r => r.data),

  getMine: (careerTrackId?: string) =>
    apiClient.get<RoadmapOut>('/roadmap/mine', {
      params: careerTrackId ? { career_track_id: careerTrackId } : undefined,
    }).then(r => r.data),

  getAll: () =>
    apiClient.get<RoadmapSummary[]>('/roadmap/all').then(r => r.data),

  getById: (roadmapId: string) =>
    apiClient.get<RoadmapOut>(`/roadmap/${roadmapId}`).then(r => r.data),

  getJRS: () =>
    apiClient.get<JRSBreakdown>('/roadmap/jrs').then(r => r.data),

  submitNarrative: (roadmapId: string, narrativeText: string) =>
    apiClient.post<NarrativeFeedback>(`/roadmap/${roadmapId}/narrative`, {
      narrative_text: narrativeText,
    }).then(r => r.data),

  getNarrativeFeedback: (roadmapId: string) =>
    apiClient.get<NarrativeFeedback>(`/roadmap/${roadmapId}/narrative/feedback`).then(r => r.data),

  checkGate: (roadmapId: string, stageNumber: number) =>
    apiClient.post<GateCheckOut>(`/roadmap/${roadmapId}/gate/${stageNumber}`).then(r => r.data),

  advanceStage: (roadmapId: string) =>
    apiClient.post<RoadmapOut>(`/roadmap/${roadmapId}/advance`).then(r => r.data),

  getTickets: () =>
    apiClient.get<TicketTemplate[]>('/roadmap/tickets').then(r => r.data),

  submitTicket: (roadmapId: string, ticketId: string, submissionText: string) =>
    apiClient.post<TicketSubmission>(`/roadmap/${roadmapId}/tickets/submit`, {
      ticket_id: ticketId,
      submission_text: submissionText,
    }).then(r => r.data),

  getSubmissions: (roadmapId: string) =>
    apiClient.get<TicketSubmission[]>(`/roadmap/${roadmapId}/tickets/submissions`).then(r => r.data),

  getGapSkills: () =>
    apiClient.get<GapSkill[]>('/roadmap/skills/gap').then(r => r.data),

  getSkillCompetence: () =>
    apiClient.get<SkillCompetence[]>('/roadmap/skills/competence').then(r => r.data),
}
