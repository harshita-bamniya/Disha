import { apiClient } from './client'

export type TrendMetric = 'users' | 'employers' | 'jobs' | 'applications'

export interface TrendPoint {
  date: string
  count: number
}

export interface TrendResponse {
  metric: TrendMetric
  days: number
  series: TrendPoint[]
}

export interface EmployerFunnelStage {
  stage: string
  count: number
  pct_of_total: number
}

export interface EmployerFunnelResponse {
  total_applications: number
  stages: EmployerFunnelStage[]
}

export interface JobPerformanceEntry {
  job_id: string
  title: string
  is_active: boolean
  total_applications: number
  shortlisted: number
  interviewed: number
  hired: number
  rejected: number
  conversion_rate_pct: number
  created_at: string
}

export interface JobPerformanceResponse {
  jobs: JobPerformanceEntry[]
}

export interface RecruiterPerformanceEntry {
  user_id: string
  name: string | null
  applications_moved: number
  interviews_conducted: number
  notes_added: number
  hires_closed: number
  avg_days_to_hire: number | null
}

export interface RecruiterPerformanceResponse {
  recruiters: RecruiterPerformanceEntry[]
}

export interface DashboardKpis {
  active_jobs: number
  draft_jobs: number
  paused_jobs: number
  closed_jobs: number
  archived_jobs: number
  applications_today: number
  total_applications: number
  interviews_scheduled: number
  offers_sent: number
  hires: number
  response_rate_pct: number
  avg_time_to_hire_days: number | null
}

export interface ApplicationTrendPoint {
  date: string
  count: number
}

export interface ApplicationTrendResponse {
  days: number
  series: ApplicationTrendPoint[]
}

export const analyticsApi = {
  getAdminTrends: (metric: TrendMetric, days = 30) =>
    apiClient.get<TrendResponse>('/analytics/admin/trends', { params: { metric, days } }).then(r => r.data),

  getEmployerFunnel: () =>
    apiClient.get<EmployerFunnelResponse>('/employer/analytics/funnel').then(r => r.data),

  getJobPerformance: () =>
    apiClient.get<JobPerformanceResponse>('/employer/analytics/jobs').then(r => r.data),

  getRecruiterPerformance: () =>
    apiClient.get<RecruiterPerformanceResponse>('/employer/analytics/recruiters').then(r => r.data),

  getDashboardKpis: () =>
    apiClient.get<DashboardKpis>('/employer/dashboard/kpis').then(r => r.data),

  getApplicationTrend: (days = 30) =>
    apiClient.get<ApplicationTrendResponse>('/employer/dashboard/application-trend', { params: { days } }).then(r => r.data),
}
