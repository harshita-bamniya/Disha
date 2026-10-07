import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/shared/components/feedback/Toast'
import { isPaywallExemptPath } from '@/shared/config/paywallExempt'

/**
 * Safely extract a human-readable error message from any API error.
 * Handles:
 *  - FastAPI string detail:  { detail: "error message" }
 *  - Pydantic v2 array:      { detail: [{ msg: "...", loc: [...] }] }
 *  - Plain Error objects
 */
export function getApiError(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback
  const detail = (error as any)?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((e: any) => {
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
  timeout: 30000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// The refresh token is rotated server-side on every /auth/refresh call — the
// old one is revoked, and reusing an already-revoked one wipes ALL of the
// user's refresh tokens (reuse-detection). If two requests get a 401 around
// the same time (very plausible — e.g. an interview page polling several
// endpoints), each independently calling /auth/refresh with the same
// not-yet-rotated token means the second call reuses a token the first call
// just revoked, forcing a full logout even though the session was fine. This
// shared in-flight promise makes every 401 that arrives while a refresh is
// already underway await that same call instead of starting its own.
let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null

function refreshTokens(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        return data
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // 402 = a gated feature (aspirant free-tier limit) or an unpaid employer
    // dashboard route. Surface a paywall prompt and route to the right upgrade
    // page instead of a generic error toast.
    //
    // Exception: pages on PAYWALL_EXEMPT_PREFIXES (Team, Company Profile,
    // Verification, Support, Subscription) are meant to work without a paid
    // plan — but the layout around them still fires background calls like
    // useEmployerDashboard() (for the header company name) that ARE paid-
    // gated. Without this check, that unrelated background 402 would yank
    // the user off an exempt page they're legitimately allowed to be on,
    // making the whole exemption list a no-op.
    if (error.response?.status === 402) {
      if (isPaywallExemptPath(window.location.pathname)) {
        return Promise.reject(error)
      }
      const detail = getApiError(error, 'A subscription is required to continue.')
      const isEmployerRoute = (original?.url ?? '').includes('/employer/')
      toast.warning(detail)
      const target = isEmployerRoute ? '/app/employer/subscription' : '/app/pricing'
      if (window.location.pathname !== target) {
        setTimeout(() => { window.location.assign(target) }, 1200)
      }
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }

      try {
        const data = await refreshTokens(refreshToken)
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
