import { apiClient } from './client'

// Admin analytics "command center". Every rate and interval is computed by the backend;
// the frontend never recalculates them.

export type Side = 'aspirant' | 'employer'

export interface RateWithCI {
  numerator: number
  denominator: number
  rate: number | null
  ci_low: number | null
  ci_high: number | null
  low_sample: boolean
}

export interface FunnelStep {
  key: string
  label: string
  count: number
  pct_of_start: number
  pct_of_prev: RateWithCI | null
  delta_pt: number | null
  low_sample: boolean
}

export interface FunnelResponse {
  side: Side
  steps: FunnelStep[]
  overall: (RateWithCI & { delta_pt?: number }) | null
  biggest_leak: { from_key: string; to_key: string; rate: number } | null
  meta: { generated_at: string; warnings: string[]; from: string; to: string; compare: boolean }
}

export interface RangeParams {
  days?: number
  from_date?: string
  to_date?: string
}

export const commandCenterApi = {
  getFunnel: (params: RangeParams & { side: Side; compare: boolean }) =>
    apiClient.get<FunnelResponse>('/admin/analytics/command-center/funnel', { params }).then(r => r.data),
}
