import { apiClient } from './client'

export interface VideoOption {
  video_id: string
  title: string
  channel: string
  duration_minutes: number
  thumbnail_url: string
  url: string
  views?: number | null
  likes?: number | null
  channel_subscribers?: number | null
  /** Why this video was picked for this skill and role. */
  reason?: string | null
}

export interface PlanResource {
  id: string
  type: 'youtube' | 'article' | 'course'
  title: string
  channel_or_source: string
  search_query: string
  url: string
  duration_minutes: number
  description: string
  /** Real searched YouTube candidates (only present for type === 'youtube') */
  video_options?: VideoOption[]
  recommended_video_id?: string
  /** One-line reason this resource is in the roadmap (engine v2). */
  why?: string
}

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  id: string
  text: string
  options: QuizOption[]
  /** Only present in the grading response — redacted before that. */
  correct_option_id?: string
  explanation?: string
}

export interface ModuleQuiz {
  questions: QuizQuestion[]
}

export interface QuizResult {
  question_id: string
  selected_option_id: string | null
  correct_option_id: string
  is_correct: boolean
  explanation: string
}

export interface RetryGuidance {
  wrong_count: number
  total_questions: number
  message: string
  missed_explanations: string[]
  resources_to_revisit: Array<{ id: string; title: string; type: string; url: string }>
}

export interface QuizSubmitResponse {
  score_pct: number
  passed: boolean
  results: QuizResult[]
  retry_guidance: RetryGuidance | null
}

export interface QuizProgress {
  score_pct: number
  passed: boolean
  submitted_at: string
}

export interface ProofTask {
  type: string
  title: string
  brief: string
  rubric: string[]
}

export interface PlanModule {
  id: string
  skill: string
  priority: number
  why_important: string
  estimated_hours: number
  resources: PlanResource[]
  quiz?: ModuleQuiz
  // ── engine v2 ──
  phase_id?: string
  /** concept | tool | practice — practice modules are project-only by design */
  kind?: 'concept' | 'tool' | 'practice'
  /** learn = new to you, partial = adjacent experience, review = refresher */
  status?: 'learn' | 'partial' | 'review'
  matched_skill?: string | null
  /** profile = from your listed skills; self_rating = from how you rated yourself for this job */
  matched_source?: 'profile' | 'self_rating'
  matched_rating?: number | null
  /** Set when the blueprint reviewer called this module generic or weak */
  review_flag?: string
  why_for_you?: string
  practice_hours?: number
  watch_minutes?: number
  proof?: ProofTask
  evidence?: { roles_matched?: number; roles_total?: number; postings_matched: number; postings_total: number }
  /** Week this module first appears in the schedule (client-computed) */
  _week?: number
  /** Computed client-side — not from API */
  _scheduleStart?: number
  _scheduleEnd?: number
}

/** Attach day-range schedule to each module based on estimated_hours and the
 *  user's own weekly_study_hours (from the one-time learning setup) — falls
 *  back to a 2 hrs/day assumption only if that hasn't been set yet. */
const DEFAULT_HOURS_PER_DAY = 2

export function attachSchedule(modules: PlanModule[], weeklyStudyHours?: number | null): PlanModule[] {
  const hoursPerDay = weeklyStudyHours ? weeklyStudyHours / 7 : DEFAULT_HOURS_PER_DAY
  let day = 1
  return modules.map(mod => {
    const days = Math.max(1, Math.ceil((mod.estimated_hours || 2) / hoursPerDay))
    const start = day
    const end = day + days - 1
    day = end + 1
    return { ...mod, _scheduleStart: start, _scheduleEnd: end }
  })
}

export interface PlanGate {
  type: string
  description: string
  pass_criteria: string[]
  hours: number
}

export interface PlanPhase {
  id: string
  name: string
  goal: string
  gate: PlanGate
  module_ids: string[]
  skipped: boolean
  hours: number
}

export interface ScheduleTask {
  type: 'watch' | 'read' | 'project' | 'quiz' | 'gate'
  module_id: string | null
  resource_id: string
  title: string
  hours: number
  part?: number | null
  parts?: number | null
  /** The study day this task starts on (only when the learner chose study days). */
  day?: string
  /** How many sittings of the learner's usual session length it takes. */
  sessions?: number
}

export interface ScheduleWeek {
  week: number
  starts_on: string
  hours: number
  sessions?: number
  tasks: ScheduleTask[]
}

export interface PlanSchedule {
  weekly_hours: number
  total_hours: number
  weeks_needed: number
  projected_finish: string
  target_date: string | null
  weeks_available: number | null
  feasible: boolean
  load_note?: string
  /** Set when the learner's weekly hours are too many for the days they chose. */
  day_note?: string
  /** What fits before an interview / application date. */
  deadline_note?: string | null
  session_hours?: number | null
  sessions_per_week?: number | null
  study_days?: string[] | null
  options: Array<{ type: 'extend_date' | 'raise_hours'; label: string; new_date?: string; hours_per_week?: number }>
  weeks: ScheduleWeek[]
}

