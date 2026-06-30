import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'

export interface CalendarStatus {
  connected: boolean
  connected_at?: string
  scopes?: string[]
}

export const calendarApi = {
  getStatus: (): Promise<CalendarStatus> =>
    apiClient.get('/employer/calendar/status').then(r => r.data),

  authorize: () => {
    const token = useAuthStore.getState().accessToken ?? ''
    window.location.href = `${apiClient.defaults.baseURL}/auth/google/calendar/authorize?token=${encodeURIComponent(token)}`
  },

  disconnect: (): Promise<{ disconnected: boolean }> =>
    apiClient.delete('/employer/calendar/disconnect').then(r => r.data),
}
