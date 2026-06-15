import { apiClient } from './client'

export interface XPSummary {
  xp_total: number
  xp_this_week: number
  level: number
  next_level_at: number
  xp_to_next: number
}

export interface XPTransaction {
  id: string
  xp_delta: number
  event_type: string
  note: string | null
  created_at: string
}

export interface DailyMission {
  type: string
  title: string
  description: string
  cta_label: string
  cta_path: string
  xp_reward: number
}

export interface CohortSignal {
  type: string
  message: string
  count: number
}

export const xpApi = {
  getSummary: () => apiClient.get<XPSummary>('/roadmap/xp').then(r => r.data),
  getTransactions: () => apiClient.get<XPTransaction[]>('/roadmap/xp/transactions').then(r => r.data),
  getDailyMission: () => apiClient.get<DailyMission>('/roadmap/daily-mission').then(r => r.data),
  getCohortSignals: () => apiClient.get<{ signals: CohortSignal[] }>('/roadmap/cohort-signals').then(r => r.data),
}
