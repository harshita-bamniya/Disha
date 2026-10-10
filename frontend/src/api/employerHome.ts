import { apiClient } from './client'
import type { AttentionItem } from '@/shared/components/dashboard/AttentionChips'
import type { KpiTile } from '@/shared/components/dashboard/KpiTiles'

export type EmployerAttentionKey = 'new_applications' | 'needs_feedback' | 'reschedule_requests' | 'offers_waiting' | 'interviews_today'

export interface EmployerAttention {
  generated_at: string
  approved: boolean
  targets: { first_look_days: number }
  rows: (AttentionItem & { key: EmployerAttentionKey })[]
}

export interface PipelineStage { key: 'new' | 'screening' | 'interview' | 'offer'; label: string; count: number }

export interface OpenJob {
  id: string
  title: string
  department: string | null
  age_days: number
  applicants: number
  /** Applications still in the Applied stage: nobody has looked yet. */
  awaiting: number
  screening: number
  in_interview: number
  offer: number
  /** Days until the posting closes (negative never happens: closed jobs are not listed). */
  closes_in_days: number | null
  /** Open for a week or more and never received an application. */
  no_applications: boolean
}

export interface UpcomingInterview {
  application_id: string
  job_id: string
  candidate: string
  job_title: string
  scheduled_at: string
  reschedule_requested: boolean
}

export interface RecentApplicant {
  application_id: string
  job_id: string
  candidate: string
  job_title: string
  applied_at: string
  /** Resume fit, 0 to 100. Null when the candidate applied without a resume. */
  match_score: number | null
  status: string
}

export interface EmployerOverview {
  generated_at: string
  approved: boolean
  range: { days: number; from: string; to: string; compare: boolean }
  tiles: KpiTile[]
  pipeline: PipelineStage[]
  jobs: { total_open: number; no_application_after_days?: number; items: OpenJob[] }
  upcoming_interviews: UpcomingInterview[]
  recent_applicants: RecentApplicant[]
  low_sample_n: number
  min_hires_for_time?: number
}

export const employerHomeApi = {
  attention: () => apiClient.get<EmployerAttention>('/employer/home/attention').then(r => r.data),
  overview: (days: number, compare: boolean) =>
    apiClient.get<EmployerOverview>('/employer/home/overview', { params: { days, compare } }).then(r => r.data),
}
