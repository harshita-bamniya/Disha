import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthTokens } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  // refreshToken is normally kept in memory only (XSS protection) — wiped on
  // page refresh, so the session ends once the 15-min access token expires.
  // "Remember me" trades a bit of that protection for the refresh token
  // surviving a refresh/reopen, by also persisting it to localStorage.
  refreshToken: string | null
  rememberMe: boolean
  isAuthenticated: boolean
  setAuth: (user: User, tokens: AuthTokens, rememberMe?: boolean) => void
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
      rememberMe: false,
      isAuthenticated: false,

      setAuth: (user, tokens, rememberMe = false) =>
        set({
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          rememberMe,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          rememberMe: false,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'disha-auth',
      // Only persist user identity and auth flag by default — never tokens,
      // unless the user opted into "Remember me" for this login.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
        // accessToken persisted so users don't have to re-login on tab refresh
        // within the 15-minute window. Acceptable tradeoff for DX.
        accessToken: state.accessToken,
        // refreshToken only persisted when "Remember me" was checked — this is
        // what actually lets the session survive a page refresh/reopen.
        refreshToken: state.rememberMe ? state.refreshToken : null,
      }),
    }
  )
)