export interface JobSearchKit {
  resume_bullet_templates: string[]
  resume_bullets_from_proofs?: string[]
  interview_questions: string[]
  where_to_apply: string[]
  profile_checklist: string[]
  salary_range_lpa?: { min: number; max: number; based_on_postings: number }
  /** Research estimate for entry level, from the reference catalogue (not an offer) */
  /** Share of the blueprint's reference roles that list one of the learner's preferred cities */
  location_fit?: { preferred: string[]; roles_matching: number; roles_total: number }
  salary_benchmark?: { min: number; max: number; basis: "reference_roles" | "benchmark_table"; n: number; level: "entry"; estimate: true }
}

export interface PlanGoal {
  role: string
  company: string
  target_date: string | null
  total_hours: number
  weeks_needed: number
  weeks_available: number | null
  feasible: boolean
  job_ready_definition: string[]
}

export interface JobPlan {
  job_title: string
  company: string
  summary: string
  total_estimated_hours: number
  modules: PlanModule[]
  // ── engine v2 (absent on legacy plans) ──
  engine?: 'v2'
  goal?: PlanGoal
  phases?: PlanPhase[]
  schedule?: PlanSchedule
  known_skills?: Array<{ skill: string; matched_from: string | null }>
  job_search_kit?: JobSearchKit
  blueprint?: {
    id: string; slug: string; version: number; review_status: 'draft' | 'reviewed'; postings_analyzed: number
    grounding?: { level: 'grounded' | 'partial' | 'unverified'; skills_with_postings: number; skills_total: number }
  }
  quality?: { validated: boolean; warnings: string[]; videos_resolved: number; modules: number; corrections?: string[] }
  /** What the learner already brings to THIS posting (from their profile or their own ratings) */
  strengths_for_posting?: Array<{ requirement: string; covered_by: string }>
  /** Blueprint skills the posting does not ask for: optional, not scheduled */
  stretch_modules?: Array<{ skill: string; why_for_role: string; base_hours: number }>
  self_ratings?: Record<string, number>
}

export interface VideoRating {
  video_id: string
  rating: 'relevant' | 'not_relevant'
  rated_at: string
}

export interface ResourceProgress {
  done: boolean
  done_at: string | null
  video_rating?: VideoRating
}

export type GenerationStep = 'agenda' | 'resources' | 'finalizing'

export interface GenerationDetail {
  modules_planned?: number
  resources_done?: number
  resources_total?: number
  current_skill?: string | null
  last_found?: string | null
  /** Current sub-step while the role blueprint is being built */
  message?: string
}

export interface JobPlanResponse {
  status: 'not_generated' | 'generating' | 'ready' | 'failed'
  plan: JobPlan | null
  progress: Record<string, ResourceProgress | QuizProgress>
  generation_step?: GenerationStep
  generation_detail?: GenerationDetail
  generated_at: string | null
  updated_at?: string | null
  error: string | null
  /** true if a ready plan predates real-video enrichment and should be regenerated */
  stale?: boolean
}

export interface JobPlanSummary {
  job_id: string
  job_title: string
  company_name: string
  status: 'generating' | 'ready' | 'failed'
  progress_pct: number
  generated_at: string | null
  updated_at: string | null
  is_active: boolean
  job_is_open: boolean
}

export interface SkillToRate {
  name: string
  kind: 'specific' | 'generic'
  importance: 'must_have' | 'nice_to_have'
  previous: number | null
}

export interface SkillsToRateOut {
  scale: Array<{ value: number; label: string }>
  skills: SkillToRate[]
}

export const jobPlanApi = {
  /** `skillRatings`: the learner's own 0-3 ratings of the skills this job asks for (optional). */
  generate: (jobId: string, skillRatings?: Record<string, number>) =>
    apiClient.post(`/jobs/${jobId}/learning-plan`, skillRatings ? { skill_ratings: skillRatings } : undefined).then(r => r.data),

  skillsToRate: (jobId: string) =>
    apiClient.get<SkillsToRateOut>(`/jobs/${jobId}/learning-plan/skills-to-rate`, { timeout: 60_000 }).then(r => r.data),

  get: (jobId: string) =>
    apiClient.get<JobPlanResponse>(`/jobs/${jobId}/learning-plan`).then(r => r.data),

  markProgress: (jobId: string, resourceId: string, done: boolean) =>
    apiClient.patch(`/jobs/${jobId}/learning-plan/progress`, { resource_id: resourceId, done }).then(r => r.data),

  rateVideo: (jobId: string, resourceId: string, videoId: string, rating: 'relevant' | 'not_relevant') =>
    apiClient.patch(`/jobs/${jobId}/learning-plan/progress`, { resource_id: resourceId, video_id: videoId, video_rating: rating }).then(r => r.data),

  getAllMine: () =>
    apiClient.get<JobPlanSummary[]>('/jobs/learning-plans/mine').then(r => r.data),

  submitQuiz: (jobId: string, moduleId: string, answers: Array<{ question_id: string; selected_option_id: string }>) =>
    apiClient.post<QuizSubmitResponse>(`/jobs/${jobId}/learning-plan/modules/${moduleId}/quiz/submit`, { answers }).then(r => r.data),

  generateQuiz: (jobId: string, moduleId: string) =>
    apiClient.post<ModuleQuiz>(`/jobs/${jobId}/learning-plan/modules/${moduleId}/quiz/generate`).then(r => r.data),

  remove: (jobId: string) =>
    apiClient.delete(`/jobs/${jobId}/learning-plan`).then(r => r.data),
}
