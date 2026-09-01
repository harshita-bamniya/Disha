import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

/**
 * Safely extract a human-readable error message from any API error.
 * Handles:
 *  - FastAPI string detail:  { detail: "error message" }
 *  - Pydantic v2 array:      { detail: [{ msg: "...", loc: [...] }] }
 *  - Plain Error objects
 */
export function getApiError(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback
  const detail = axios.isAxiosError(error) ? error.response?.data?.detail : undefined
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((e: { loc?: unknown[]; msg?: string }) => {
        const loc = Array.isArray(e?.loc) ? e.loc.slice(1).join(' → ') : ''
        const msg = e?.msg ?? ''
        return loc ? `${loc}: ${msg}` : msg
      })
      .filter(Boolean)
      .join('; ') || fallback
  }
  return fallback
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        })
        useAuthStore.getState().setAccessToken(data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)
