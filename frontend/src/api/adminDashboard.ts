import { apiClient } from './client'

export type AttentionKey = 'verifications' | 'tickets' | 'safety' | 'appeals' | 'payments'

export interface AttentionRow {
  key: AttentionKey
  label: string
  /** Items waiting on a person. For payments this is the number of past-due subscriptions. */
  count: number
  /** Items past their target (verification days / ticket first-response hours). */
  overdue: number
  level: 'urgent' | 'normal'
  oldest_age_hours: number | null
  parts: { label: string; count: number }[]
  note: string | null
  link: string
}

export interface AttentionResponse {
  generated_at: string
  targets: { verification_days: number; ticket_first_response_hours: number }
  rows: AttentionRow[]
  /** Queues this role watches that currently have nothing in them. */
  clear: string[]
}

export interface MarketplaceTile {
  key: 'live_jobs' | 'applications' | 'interview_rate' | 'hires'
  label: string
  kind: 'count' | 'rate'
  /** A count, or a 0 to 1 rate (null when there is nobody in the denominator). */
  value: number | null
  sub: string | null
  numerator?: number
  denominator?: number
  /** Present only when compare is on and the earlier period is big enough to compare against. */
  delta: { abs?: number; pct?: number | null; points?: number } | null
  series: number[] | null
  low_sample: boolean
  help: string
}

export interface SectorBalance { sector: string; jobs: number; applications: number; per_job: number }

export interface MarketplaceOverview {
  generated_at: string
  range: { days: number; from: string; to: string; compare: boolean }
  tiles: MarketplaceTile[]
  sectors: SectorBalance[]
  zero_application_jobs: { total: number; after_days: number; items: { id: string; title: string; sector: string; age_days: number }[] }
  low_sample_n: number
}

export const adminDashboardApi = {
  overview: (days: number, compare: boolean) =>
    apiClient.get<MarketplaceOverview>('/admin/dashboard/overview', { params: { days, compare } }).then(r => r.data),
  attention: () => apiClient.get<AttentionResponse>('/admin/dashboard/attention').then(r => r.data),
}
