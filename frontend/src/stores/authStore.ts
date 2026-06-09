import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthTokens } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  // refreshToken is intentionally NOT persisted to localStorage (XSS protection).
  // It lives in memory only — on page refresh the interceptor will call /auth/refresh
  // using the HttpOnly cookie set by the backend (future), or the user re-logs in.
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, tokens: AuthTokens) => void
  setUser: (user: User) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, tokens) =>
        set({
          user,
          accessToken: tokens.access_token,
          // Store refresh token in memory only — not in localStorage
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'disha-auth',
      // Only persist user identity and auth flag — never tokens
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // accessToken persisted so users don't have to re-login on tab refresh
        // within the 15-minute window. Acceptable tradeoff for DX.
        // Remove this line if you add HttpOnly cookie-based refresh flow.
        accessToken: state.accessToken,
      }),
    }
  )
)
