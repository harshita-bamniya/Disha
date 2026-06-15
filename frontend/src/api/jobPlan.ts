import { apiClient } from './client'

export interface PlanResource {
  id: string
  type: 'youtube' | 'article' | 'course'
  title: string
  channel_or_source: string
  search_query: string
  url: string
  duration_minutes: number
  description: string
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

export interface JobPlanResponse {
  status: 'not_generated' | 'generating' | 'ready' | 'failed'
  plan: JobPlan | null
  progress: Record<string, ResourceProgress>
  generated_at: string | null
  error: string | null
}

export const jobPlanApi = {
  generate: (jobId: string) =>
    apiClient.post(`/jobs/${jobId}/learning-plan`).then(r => r.data),

  get: (jobId: string) =>
    apiClient.get<JobPlanResponse>(`/jobs/${jobId}/learning-plan`).then(r => r.data),

  markProgress: (jobId: string, resourceId: string, done: boolean) =>
    apiClient.patch(`/jobs/${jobId}/learning-plan/progress`, { resource_id: resourceId, done }).then(r => r.data),
}
