import { apiClient } from './client'

export interface VideoOption {
  video_id: string
  title: string
  channel: string
  duration_minutes: number
  thumbnail_url: string
  url: string
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
}

export interface PlanModule {
  id: string
  skill: string
  priority: number
  why_important: string
  estimated_hours: number
  resources: PlanResource[]
}

export interface JobPlan {
  job_title: string
  company: string
  summary: string
  total_estimated_hours: number
  modules: PlanModule[]
}

export interface ResourceProgress {
  done: boolean
  done_at: string | null
}

export type GenerationStep = 'agenda' | 'resources' | 'finalizing'

export interface GenerationDetail {
  modules_planned?: number
  resources_done?: number
  resources_total?: number
  current_skill?: string | null
  last_found?: string | null
}

export interface JobPlanResponse {
  status: 'not_generated' | 'generating' | 'ready' | 'failed'
  plan: JobPlan | null
  progress: Record<string, ResourceProgress>
  generation_step?: GenerationStep
  generation_detail?: GenerationDetail
  generated_at: string | null
  updated_at?: string | null
  error: string | null
  /** true if a ready plan predates real-video enrichment and should be regenerated */
  stale?: boolean
}

export const jobPlanApi = {
  generate: (jobId: string) =>
    apiClient.post(`/jobs/${jobId}/learning-plan`).then(r => r.data),

  get: (jobId: string) =>
    apiClient.get<JobPlanResponse>(`/jobs/${jobId}/learning-plan`).then(r => r.data),

  markProgress: (jobId: string, resourceId: string, done: boolean) =>
    apiClient.patch(`/jobs/${jobId}/learning-plan/progress`, { resource_id: resourceId, done }).then(r => r.data),
}
